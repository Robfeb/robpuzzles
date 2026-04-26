import { Component, OnInit, signal, computed, inject, effect } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryManagerService } from '../services/history-manager.service';
import { PersistenceService } from '../services/persistence.service';
import { FluidLogicService, FluidLevel } from '../services/fluid-logic.service';

@Component({
  selector: 'app-rob-weight',
  standalone: true,
  imports: [CommonModule, FormsModule],
  providers: [HistoryManagerService],
  template: `
    <div class="game-container" [class.dark]="isDark()">
      <header class="game-header">
        <div class="header-left">
          <label i18n="@@diffLabel">Difficulty:</label>
          <select [ngModel]="difficulty()" (ngModelChange)="changeDifficulty($event)">
            <option value="Easy" i18n="@@easy">Easy</option>
            <option value="Medium" i18n="@@med">Medium</option>
            <option value="Hard" i18n="@@hard">Hard</option>
          </select>
        </div>

        <div class="header-center">
          <div class="target-display">
            <span class="target-label" i18n="@@targetVolume">Target:</span>
            <span class="target-value">{{ target() }}L</span>
          </div>
        </div>

        <div class="header-right">
          <span class="move-count" i18n="@@moves">Moves: {{ moveCount() }}</span>
          <button (click)="undo()" [disabled]="!canUndo()" title="Undo" i18n-title="@@undoTitle">↩️</button>
          <button (click)="resetLevel()" title="Restart Level" i18n-title="@@restartLevelBtn">🔄</button>
        </div>
      </header>

      <main class="game-board">
        <div class="jars-container" [class.evaporator-active]="isEvaporatorActive()">
          @for (cap of capacities(); track $index) {
            <div class="jar-wrapper" 
                 [style.--jar-cap]="cap"
                 (click)="handleJarClick($index)"
                 (dragover)="$event.preventDefault()"
                 (drop)="handleDrop($event, $index)"
                 draggable="true"
                 (dragstart)="handleDragStart($event, $index)">
              
              <div class="jar-label">{{ cap }}L</div>
              
              <svg class="jar-svg" viewBox="0 0 100 120" preserveAspectRatio="xMidYMax meet">
                <defs>
                  <clipPath [id]="'fluid-clip-' + $index">
                    <rect x="0" [attr.y]="120 - (volumes()[$index] / cap * 100)" width="100" height="120" />
                  </clipPath>
                </defs>
                
                <!-- Jar Outline -->
                <path d="M20,10 L80,10 L85,110 Q85,115 80,115 L20,115 Q15,115 15,110 L20,10" 
                      fill="none" 
                      stroke="currentColor" 
                      stroke-width="3" />
                
                <!-- Fluid -->
                <path [attr.clip-path]="'url(#fluid-clip-' + $index + ')'"
                      d="M20,10 L80,10 L85,110 Q85,115 80,115 L20,115 Q15,115 15,110 L20,10" 
                      [attr.fill]="getFluidColor($index)"
                      class="fluid-body" />

                <!-- Current Volume Text -->
                <text x="50" y="70" text-anchor="middle" class="vol-text" [class.empty]="volumes()[$index] === 0">
                  {{ volumes()[$index] }}
                </text>
              </svg>

              <!-- Context Menu (Desktop/Tap) -->
              <div class="jar-actions">
                <button (click)="$event.stopPropagation(); fillJar($index)" [disabled]="volumes()[$index] === cap">Fill</button>
                <button (click)="$event.stopPropagation(); emptyJar($index)" [disabled]="volumes()[$index] === 0">Empty</button>
              </div>
            </div>
          }
        </div>

        @if (showWinOverlay()) {
          <div class="win-overlay">
            <div class="win-content">
              <h2 i18n="@@winTitle">🧪 Target Reached!</h2>
              <p i18n="@@winDesc">You managed to measure {{ target() }}L in {{ moveCount() }} moves.</p>
              <button class="next-btn" (click)="generateLevel()" i18n="@@nextPuzzle">Next Level ⏭️</button>
            </div>
          </div>
        }
      </main>

      <footer class="game-footer">
        <p i18n="@@weightInfo">Drag one jar to another to pour. Tap a jar to fill/empty. Use the Evaporator to remove 1L at a time.</p>
        
        <button class="evaporator-toggle" 
                [class.active]="isEvaporatorActive()" 
                (click)="toggleEvaporator()"
                title="Toggle Evaporator Mode"
                i18n-title="@@evaporatorTitle">
          💨 EVAPORATOR
        </button>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .game-container {
      display: flex;
      flex-direction: column;
      height: 100%;
      background: var(--bg-primary, #f8fafc);
      color: var(--text-primary, #1e293b);
      font-family: 'Inter', system-ui, sans-serif;
    }
    .game-header {
      padding: 1rem;
      display: flex;
      justify-content: space-between;
      align-items: center;
      background: var(--surface, #ffffff);
      border-bottom: 1px solid var(--border, #e2e8f0);
      box-shadow: 0 1px 3px rgba(0,0,0,0.05);
    }
    .target-display {
      background: var(--primary, #3b82f6);
      color: white;
      padding: 0.5rem 1.5rem;
      border-radius: 2rem;
      font-weight: 800;
      box-shadow: 0 4px 6px -1px rgba(59, 130, 246, 0.5);
    }
    .game-board {
      flex: 1;
      position: relative;
      display: flex;
      justify-content: center;
      align-items: center;
      padding: 2rem;
      overflow: hidden;
    }
    .jars-container {
      display: flex;
      gap: 3rem;
      align-items: flex-end;
      flex-wrap: wrap;
      justify-content: center;
    }
    .jar-wrapper {
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 1rem;
      cursor: grab;
      transition: transform 0.2s;
    }
    .jar-wrapper:active { cursor: grabbing; }
    .jar-wrapper:hover { transform: translateY(-5px); }
    
    .jar-svg {
      width: 120px;
      height: 150px;
      filter: drop-shadow(0 10px 15px rgba(0,0,0,0.1));
    }
    .fluid-body {
      transition: all 0.5s cubic-bezier(0.4, 0, 0.2, 1);
    }
    .vol-text {
      font-size: 24px;
      font-weight: 900;
      fill: white;
      stroke: rgba(0,0,0,0.3);
      stroke-width: 1px;
      paint-order: stroke;
    }
    .vol-text.empty { fill: var(--text-secondary, #64748b); stroke: none; }
    
    .jar-actions {
      display: flex;
      gap: 0.5rem;
      opacity: 0.6;
      transition: opacity 0.2s;
    }
    .jar-wrapper:hover .jar-actions { opacity: 1; }
    .jar-actions button {
      padding: 0.25rem 0.75rem;
      font-size: 0.8rem;
      border-radius: 0.4rem;
      border: 1px solid var(--border);
      background: var(--surface);
      cursor: pointer;
    }

    .evaporator-active .jar-wrapper {
      cursor: crosshair;
      animation: pulse-red 2s infinite;
    }
    @keyframes pulse-red {
      0% { filter: drop-shadow(0 0 0px rgba(239, 68, 68, 0)); }
      50% { filter: drop-shadow(0 0 10px rgba(239, 68, 68, 0.5)); }
      100% { filter: drop-shadow(0 0 0px rgba(239, 68, 68, 0)); }
    }

    .evaporator-toggle {
      padding: 1rem 2rem;
      border-radius: 3rem;
      border: none;
      background: #475569;
      color: white;
      font-weight: 800;
      letter-spacing: 1px;
      cursor: pointer;
      box-shadow: 0 4px 6px rgba(0,0,0,0.1);
      transition: all 0.3s;
    }
    .evaporator-toggle.active {
      background: #ef4444;
      box-shadow: 0 0 20px rgba(239, 68, 68, 0.6);
      transform: scale(1.1);
    }

    .win-overlay {
      position: absolute;
      inset: 0;
      background: rgba(15, 23, 42, 0.8);
      backdrop-filter: blur(8px);
      display: flex;
      justify-content: center;
      align-items: center;
      z-index: 100;
    }
    .win-content {
      background: white;
      padding: 3rem;
      border-radius: 1.5rem;
      text-align: center;
      box-shadow: 0 20px 25px -5px rgba(0,0,0,0.1);
      animation: zoomIn 0.5s cubic-bezier(0.34, 1.56, 0.64, 1);
    }
    @keyframes zoomIn { from { opacity: 0; transform: scale(0.8); } to { opacity: 1; transform: scale(1); } }

    .game-footer {
      padding: 1.5rem;
      background: var(--surface);
      border-top: 1px solid var(--border);
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    @media (max-width: 600px) {
      .jars-container { flex-direction: column; gap: 1.5rem; }
      .game-board { overflow-y: auto; }
    }
  `]
})
export class RoboWeightComponent implements OnInit {
  private history = inject(HistoryManagerService<any>);
  private persistence = inject(PersistenceService);
  private logic = inject(FluidLogicService);

  difficulty = signal<'Easy' | 'Medium' | 'Hard'>('Easy');
  capacities = signal<number[]>([]);
  target = signal<number>(0);
  volumes = signal<number[]>([]);
  moveCount = signal<number>(0);
  isEvaporatorActive = signal<boolean>(false);
  showWinOverlay = signal<boolean>(false);

  canUndo = computed(() => this.moveCount() > 0);
  isDark = signal<boolean>(false);

  constructor() {
    effect(() => {
      if (this.volumes().some(v => v === this.target())) {
        this.showWinOverlay.set(true);
      }
    });
  }

  ngOnInit() {
    const saved = this.persistence.loadGameState('rob-weight');
    if (saved) {
      this.capacities.set(saved.capacities);
      this.target.set(saved.target);
      this.volumes.set(saved.volumes);
      this.moveCount.set(saved.moveCount);
      this.difficulty.set(saved.difficulty);
    } else {
      this.generateLevel();
    }
    this.isDark.set(document.body.classList.contains('dark-theme'));
  }

  generateLevel() {
    const level = this.logic.generate(this.difficulty());
    this.capacities.set(level.capacities);
    this.target.set(level.target);
    this.volumes.set(level.initialVolumes);
    this.moveCount.set(0);
    this.showWinOverlay.set(false);
    this.history.clear();
    this.saveState();
  }

  changeDifficulty(d: 'Easy' | 'Medium' | 'Hard') {
    this.difficulty.set(d);
    this.generateLevel();
  }

  handleJarClick(index: number) {
    if (this.isEvaporatorActive()) {
      this.evaporate(index);
    }
  }

  fillJar(index: number) {
    if (this.volumes()[index] === this.capacities()[index]) return;
    this.executeAction(() => {
      const v = [...this.volumes()];
      v[index] = this.capacities()[index];
      this.volumes.set(v);
    });
  }

  emptyJar(index: number) {
    if (this.volumes()[index] === 0) return;
    this.executeAction(() => {
      const v = [...this.volumes()];
      v[index] = 0;
      this.volumes.set(v);
    });
  }

  pour(from: number, to: number) {
    if (from === to) return;
    const vFrom = this.volumes()[from];
    const vTo = this.volumes()[to];
    const cTo = this.capacities()[to];

    if (vFrom === 0 || vTo === cTo) return;

    this.executeAction(() => {
      const amount = Math.min(vFrom, cTo - vTo);
      const v = [...this.volumes()];
      v[from] -= amount;
      v[to] += amount;
      this.volumes.set(v);
      if (navigator.vibrate) navigator.vibrate(20);
    });
  }

  evaporate(index: number) {
    if (this.volumes()[index] === 0) return;
    this.executeAction(() => {
      const v = [...this.volumes()];
      v[index] -= 1;
      this.volumes.set(v);
      if (navigator.vibrate) navigator.vibrate([10, 10]);
    });
  }

  private executeAction(fn: () => void) {
    const prevState = { volumes: [...this.volumes()], moveCount: this.moveCount() };
    fn();
    this.moveCount.set(this.moveCount() + 1);
    
    this.history.pushState(prevState);
    this.saveState();
  }

  undo() {
    const prev = this.history.undo();
    if (prev) {
      this.volumes.set(prev.volumes);
      this.moveCount.set(prev.moveCount);
    }
  }

  resetLevel() {
    this.volumes.set(new Array(this.capacities().length).fill(0));
    this.moveCount.set(0);
    this.history.clear();
    this.showWinOverlay.set(false);
  }

  toggleEvaporator() {
    this.isEvaporatorActive.set(!this.isEvaporatorActive());
  }

  handleDragStart(event: DragEvent, index: number) {
    event.dataTransfer?.setData('text/plain', index.toString());
  }

  handleDrop(event: DragEvent, toIndex: number) {
    event.preventDefault();
    const fromIndex = parseInt(event.dataTransfer?.getData('text/plain') || '-1');
    if (fromIndex !== -1 && fromIndex !== toIndex) {
      this.pour(fromIndex, toIndex);
    }
  }

  getFluidColor(index: number): string {
    const colors = ['#3b82f6', '#10b981', '#f59e0b'];
    return colors[index % colors.length];
  }

  private saveState() {
    this.persistence.saveGameState('rob-weight', {
      capacities: this.capacities(),
      target: this.target(),
      volumes: this.volumes(),
      moveCount: this.moveCount(),
      difficulty: this.difficulty()
    });
  }
}
