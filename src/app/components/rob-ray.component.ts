import { Component, signal, computed, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RobRayGeneratorService, GeneratedRobRay, GridCell } from '../services/rob-ray-generator.service';
import { HistoryManagerService } from '../services/history-manager.service';
import { PersistenceService } from '../services/persistence.service';

interface RobRaySnapshot {
  mirrors: { x: number, y: number, ori: '/' | '\\' }[];
  isPolarizerActive: boolean;
}

@Component({
  selector: 'app-rob-ray',
  standalone: true,
  imports: [CommonModule],
  providers: [HistoryManagerService],
  template: `
    <div class="rr-wrapper">
      <div class="rr-status">
        <div class="rr-difficulty">
          <label>Difficulty:</label>
          <select [value]="difficulty()" (change)="onDiffChange($event)">
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
        <div class="rr-moves">Moves: {{ moves() }}</div>
        <div class="rr-actions">
          <button class="icon-btn" (click)="undo()" [disabled]="!history.canUndo() || isWon()" title="Undo">↩️</button>
          <button class="icon-btn" (click)="generateNew()" title="New Puzzle">⏭️</button>
          <button class="icon-btn" (click)="resetPuzzle()" title="Restart">🔄</button>
        </div>
      </div>

      <div class="rr-board-wrap">
        <div class="rr-board" [style.width.px]="boardPx()" [style.height.px]="boardPx()">
          
          <!-- Base Grid Layer -->
          @if (puzzle()) {
            <div class="rr-grid"
                 [style.gridTemplateColumns]="'repeat(' + puzzle()!.width + ', ' + cellPx() + 'px)'"
                 [style.gridTemplateRows]="'repeat(' + puzzle()!.height + ', ' + cellPx() + 'px)'">
              @for (row of puzzle()!.cells; track $index) {
                @for (cell of row; track cell.x) {
                  <div class="rr-cell"
                       [class.wall]="cell.type === 'wall'"
                       [class.glass]="cell.type === 'glass'"
                       [class.glass-on]="cell.type === 'glass' && isPolarizerActive()"
                       (click)="rotateMirror(cell.x, cell.y)">
                    
                    @if (cell.type === 'emitter') {
                      <div class="rr-emitter" [attr.data-dir]="cell.emitDir">⚙️</div>
                    }
                    @if (cell.type === 'receptor') {
                      <div class="rr-receptor" [class.active]="isWon()">📡</div>
                    }
                    @if (cell.type === 'mirror') {
                      <div class="rr-mirror" [class.rotatable]="cell.rotatable" [class.slash]="cell.ori === '/'" [class.backslash]="cell.ori === '\\\\'">
                        <div class="mirror-bar"></div>
                      </div>
                    }
                  </div>
                }
              }
            </div>

            <!-- Laser Overlay Layer -->
            <svg class="rr-laser-svg" [attr.width]="boardPx()" [attr.height]="boardPx()">
              <polyline 
                [attr.points]="laserPointsString()"
                class="rr-laser-beam"
                [class.polarized]="isPolarizerActive()"
              />
            </svg>
          } @else {
            <div class="rr-loading">Generating Puzzle…</div>
          }

          <!-- Win Overlay -->
          @if (isWon()) {
            <div class="rr-overlay won">
              <div class="rr-overlay-card">
                <h2>🎉 Connection Established!</h2>
                <p>You routed the laser in <strong>{{ moves() }}</strong> moves.</p>
                <button class="primary" (click)="generateNew()">Next Puzzle ⏭️</button>
              </div>
            </div>
          }
        </div>
      </div>

      <div class="rr-controls">
        <div class="rr-info">
          <p>Tap mirrors to rotate.</p>
        </div>
        <!-- Polarizer FAB -->
        <button class="polarizer-fab"
                [class.active]="isPolarizerActive()"
                (click)="togglePolarizer()"
                [disabled]="isWon()"
                title="Toggle Polarizer (Space)">
          <div class="fab-icon">⚡</div>
          <span class="fab-label">Polarizer</span>
        </button>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    .rr-wrapper {
      display: flex; flex-direction: column; align-items: center; gap: 12px;
      padding: 12px; background: var(--surface); border-radius: var(--radius-lg);
      border: 1px solid var(--border); box-shadow: var(--shadow);
      max-width: 620px; margin: 0 auto;
    }

    /* ── status ── */
    .rr-status {
      display: flex; align-items: center; gap: 12px; flex-wrap: wrap; width: 100%;
    }
    .rr-difficulty { display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--text); }
    .rr-difficulty select {
      padding: 3px 6px; border-radius: var(--radius-sm); border: 1px solid var(--border);
      background: var(--surface-alt); color: var(--text); font-family: inherit;
    }
    .rr-moves { font-size: 0.9rem; font-weight: 600; color: var(--text-secondary); white-space: nowrap; margin-left: auto; }
    .rr-actions { display: flex; gap: 6px; }

    /* ── board ── */
    .rr-board-wrap {
      display: flex; justify-content: center; width: 100%; overflow: hidden;
    }
    .rr-board {
      position: relative; background: #080812; border-radius: var(--radius-md);
      overflow: hidden; border: 2px solid #1a1a3a;
      box-shadow: 0 0 20px rgba(0, 255, 255, 0.05), inset 0 0 30px rgba(0,0,0,0.8);
      touch-action: none; flex-shrink: 0;
    }
    .rr-grid { display: grid; width: 100%; height: 100%; }
    .rr-loading {
      width: 100%; height: 100%; display: flex; align-items: center; justify-content: center;
      color: #06b6d4; font-size: 1rem; animation: pulse 1.5s infinite;
    }

    /* ── cells ── */
    .rr-cell {
      position: relative; box-sizing: border-box;
      border: 1px solid rgba(255,255,255,0.03);
      display: flex; align-items: center; justify-content: center;
    }
    .rr-cell.wall { background: #11111f; border-color: #1a1a2e; }
    
    /* Glass blocks */
    .rr-cell.glass {
      background: rgba(6, 182, 212, 0.15);
      border: 1px solid rgba(6, 182, 212, 0.3);
      backdrop-filter: blur(2px);
      transition: all 0.3s ease;
    }
    .rr-cell.glass-on {
      background: rgba(6, 182, 212, 0.02);
      border: 1px dashed rgba(6, 182, 212, 0.5);
    }

    /* Entities */
    .rr-emitter { font-size: 1.4em; z-index: 5; text-shadow: 0 0 10px #f43f5e; }
    .rr-receptor { font-size: 1.4em; z-index: 5; filter: drop-shadow(0 0 5px #64748b); transition: all 0.3s; }
    .rr-receptor.active { filter: drop-shadow(0 0 15px #22c55e); transform: scale(1.1); }

    /* Mirrors */
    .rr-mirror {
      width: 70%; height: 70%; position: absolute;
      top: 15%; left: 15%;
      display: flex; align-items: center; justify-content: center;
      transition: transform 0.2s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    .rr-mirror.rotatable { cursor: pointer; }
    .rr-mirror.slash { transform: rotate(-45deg); }
    .rr-mirror.backslash { transform: rotate(45deg); }
    
    .mirror-bar {
      width: 100%; height: 6px; background: #e2e8f0; border-radius: 3px;
      box-shadow: 0 0 8px #94a3b8;
    }
    .rr-mirror.rotatable .mirror-bar { background: #38bdf8; box-shadow: 0 0 10px #0ea5e9; }

    /* ── Laser SVG ── */
    .rr-laser-svg {
      position: absolute; top: 0; left: 0; pointer-events: none; z-index: 10;
    }
    .rr-laser-beam {
      fill: none;
      stroke: #f43f5e; /* Rose 500 */
      stroke-width: 4px;
      stroke-linecap: round;
      stroke-linejoin: round;
      filter: drop-shadow(0 0 8px #e11d48);
      transition: stroke 0.3s, stroke-dasharray 0.3s, filter 0.3s;
    }
    .rr-laser-beam.polarized {
      stroke: #06b6d4; /* Cyan 500 */
      stroke-width: 4px;
      stroke-dasharray: 8 6;
      filter: drop-shadow(0 0 10px #0891b2);
      animation: dash-flow 0.5s linear infinite;
    }
    @keyframes dash-flow { to { stroke-dashoffset: -14; } }

    /* ── bottom controls ── */
    .rr-controls {
      display: flex; justify-content: space-between; align-items: center;
      width: 100%; padding: 0 8px;
    }
    .rr-info { color: var(--text-secondary); font-size: 0.9rem; }

    /* FAB */
    .polarizer-fab {
      width: 64px; height: 64px; border-radius: 50%;
      background: var(--surface-alt); border: 2px solid var(--border);
      color: var(--text); display: flex; flex-direction: column; align-items: center; justify-content: center;
      cursor: pointer; transition: all 0.2s; box-shadow: var(--shadow);
    }
    .polarizer-fab.active {
      background: radial-gradient(circle at 30% 30%, #06b6d4, #0891b2);
      border-color: #22d3ee; color: #fff; box-shadow: 0 0 20px rgba(6, 182, 212, 0.5);
    }
    .polarizer-fab:active { transform: scale(0.95); }
    .polarizer-fab:disabled { opacity: 0.5; cursor: not-allowed; }
    .fab-icon { font-size: 1.5rem; line-height: 1; }
    .fab-label { font-size: 0.6rem; font-weight: 600; text-transform: uppercase; margin-top: 2px; }

    /* Overlays */
    .rr-overlay {
      position: absolute; inset: 0; display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(6px); z-index: 100; border-radius: var(--radius-md);
    }
    .rr-overlay.won { background: rgba(0, 30, 0, 0.85); }
    .rr-overlay-card {
      background: var(--surface); border: 1px solid var(--border); border-radius: var(--radius-lg);
      padding: 2rem; text-align: center; box-shadow: var(--shadow-lg); color: var(--text);
    }
    .rr-overlay-card h2 { margin: 0 0 0.5rem; font-size: 1.8rem; }
    .rr-overlay-card p { color: var(--text-secondary); margin: 0 0 1rem; }
  `]
})
export class RobRayComponent implements OnInit {
  private gen = inject(RobRayGeneratorService);
  history = inject(HistoryManagerService<RobRaySnapshot>);
  private persistence = inject(PersistenceService);

  difficulty = signal<'Easy' | 'Medium' | 'Hard'>('Easy');
  puzzle = signal<GeneratedRobRay | null>(null);
  isPolarizerActive = signal<boolean>(false);
  moves = signal<number>(0);
  isWon = signal<boolean>(false);

  cellPx = computed(() => {
    const p = this.puzzle();
    if (!p) return 40;
    const available = Math.min(window.innerWidth - 48, 560);
    return Math.max(30, Math.floor(available / p.width));
  });

  boardPx = computed(() => {
    const p = this.puzzle();
    return p ? this.cellPx() * p.width : 400;
  });

  // Calculate the laser path reacting to the grid state and polarizer
  laserPoints = computed(() => {
    const p = this.puzzle();
    if (!p) return [];

    const isPol = this.isPolarizerActive();
    const pts: {x: number, y: number}[] = [];
    
    // Start at emitter
    let curX = p.emitterX;
    let curY = p.emitterY;
    const emitterCell = p.cells[curY][curX];
    let curDir = emitterCell.emitDir!;

    pts.push({x: curX, y: curY});
    const visited = new Set<string>();

    let won = false;

    while (true) {
      const stateKey = `${curX},${curY},${curDir}`;
      if (visited.has(stateKey)) break; // Prevent infinite reflection loops
      visited.add(stateKey);

      let dx = 0, dy = 0;
      if (curDir === 'N') dy = -1;
      else if (curDir === 'S') dy = 1;
      else if (curDir === 'E') dx = 1;
      else if (curDir === 'W') dx = -1;

      const nx = curX + dx;
      const ny = curY + dy;

      if (nx < 0 || ny < 0 || nx >= p.width || ny >= p.height) {
        // Off edge - draw line to the edge
        pts.push({x: curX + dx * 0.5, y: curY + dy * 0.5});
        break;
      }

      curX = nx;
      curY = ny;
      pts.push({x: curX, y: curY});

      const cell = p.cells[curY][curX];
      
      if (cell.type === 'wall') break;
      if (cell.type === 'glass' && !isPol) break;
      
      if (cell.type === 'receptor') {
        won = true;
        break;
      }

      if (cell.type === 'mirror') {
        const ori = cell.ori!;
        if (ori === '/') {
          if (curDir === 'N') curDir = 'E';
          else if (curDir === 'E') curDir = 'N';
          else if (curDir === 'S') curDir = 'W';
          else if (curDir === 'W') curDir = 'S';
        } else { // '\'
          if (curDir === 'N') curDir = 'W';
          else if (curDir === 'W') curDir = 'N';
          else if (curDir === 'S') curDir = 'E';
          else if (curDir === 'E') curDir = 'S';
        }
      }
    }

    // Schedule win check outside computed to avoid ExpressionChangedAfterItHasBeenCheckedError
    setTimeout(() => {
      if (won && !this.isWon()) {
        this.isWon.set(true);
        this.vibrate([50, 100, 50]);
      } else if (!won && this.isWon()) {
        this.isWon.set(false);
      }
    }, 0);

    return pts;
  });

  laserPointsString = computed(() => {
    const pts = this.laserPoints();
    const cp = this.cellPx();
    return pts.map(p => `${(p.x + 0.5) * cp},${(p.y + 0.5) * cp}`).join(' ');
  });

  ngOnInit() {
    this.generateNew();
  }

  generateNew(seed?: number) {
    this.history.clear();
    this.isWon.set(false);
    this.isPolarizerActive.set(false);
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

  rotateMirror(x: number, y: number) {
    if (this.isWon()) return;
    const p = this.puzzle();
    if (!p) return;
    
    const cell = p.cells[y][x];
    if (cell.type !== 'mirror' || !cell.rotatable) return;

    this.saveState();

    this.puzzle.update(grid => {
      if (!grid) return grid;
      const newGrid = {...grid, cells: grid.cells.map(r => [...r])};
      newGrid.cells[y][x] = { ...cell, ori: cell.ori === '/' ? '\\' : '/' };
      return newGrid;
    });

    this.moves.update(m => m + 1);
    this.vibrate(15);
  }

  togglePolarizer() {
    if (this.isWon()) return;
    this.saveState();
    this.isPolarizerActive.update(v => !v);
    this.moves.update(m => m + 1);
    this.vibrate(20);
  }

  saveState() {
    const p = this.puzzle();
    if (!p) return;
    
    const mirrors: {x: number, y: number, ori: '/' | '\\'}[] = [];
    for (let y = 0; y < p.height; y++) {
      for (let x = 0; x < p.width; x++) {
        const c = p.cells[y][x];
        if (c.type === 'mirror' && c.rotatable) {
          mirrors.push({x, y, ori: c.ori!});
        }
      }
    }
    
    this.history.pushState({
      mirrors,
      isPolarizerActive: this.isPolarizerActive()
    });
  }

  undo() {
    if (this.isWon()) return;
    const prev = this.history.undo();
    if (!prev) return;

    this.isPolarizerActive.set(prev.isPolarizerActive);
    
    this.puzzle.update(grid => {
      if (!grid) return grid;
      const newGrid = {...grid, cells: grid.cells.map(r => [...r])};
      for (const m of prev.mirrors) {
        const c = newGrid.cells[m.y][m.x];
        if (c.type === 'mirror') {
           newGrid.cells[m.y][m.x] = { ...c, ori: m.ori };
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
      this.togglePolarizer();
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
