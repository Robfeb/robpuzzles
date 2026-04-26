import { Component, signal, computed, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoboLinkGeneratorService, GeneratedRoboLink, CircuitCell } from '../services/robo-link-generator.service';
import { HistoryManagerService } from '../services/history-manager.service';
import { PersistenceService } from '../services/persistence.service';

interface RoboLinkSnapshot {
  rotations: number[];
  superChargeActive: boolean;
  bridgeNodes: number[];
}

@Component({
  selector: 'app-robo-link',
  standalone: true,
  imports: [CommonModule],
  providers: [HistoryManagerService],
  template: `
    <div class="rl-wrapper">
      <div class="rl-status">
        <div class="rl-difficulty">
          <label i18n="@@diffLabel">Difficulty:</label>
          <select [value]="difficulty()" (change)="onDiffChange($event)">
            <option value="Easy" i18n="@@easy">Easy</option>
            <option value="Medium" i18n="@@med">Medium</option>
            <option value="Hard" i18n="@@hard">Hard</option>
          </select>
        </div>
        <div class="rl-moves"><span i18n="@@moves">Moves:</span> {{ moves() }}</div>
        <div class="rl-actions">
          <button class="icon-btn" (click)="undo()" [disabled]="!history.canUndo() || isWon()" title="Undo">↩️</button>
          <button class="icon-btn" (click)="generateNew()" title="New Puzzle">⏭️</button>
          <button class="icon-btn" (click)="resetPuzzle()" title="Restart">🔄</button>
        </div>
      </div>

      <div class="rl-board-wrap">
        <div class="rl-board" [style.width.px]="boardPx()" [style.height.px]="boardPx()">
          
          @if (puzzle()) {
            <div class="rl-grid"
                 [style.gridTemplateColumns]="'repeat(' + puzzle()!.width + ', ' + cellPx() + 'px)'"
                 [style.gridTemplateRows]="'repeat(' + puzzle()!.height + ', ' + cellPx() + 'px)'">
              
              @for (row of puzzle()!.cells; track $index) {
                @for (cell of row; track cell.x) {
                  <div class="rl-cell" 
                       [class.sc-mode]="isSuperChargeActive() && !isWon()"
                       [class.sc-selected]="isNodeSelected(cell.y * puzzle()!.width + cell.x)"
                       (click)="onCellClick(cell.x, cell.y)">
                    
                    <svg viewBox="0 0 100 100" class="rl-piece-svg"
                         [style.transform]="'rotate(' + (cell.rotation * 90) + 'deg)'"
                         [class.static]="cell.static">
                      
                      <!-- Connections -->
                      <g class="rl-traces">
                        @if (cell.type !== 'Broken') {
                          @if (hasPort(cell.basePorts, 1)) { <line x1="50" y1="50" x2="50" y2="0" [class.elec]="isElec(cell.x, cell.y)" /> }
                          @if (hasPort(cell.basePorts, 2)) { <line x1="50" y1="50" x2="100" y2="50" [class.elec]="isElec(cell.x, cell.y)" /> }
                          @if (hasPort(cell.basePorts, 4)) { <line x1="50" y1="50" x2="50" y2="100" [class.elec]="isElec(cell.x, cell.y)" /> }
                          @if (hasPort(cell.basePorts, 8)) { <line x1="50" y1="50" x2="0" y2="50" [class.elec]="isElec(cell.x, cell.y)" /> }
                        } @else {
                          <!-- Broken visual -->
                          @if (hasPort(cell.basePorts, 1)) { <line x1="50" y1="50" x2="50" y2="0" class="broken-line" /> }
                          @if (hasPort(cell.basePorts, 2)) { <line x1="50" y1="50" x2="100" y2="50" class="broken-line" /> }
                          @if (hasPort(cell.basePorts, 4)) { <line x1="50" y1="50" x2="50" y2="100" class="broken-line" /> }
                          @if (hasPort(cell.basePorts, 8)) { <line x1="50" y1="50" x2="0" y2="50" class="broken-line" /> }
                        }
                      </g>

                      <!-- Center Nodes -->
                      @if (cell.type === 'Battery') {
                        <circle cx="50" cy="50" r="24" class="rl-battery" />
                        <text x="50" y="58" class="rl-icon-text">⚡</text>
                      } @else if (cell.type === 'Motor') {
                        <circle cx="50" cy="50" r="24" class="rl-motor" [class.elec]="isElec(cell.x, cell.y)" />
                        <text x="50" y="58" class="rl-icon-text">⚙️</text>
                      } @else if (cell.type === 'Broken') {
                        <circle cx="50" cy="50" r="20" class="rl-broken" />
                        <path d="M35 35 L65 65 M35 65 L65 35" stroke="#ef4444" stroke-width="8" />
                      } @else {
                        <circle cx="50" cy="50" r="12" class="rl-joint" [class.elec]="isElec(cell.x, cell.y)" />
                      }
                    </svg>

                  </div>
                }
              }
            </div>

            <!-- Virtual Bridge SVG Overlay -->
            @if (bridgeNodes().length === 2) {
              <svg class="rl-bridge-svg" [attr.width]="boardPx()" [attr.height]="boardPx()">
                <line 
                  [attr.x1]="getBridgePx(bridgeNodes()[0]).x" [attr.y1]="getBridgePx(bridgeNodes()[0]).y"
                  [attr.x2]="getBridgePx(bridgeNodes()[1]).x" [attr.y2]="getBridgePx(bridgeNodes()[1]).y"
                  class="bridge-beam" [class.elec]="isElecId(bridgeNodes()[0])"
                />
              </svg>
            }

          } @else {
            <div class="rl-loading" i18n="@@generating">Generating Puzzle…</div>
          }

          <!-- Win Overlay -->
          @if (isWon()) {
            <div class="rl-overlay won">
              <div class="rl-overlay-card">
                <h2 i18n="@@rlWinTitle">🔌 System Online!</h2>
                <p i18n="@@rlWinDesc">Circuit completed in <strong>{{ moves() }}</strong> moves.</p>
                <button class="primary" (click)="generateNew()" i18n="@@nextPuzzle">Next Puzzle ⏭️</button>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="rl-controls">
        <div class="rl-info">
          <p i18n="@@rlInfoTap">Tap to rotate components.</p>
        </div>
        <!-- Super-Charge FAB -->
        <button class="sc-fab"
                [class.active]="isSuperChargeActive()"
                [class.has-bridge]="bridgeNodes().length === 2"
                (click)="toggleSuperCharge()"
                [disabled]="isWon()"
                title="Super-Charge (Space)">
          <div class="fab-icon">⚡</div>
          <span class="fab-label" i18n="@@scMode">Super Charge</span>
        </button>
      </div>
    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .rl-wrapper {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 12px; background: var(--surface); border-radius: var(--radius-lg);
      border: 1px solid var(--border); box-shadow: var(--shadow);
      max-width: 620px; margin: 0 auto;
    }

    .rl-status { display: flex; align-items: center; gap: 12px; flex-wrap: wrap; width: 100%; }
    .rl-difficulty { display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--text); }
    .rl-difficulty select {
      padding: 3px 6px; border-radius: var(--radius-sm); border: 1px solid var(--border);
      background: var(--surface-alt); color: var(--text); font-family: inherit;
    }
    .rl-moves { font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); margin-left: auto; }
    .rl-actions { display: flex; gap: 6px; }

    .rl-board-wrap { display: flex; justify-content: center; width: 100%; overflow: hidden; }
    .rl-board {
      position: relative; background: #0a0a14; border-radius: var(--radius-md);
      border: 2px solid #1a1a3a; box-shadow: 0 0 20px rgba(0, 255, 128, 0.05);
      touch-action: none; flex-shrink: 0;
    }
    .rl-grid { display: grid; width: 100%; height: 100%; }
    .rl-loading { width: 100%; height: 100%; display: flex; align-items: center; justify-content: center; color: #10b981; animation: pulse 1.5s infinite; }

    /* Cells */
    .rl-cell {
      box-sizing: border-box; border: 1px solid rgba(255,255,255,0.04);
      display: flex; align-items: center; justify-content: center;
      cursor: pointer; transition: background 0.2s; position: relative;
    }
    .rl-cell:active { background: rgba(255,255,255,0.05); }
    
    /* Super-Charge Mode styling */
    .rl-cell.sc-mode { border: 1px dashed rgba(245, 158, 11, 0.4); }
    .rl-cell.sc-mode:hover { background: rgba(245, 158, 11, 0.1); }
    .rl-cell.sc-selected { background: rgba(245, 158, 11, 0.2); border: 2px solid #f59e0b; }

    /* SVG Pieces */
    .rl-piece-svg { width: 90%; height: 90%; transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1); }
    .rl-piece-svg.static { transition: none; cursor: not-allowed; }

    /* Traces */
    .rl-traces line {
      stroke: #334155; stroke-width: 16; stroke-linecap: round;
      transition: stroke 0.3s, stroke-dasharray 0.3s;
    }
    .rl-traces line.broken-line { stroke: #475569; stroke-dasharray: 10 10; }
    
    .rl-joint { fill: #334155; transition: fill 0.3s; }
    
    /* Electrified State */
    .rl-traces line.elec {
      stroke: #10b981; stroke-dasharray: 20 15;
      animation: current-flow 0.5s linear infinite;
      filter: drop-shadow(0 0 6px #059669);
    }
    @keyframes current-flow { to { stroke-dashoffset: -35; } }
    .rl-joint.elec { fill: #10b981; filter: drop-shadow(0 0 6px #059669); }

    /* Components */
    .rl-battery { fill: #047857; stroke: #34d399; stroke-width: 4; filter: drop-shadow(0 0 10px #10b981); }
    .rl-motor { fill: #881337; stroke: #fb7185; stroke-width: 4; transition: all 0.3s; }
    .rl-motor.elec { fill: #e11d48; filter: drop-shadow(0 0 15px #f43f5e); }
    .rl-broken { fill: #1e293b; stroke: #ef4444; stroke-width: 3; }
    .rl-icon-text { font-size: 32px; text-anchor: middle; }

    /* Virtual Bridge */
    .rl-bridge-svg { position: absolute; top: 0; left: 0; pointer-events: none; z-index: 10; }
    .bridge-beam {
      stroke: #f59e0b; stroke-width: 6; stroke-dasharray: 12 8;
      filter: drop-shadow(0 0 8px #d97706); animation: bridge-flow 0.5s linear infinite;
    }
    .bridge-beam.elec { stroke: #10b981; filter: drop-shadow(0 0 10px #059669); }
    @keyframes bridge-flow { to { stroke-dashoffset: -20; } }

    /* Bottom Controls */
    .rl-controls { display: flex; justify-content: space-between; align-items: center; width: 100%; padding: 0 8px; }
    .rl-info { color: var(--text-secondary); font-size: 0.9rem; }

    /* Super Charge FAB */
    .sc-fab {
      width: 64px; height: 64px; border-radius: 50%;
      background: var(--surface-alt); border: 2px solid var(--border);
      color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow);
    }
    .sc-fab.active { background: radial-gradient(circle at 30% 30%, #f59e0b, #d97706); border-color: #fbbf24; color: #fff; box-shadow: 0 0 20px rgba(245, 158, 11, 0.4); }
    .sc-fab.has-bridge { background: radial-gradient(circle at 30% 30%, #10b981, #059669); border-color: #34d399; color: #fff; }
    .sc-fab:active { transform: scale(0.95); }
    .sc-fab:disabled { opacity: 0.5; cursor: not-allowed; }
    .fab-icon { font-size: 1.5rem; line-height: 1; }
    .fab-label { font-size: 0.55rem; font-weight: 600; text-transform: uppercase; margin-top: 2px; }

    .rl-overlay { position: absolute; inset: 0; display: flex; align-items: center; justify-content: center; backdrop-filter: blur(6px); z-index: 100; border-radius: var(--radius-md); }
    .rl-overlay.won { background: rgba(0, 30, 0, 0.85); }
    .rl-overlay-card { background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg); padding: 2rem; text-align: center; box-shadow: var(--shadow-lg); color: var(--text); }
    .rl-overlay-card h2 { margin: 0 0 0.5rem; font-size: 1.8rem; }
    .rl-overlay-card p { color: var(--text-secondary); margin: 0 0 1rem; }
  `]
})
export class RoboLinkComponent implements OnInit {
  private gen = inject(RoboLinkGeneratorService);
  history = inject(HistoryManagerService<RoboLinkSnapshot>);
  private persistence = inject(PersistenceService);

  difficulty = signal<'Easy' | 'Medium' | 'Hard'>('Easy');
  puzzle = signal<GeneratedRoboLink | null>(null);
  
  isSuperChargeActive = signal<boolean>(false);
  bridgeNodes = signal<number[]>([]); // Max 2
  
  moves = signal<number>(0);
  isWon = signal<boolean>(false);

  cellPx = computed(() => {
    const p = this.puzzle();
    if (!p) return 50;
    const available = Math.min(window.innerWidth - 48, 560);
    return Math.max(30, Math.floor(available / p.width));
  });

  boardPx = computed(() => {
    const p = this.puzzle();
    return p ? this.cellPx() * p.width : 400;
  });

  electrifiedNodes = computed(() => {
    const p = this.puzzle();
    if (!p) return new Set<number>();
    
    const virtualBridges: {id1: number, id2: number}[] = [];
    const bn = this.bridgeNodes();
    if (bn.length === 2) {
      virtualBridges.push({id1: bn[0], id2: bn[1]});
    }

    const elec = this.gen.computeElectrified(p.cells, p.batteryNode, virtualBridges);

    // Win condition check
    setTimeout(() => {
      let allMotorsPowered = true;
      for (const mId of p.motorNodes) {
        if (!elec.has(mId)) {
          allMotorsPowered = false;
          break;
        }
      }
      
      if (allMotorsPowered && !this.isWon()) {
        this.isWon.set(true);
        this.vibrate(50);
      } else if (!allMotorsPowered && this.isWon()) {
        this.isWon.set(false);
      }
    }, 0);

    return elec;
  });

  isElec(x: number, y: number) {
    const p = this.puzzle();
    if (!p) return false;
    return this.electrifiedNodes().has(y * p.width + x);
  }

  isElecId(id: number) {
    return this.electrifiedNodes().has(id);
  }

  hasPort(ports: number, portBit: number): boolean {
    return (ports & portBit) !== 0;
  }

  ngOnInit() {
    this.generateNew();
  }

  generateNew(seed?: number) {
    this.history.clear();
    this.isWon.set(false);
    this.isSuperChargeActive.set(false);
    this.bridgeNodes.set([]);
    this.moves.set(0);
    this.puzzle.set(null);

    setTimeout(() => {
      this.puzzle.set(this.gen.generate(this.difficulty(), seed));
    }, 30);
  }

  resetPuzzle() {
    const p = this.puzzle();
    if (!p) return;
    this.generateNew(p.seed);
  }

  onDiffChange(event: Event) {
    this.difficulty.set((event.target as HTMLSelectElement).value as any);
    this.generateNew();
  }

  onCellClick(x: number, y: number) {
    if (this.isWon()) return;
    const p = this.puzzle();
    if (!p) return;

    const id = y * p.width + x;

    if (this.isSuperChargeActive()) {
      // Handle virtual bridge selection
      const bn = [...this.bridgeNodes()];
      const idx = bn.indexOf(id);
      
      this.saveState();

      if (idx >= 0) {
        bn.splice(idx, 1); // Deselect
      } else {
        if (bn.length === 2) bn.shift(); // Max 2, drop oldest
        bn.push(id);
      }
      
      this.bridgeNodes.set(bn);
      if (bn.length === 2) {
        // Automatically exit selection mode when bridge is formed
        this.isSuperChargeActive.set(false);
      }
      return;
    }

    // Normal rotation
    const cell = p.cells[y][x];
    if (cell.static) return;

    this.saveState();

    this.puzzle.update(grid => {
      if (!grid) return grid;
      const newGrid = {...grid, cells: grid.cells.map(r => [...r])};
      newGrid.cells[y][x] = { ...cell, rotation: (cell.rotation + 1) % 4 };
      return newGrid;
    });

    this.moves.update(m => m + 1);
    this.vibrate(10);
  }

  toggleSuperCharge() {
    if (this.isWon()) return;
    if (this.difficulty() === 'Easy') return; // Not needed on easy
    
    this.saveState();
    
    // If we have a bridge and tap the button, clear the bridge
    if (this.bridgeNodes().length === 2 && !this.isSuperChargeActive()) {
      this.bridgeNodes.set([]);
      this.isSuperChargeActive.set(true);
    } else {
      this.isSuperChargeActive.update(v => !v);
    }
  }

  isNodeSelected(id: number) {
    return this.bridgeNodes().includes(id);
  }

  getBridgePx(id: number) {
    const p = this.puzzle();
    if (!p) return {x: 0, y: 0};
    const cp = this.cellPx();
    const x = id % p.width;
    const y = Math.floor(id / p.width);
    return { x: (x + 0.5) * cp, y: (y + 0.5) * cp };
  }

  saveState() {
    const p = this.puzzle();
    if (!p) return;
    
    const rotations = p.cells.flat().map(c => c.rotation);
    this.history.pushState({
      rotations,
      superChargeActive: this.isSuperChargeActive(),
      bridgeNodes: [...this.bridgeNodes()]
    });
  }

  undo() {
    if (this.isWon()) return;
    const p = this.puzzle();
    if (!p) return;

    const prev = this.history.undo();
    if (!prev) return;

    this.isSuperChargeActive.set(prev.superChargeActive);
    this.bridgeNodes.set(prev.bridgeNodes);
    
    this.puzzle.update(grid => {
      if (!grid) return grid;
      const newGrid = {...grid, cells: grid.cells.map(r => [...r])};
      for (let y = 0; y < grid.height; y++) {
        for (let x = 0; x < grid.width; x++) {
          const id = y * grid.width + x;
          newGrid.cells[y][x] = { ...newGrid.cells[y][x], rotation: prev.rotations[id] };
        }
      }
      return newGrid;
    });
    
    this.moves.update(m => Math.max(0, m - 1));
  }

  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.isWon() && e.key === 'Enter') {
      this.generateNew();
      return;
    }
    if (e.key === ' ' || e.key === 'f') {
      this.toggleSuperCharge();
      e.preventDefault();
    }
    if (e.key === 'u' || e.key === 'z') {
      this.undo();
    }
  }

  private vibrate(pattern: number | number[]) {
    try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
  }
}
