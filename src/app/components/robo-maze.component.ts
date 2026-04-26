import {
  Component, signal, computed, inject, OnInit, OnDestroy,
  HostListener, ElementRef, viewChild
} from '@angular/core';
import { CommonModule } from '@angular/common';
import { RoboMazeGeneratorService, GeneratedMaze, MazeCell } from '../services/robo-maze-generator.service';
import { HistoryManagerService } from '../services/history-manager.service';
import { PersistenceService } from '../services/persistence.service';

interface RoboMazeSnapshot {
  robot: { x: number; y: number };
  energy: number;
}

@Component({
  selector: 'app-robo-maze',
  standalone: true,
  imports: [CommonModule],
  providers: [HistoryManagerService],
  template: `
    <div class="rm-wrapper">

      <!-- ── Status bar ── -->
      <div class="rm-status">
        <div class="rm-difficulty">
          <label>Difficulty:</label>
          <select [value]="difficulty()" (change)="onDiffChange($event)">
            <option value="Easy">Easy</option>
            <option value="Medium">Medium</option>
            <option value="Hard">Hard</option>
          </select>
        </div>
        <div class="rm-energy" [class.low]="energyPct() <= 20" [class.critical]="energyPct() <= 10">
          ⚡ {{ energy() }} / {{ maxEnergy() }}
          @if (maze()?.shortestPath) {
            <span class="rm-optimal">Optimal: {{ maze()!.shortestPath }} steps</span>
          }
          <div class="energy-bar">
            <div class="energy-fill" [style.width.%]="energyPct()" [class.low]="energyPct() <= 20"></div>
          </div>
        </div>
        <div class="rm-moves">👣 {{ moves() }}</div>
        <div class="rm-actions">
          <button class="icon-btn" (click)="undo()" [disabled]="!history.canUndo() || isGameOver() || isWon()" title="Undo (U)">↩️</button>
          <button class="icon-btn" (click)="generateNew()" title="New Maze">⏭️</button>
          <button class="icon-btn" (click)="resetMaze()" title="Restart">🔄</button>
        </div>
      </div>

      <!-- ── Maze board ── -->
      <div class="rm-board-wrap">
        <div class="rm-board"
             #mazeBoard
             [class.scan-active]="isScanActive()"
             (touchstart)="onTouchStart($event)"
             (touchend)="onTouchEnd($event)"
             [style.width.px]="boardPx()"
             [style.height.px]="boardPx()">

          @if (maze()) {
            <div class="rm-grid"
                 [style.gridTemplateColumns]="'repeat(' + maze()!.width + ', ' + cellPx() + 'px)'"
                 [style.gridTemplateRows]="'repeat(' + maze()!.height + ', ' + cellPx() + 'px)'">

              @for (row of maze()!.cells; track $index) {
                @for (cell of row; track cell.x) {
                  <div class="rm-cell"
                       [class.fog]="isFog(cell.x, cell.y)"
                       [class.dim]="isDim(cell.x, cell.y)"
                       [class.lit]="isLit(cell.x, cell.y)"
                       [class.is-exit]="isExit(cell.x, cell.y)"
                       [class.wall-n]="cell.walls.N"
                       [class.wall-s]="cell.walls.S"
                       [class.wall-e]="cell.walls.E"
                       [class.wall-w]="cell.walls.W">
                    @if (robot().x === cell.x && robot().y === cell.y) {
                      <div class="robot-dot"></div>
                    }
                    @if (isExit(cell.x, cell.y)) {
                      <div class="exit-marker">🚪</div>
                    }
                  </div>
                }
              }
            </div>
          } @else {
            <div class="rm-loading">Generating Maze…</div>
          }

          <!-- Win / Game Over overlays -->
          @if (isWon()) {
            <div class="rm-overlay won">
              <div class="rm-overlay-card">
                <h2>🎉 Maze Cleared!</h2>
                <p>Escaped in <strong>{{ moves() }}</strong> moves<br>with <strong>{{ energy() }}</strong> energy remaining.</p>
                <button class="primary" (click)="generateNew()">Next Maze ⏭️</button>
              </div>
            </div>
          }
          @if (isGameOver()) {
            <div class="rm-overlay gameover">
              <div class="rm-overlay-card">
                <h2>💀 Out of Energy!</h2>
                <p>The robot shut down in the darkness.</p>
                <div style="display:flex;gap:10px;justify-content:center;margin-top:12px">
                  <button class="primary" (click)="resetMaze()">Try Again 🔄</button>
                  <button class="text-btn" (click)="generateNew()">New Maze ⏭️</button>
                </div>
              </div>
            </div>
          }
        </div>
      </div>

      <!-- ── Bottom controls ── -->
      <div class="rm-controls">
        <!-- D-Pad -->
        <div class="rm-dpad">
          <button class="dpad-btn" (click)="move(0,-1)">▲</button>
          <div class="dpad-row">
            <button class="dpad-btn" (click)="move(-1,0)">◀</button>
            <div class="dpad-center">🤖</div>
            <button class="dpad-btn" (click)="move(1,0)">▶</button>
          </div>
          <button class="dpad-btn" (click)="move(0,1)">▼</button>
        </div>

        <!-- Sonar FAB -->
        <button class="sonar-fab"
                (click)="activateSonar()"
                [disabled]="energy() < sonarCost() || isScanActive() || isGameOver() || isWon()"
                title="Sonar Scan (Q) — costs {{ sonarCost() }} energy">
          📡
          <span class="sonar-cost">-{{ sonarCost() }}⚡</span>
        </button>
      </div>

    </div>
  `,
  styles: [`
    :host { display: block; width: 100%; }

    /* ── wrapper ── */
    .rm-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 12px;
      padding: 12px;
      background: var(--surface);
      border-radius: var(--radius-lg);
      border: 1px solid var(--border);
      box-shadow: var(--shadow);
      max-width: 620px;
      margin: 0 auto;
    }

    /* ── status ── */
    .rm-status {
      display: flex;
      align-items: center;
      gap: 12px;
      flex-wrap: wrap;
      width: 100%;
    }
    .rm-difficulty { display: flex; align-items: center; gap: 6px; font-weight: 600; color: var(--text); }
    .rm-difficulty select {
      padding: 3px 6px; border-radius: var(--radius-sm);
      border: 1px solid var(--border); background: var(--surface-alt);
      color: var(--text); font-family: inherit;
    }
    .rm-energy {
      display: flex; flex-direction: column; gap: 2px;
      font-size: 0.85rem; font-weight: 700; color: var(--text);
      min-width: 110px;
    }
    .rm-energy.low  { color: #f59e0b; }
    .rm-energy.critical { color: #ef4444; animation: pulse 0.8s infinite; }
    .energy-bar {
      width: 100%; height: 6px; background: var(--border);
      border-radius: 99px; overflow: hidden;
    }
    .energy-fill {
      height: 100%; background: #22d3ee;
      border-radius: 99px; transition: width 0.3s ease;
    }
    .energy-fill.low { background: #f59e0b; }
    .rm-moves { font-size: 0.85rem; font-weight: 600; color: var(--text-secondary); white-space: nowrap; }
    .rm-optimal { font-size: 0.7rem; font-weight: 400; color: var(--text-muted); }
    .rm-actions { display: flex; gap: 6px; margin-left: auto; }

    /* ── board ── */
    .rm-board-wrap {
      display: flex; justify-content: center;
      width: 100%; overflow: hidden;
    }
    .rm-board {
      position: relative;
      background: #000;
      border-radius: var(--radius-md);
      overflow: hidden;
      border: 2px solid #1e3a5f;
      box-shadow: 0 0 30px rgba(0, 150, 255, 0.15), inset 0 0 20px rgba(0,0,0,0.8);
      touch-action: none;
      flex-shrink: 0;
    }
    .rm-board.scan-active { box-shadow: 0 0 50px rgba(0, 200, 255, 0.6), inset 0 0 30px rgba(0,180,255,0.1); }
    .rm-grid {
      display: grid;
      width: 100%; height: 100%;
    }
    .rm-loading {
      width: 100%; height: 100%;
      display: flex; align-items: center; justify-content: center;
      color: #22d3ee; font-size: 1rem;
      animation: pulse 1.5s infinite;
    }

    /* ── cells ── */
    .rm-cell {
      position: relative;
      background: #000;
      transition: background 0.4s ease;
      box-sizing: border-box;
    }
    /* Wall borders */
    .rm-cell.wall-n { border-top:    2px solid #1e3a5f; }
    .rm-cell.wall-s { border-bottom: 2px solid #1e3a5f; }
    .rm-cell.wall-e { border-right:  2px solid #1e3a5f; }
    .rm-cell.wall-w { border-left:   2px solid #1e3a5f; }

    /* Fog states */
    .rm-cell.fog   { background: #000 !important; }
    .rm-cell.fog.wall-n { border-top-color: transparent; }
    .rm-cell.fog.wall-s { border-bottom-color: transparent; }
    .rm-cell.fog.wall-e { border-right-color: transparent; }
    .rm-cell.fog.wall-w { border-left-color: transparent; }

    .rm-cell.dim   { background: #070b14; }
    .rm-cell.lit   { background: #0d1a2e; }

    /* Sonar override — brief flash */
    .scan-active .rm-cell.fog,
    .scan-active .rm-cell.dim { background: #051020 !important; }
    .scan-active .rm-cell.fog.wall-n { border-top-color: #1e3a5f; }
    .scan-active .rm-cell.fog.wall-s { border-bottom-color: #1e3a5f; }
    .scan-active .rm-cell.fog.wall-e { border-right-color: #1e3a5f; }
    .scan-active .rm-cell.fog.wall-w { border-left-color: #1e3a5f; }

    /* Robot */
    .robot-dot {
      position: absolute;
      width: 55%; height: 55%;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      background: radial-gradient(circle, #67e8f9 0%, #0891b2 60%, transparent 100%);
      border-radius: 50%;
      box-shadow: 0 0 10px #22d3ee, 0 0 20px #0891b2;
      animation: robot-pulse 1.8s ease-in-out infinite;
      z-index: 10;
    }
    @keyframes robot-pulse {
      0%, 100% { box-shadow: 0 0 8px #22d3ee, 0 0 16px #0891b2; }
      50%       { box-shadow: 0 0 16px #67e8f9, 0 0 30px #0891b2; }
    }

    /* Exit */
    .rm-cell.is-exit { background: #0a1a0a !important; }
    .exit-marker {
      position: absolute;
      top: 50%; left: 50%;
      transform: translate(-50%, -50%);
      font-size: 1.1em;
      z-index: 5;
      filter: drop-shadow(0 0 6px #22c55e);
      animation: exit-pulse 2s ease-in-out infinite;
    }
    @keyframes exit-pulse {
      0%, 100% { filter: drop-shadow(0 0 4px #22c55e); }
      50%       { filter: drop-shadow(0 0 12px #4ade80); }
    }

    /* ── bottom controls ── */
    .rm-controls {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      width: 100%;
      padding: 0 8px;
    }

    /* D-Pad */
    .rm-dpad { display: flex; flex-direction: column; align-items: center; gap: 4px; }
    .dpad-row { display: flex; align-items: center; gap: 4px; }
    .dpad-btn {
      width: 52px; height: 52px;
      background: var(--surface-alt); border: 1px solid var(--border);
      border-radius: var(--radius-sm); color: var(--text);
      font-size: 1.3rem; cursor: pointer;
      display: flex; align-items: center; justify-content: center;
      transition: background 0.12s, transform 0.08s;
    }
    .dpad-btn:active { background: #0891b2; color: #fff; transform: scale(0.93); }
    .dpad-center {
      width: 52px; height: 52px;
      display: flex; align-items: center; justify-content: center;
      font-size: 1.4rem;
    }

    /* Sonar FAB */
    .sonar-fab {
      width: 72px; height: 72px;
      border-radius: 50%;
      background: radial-gradient(circle at 40% 35%, #1e40af, #0c1a4a);
      border: 2px solid #3b82f6;
      color: #fff; font-size: 2rem;
      cursor: pointer;
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      gap: 2px;
      box-shadow: 0 0 18px rgba(59, 130, 246, 0.4);
      transition: box-shadow 0.2s, transform 0.15s;
      position: relative;
    }
    .sonar-fab:hover:not(:disabled) {
      box-shadow: 0 0 30px rgba(59, 130, 246, 0.7);
      transform: scale(1.06);
    }
    .sonar-fab:disabled { opacity: 0.4; cursor: not-allowed; }
    .sonar-cost { font-size: 0.5rem; opacity: 0.8; }

    /* Overlays */
    .rm-overlay {
      position: absolute; inset: 0;
      display: flex; align-items: center; justify-content: center;
      backdrop-filter: blur(6px); z-index: 100;
      border-radius: var(--radius-md);
    }
    .rm-overlay.won      { background: rgba(0, 20, 0, 0.85); }
    .rm-overlay.gameover { background: rgba(20, 0, 0, 0.85); }
    .rm-overlay-card {
      background: var(--surface);
      border: 1px solid var(--border);
      border-radius: var(--radius-lg);
      padding: 2rem; text-align: center;
      box-shadow: var(--shadow-lg);
      color: var(--text);
    }
    .rm-overlay-card h2 { margin: 0 0 0.5rem; font-size: 1.8rem; }
    .rm-overlay-card p  { color: var(--text-secondary); margin: 0 0 0.5rem; }

    @keyframes pulse {
      0%, 100% { opacity: 0.6; }
      50%       { opacity: 1; }
    }
  `]
})
export class RoboMazeComponent implements OnInit, OnDestroy {
  private gen = inject(RoboMazeGeneratorService);
  history = inject(HistoryManagerService<RoboMazeSnapshot>);
  private persistence = inject(PersistenceService);
  private boardRef = viewChild<ElementRef>('mazeBoard');

  difficulty = signal<'Easy' | 'Medium' | 'Hard'>('Easy');
  maze       = signal<GeneratedMaze | null>(null);
  robot      = signal<{ x: number; y: number }>({ x: 0, y: 0 });
  energy     = signal<number>(120);
  maxEnergy  = signal<number>(120);
  moves      = signal<number>(0);
  isWon      = signal<boolean>(false);
  isGameOver = signal<boolean>(false);
  isScanActive = signal<boolean>(false);

  /** Cells permanently revealed (cumulative) */
  private revealedSet = new Set<string>();

  /** Cells currently within vision radius */
  private litSet = computed(() => {
    const r = this.robot();
    const m = this.maze();
    if (!m) return new Set<string>();
    const radius = m.fogRadius;
    const s = new Set<string>();
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = r.x + dx, ny = r.y + dy;
        if (nx >= 0 && ny >= 0 && nx < m.width && ny < m.height) {
          s.add(`${nx},${ny}`);
        }
      }
    }
    return s;
  });

  // Re-render trigger whenever robot or scan changes
  private _renderTick = signal<number>(0);

  energyPct = computed(() => Math.round((this.energy() / this.maxEnergy()) * 100));
  sonarCost = computed(() => this.maze()?.sonarCost ?? 10);

  cellPx = computed(() => {
    const m = this.maze();
    if (!m) return 30;
    const available = Math.min(window.innerWidth - 48, 560);
    return Math.max(16, Math.floor(available / m.width));
  });

  boardPx = computed(() => {
    const m = this.maze();
    return m ? this.cellPx() * m.width : 400;
  });

  private scanTimer: any;
  private touchStartX = 0;
  private touchStartY = 0;

  ngOnInit() {
    const params = new URLSearchParams(window.location.search);
    const seedParam = params.get('maze');
    const seed = seedParam ? this.gen.decodeSeed(seedParam) : undefined;
    this.generateNew(seed);
  }

  ngOnDestroy() { clearTimeout(this.scanTimer); }

  // ── Cell visibility helpers ──────────────────────────────────────────────
  isFog(x: number, y: number): boolean {
    this._renderTick(); // subscribe to re-render
    return !this.revealedSet.has(`${x},${y}`) && !this.isScanActive();
  }

  isDim(x: number, y: number): boolean {
    if (this.isScanActive()) return false;
    return this.revealedSet.has(`${x},${y}`) && !this.litSet().has(`${x},${y}`);
  }

  isLit(x: number, y: number): boolean {
    return this.litSet().has(`${x},${y}`);
  }

  isExit(x: number, y: number): boolean {
    const m = this.maze();
    return !!m && m.exitX === x && m.exitY === y;
  }

  // ── Generation ───────────────────────────────────────────────────────────
  generateNew(seed?: number) {
    clearTimeout(this.scanTimer);
    this.maze.set(null);
    this.isWon.set(false);
    this.isGameOver.set(false);
    this.isScanActive.set(false);
    this.moves.set(0);
    this.history.clear();
    this.revealedSet.clear();

    setTimeout(() => {
      const generated = this.gen.generate(this.difficulty(), seed);
      this.maze.set(generated);
      this.maxEnergy.set(generated.maxEnergy);
      this.energy.set(generated.maxEnergy);
      this.robot.set({ x: generated.startX, y: generated.startY });
      this.revealAround();
    }, 30);
  }

  resetMaze() {
    const m = this.maze();
    if (!m) return;
    clearTimeout(this.scanTimer);
    this.isWon.set(false);
    this.isGameOver.set(false);
    this.isScanActive.set(false);
    this.moves.set(0);
    this.history.clear();
    this.revealedSet.clear();
    this.energy.set(m.maxEnergy);
    this.robot.set({ x: m.startX, y: m.startY });
    this.revealAround();
  }

  onDiffChange(event: Event) {
    this.difficulty.set((event.target as HTMLSelectElement).value as any);
    this.generateNew();
  }

  // ── Movement ─────────────────────────────────────────────────────────────
  move(dx: number, dy: number) {
    if (this.isWon() || this.isGameOver()) return;
    const m = this.maze();
    if (!m) return;

    const { x, y } = this.robot();
    const cell = m.cells[y][x];

    // Check wall in direction
    if (dx === 1  && cell.walls.E) return;
    if (dx === -1 && cell.walls.W) return;
    if (dy === 1  && cell.walls.S) return;
    if (dy === -1 && cell.walls.N) return;

    const nx = x + dx, ny = y + dy;
    if (nx < 0 || ny < 0 || nx >= m.width || ny >= m.height) return;

    // Snapshot for undo
    this.history.pushState({ robot: { x, y }, energy: this.energy() });

    // Apply move
    this.robot.set({ x: nx, y: ny });
    this.energy.update(e => e - 1);
    this.moves.update(n => n + 1);
    this.revealAround();

    // Haptic
    this.vibrate(8);

    // Low-energy warning
    if (this.energyPct() <= 20 && this.energyPct() > 10) this.vibrate([20, 40, 20]);

    // Win check
    if (nx === m.exitX && ny === m.exitY) { this.isWon.set(true); return; }

    // Energy depleted
    if (this.energy() <= 0) {
      this.energy.set(0);
      this.isGameOver.set(true);
      this.vibrate([100, 50, 100]);
    }
  }

  // ── Sonar ────────────────────────────────────────────────────────────────
  activateSonar() {
    const cost = this.sonarCost();
    if (this.isScanActive() || this.energy() < cost || this.isGameOver() || this.isWon()) return;
    this.energy.update(e => e - cost);
    this.isScanActive.set(true);
    this.vibrate([30, 50, 30]);
    this._renderTick.update(n => n + 1);

    clearTimeout(this.scanTimer);
    this.scanTimer = setTimeout(() => {
      this.isScanActive.set(false);
      this._renderTick.update(n => n + 1);
    }, 1500);

    if (this.energy() <= 0) { this.energy.set(0); this.isGameOver.set(true); }
  }

  // ── Undo ─────────────────────────────────────────────────────────────────
  undo() {
    if (this.isWon() || this.isGameOver()) return;
    const prev = this.history.undo();
    if (!prev) return;
    this.robot.set(prev.robot);
    this.energy.set(prev.energy);
    this.moves.update(n => Math.max(0, n - 1));
    this.revealAround(); // re-reveal from restored position
  }

  // ── Keyboard ─────────────────────────────────────────────────────────────
  @HostListener('window:keydown', ['$event'])
  onKey(e: KeyboardEvent) {
    if (this.isWon()) { if (e.key === 'Enter') { this.generateNew(); } return; }
    if (this.isGameOver()) { if (e.key === 'Enter' || e.key === 'r') { this.resetMaze(); } return; }

    switch (e.key) {
      case 'ArrowUp':    case 'w': case 'W': this.move(0, -1); e.preventDefault(); break;
      case 'ArrowDown':  case 's': case 'S': this.move(0,  1); e.preventDefault(); break;
      case 'ArrowLeft':  case 'a': case 'A': this.move(-1, 0); e.preventDefault(); break;
      case 'ArrowRight': case 'd': case 'D': this.move(1,  0); e.preventDefault(); break;
      case 'u': case 'U': case 'z': case 'Z': this.undo(); break;
      case 'q': case 'Q': this.activateSonar(); break;
    }
  }

  // ── Touch / Swipe ─────────────────────────────────────────────────────────
  onTouchStart(e: TouchEvent) {
    this.touchStartX = e.touches[0].clientX;
    this.touchStartY = e.touches[0].clientY;
  }

  onTouchEnd(e: TouchEvent) {
    const dx = e.changedTouches[0].clientX - this.touchStartX;
    const dy = e.changedTouches[0].clientY - this.touchStartY;
    const threshold = 20;
    if (Math.abs(dx) < threshold && Math.abs(dy) < threshold) return;
    if (Math.abs(dx) > Math.abs(dy)) {
      this.move(dx > 0 ? 1 : -1, 0);
    } else {
      this.move(0, dy > 0 ? 1 : -1);
    }
  }

  // ── Helpers ───────────────────────────────────────────────────────────────
  private revealAround() {
    const r = this.robot();
    const m = this.maze();
    if (!m) return;
    const radius = m.fogRadius;
    for (let dy = -radius; dy <= radius; dy++) {
      for (let dx = -radius; dx <= radius; dx++) {
        const nx = r.x + dx, ny = r.y + dy;
        if (nx >= 0 && ny >= 0 && nx < m.width && ny < m.height) {
          this.revealedSet.add(`${nx},${ny}`);
        }
      }
    }
    this._renderTick.update(n => n + 1);
  }

  private vibrate(pattern: number | number[]) {
    try { navigator.vibrate?.(pattern); } catch { /* ignore */ }
  }
}
