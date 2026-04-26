import { Component, OnInit, signal, computed, inject, effect, ElementRef, ViewChildren, QueryList } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { HistoryManagerService } from '../services/history-manager.service';
import { PersistenceService } from '../services/persistence.service';
import { SortLogicService, SortState } from '../services/sort-logic.service';

@Component({
  selector: 'app-robo-sort',
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
          <div class="pocket-slot" 
               [class.active]="isPocketMode()" 
               [class.filled]="pocketCore() !== null"
               (click)="handlePocketClick()">
            <div class="pocket-label" i18n="@@deepPocket">DEEP POCKET</div>
            <div class="core-slot">
              @if (pocketCore()) {
                <div class="core" [style.background]="pocketCore()" [style.box-shadow]="'0 0 15px ' + pocketCore()"></div>
              }
            </div>
          </div>
        </div>

        <div class="header-right">
          <span class="move-count" i18n="@@moves">Moves: {{ moveCount() }}</span>
          <button (click)="undo()" [disabled]="!canUndo()" title="Undo" i18n-title="@@undoTitle">↩️</button>
          <button (click)="resetLevel()" title="Restart" i18n-title="@@resetTitle">🔄</button>
        </div>
      </header>

      <main class="game-board">
        <div class="tubes-grid">
          @for (tube of tubes(); track $index; let tubeIdx = $index) {
            <div class="tube-container" 
                 [class.selected]="selectedTube() === tubeIdx"
                 (click)="handleTubeClick(tubeIdx)"
                 (dragover)="$event.preventDefault()"
                 (drop)="handleDrop($event, tubeIdx)"
                 [attr.data-index]="tubeIdx">
              <div class="tube-glass">
                <div class="core-stack">
                  @for (coreColor of tube; track $index) {
                    <div class="core" 
                         [style.background]="coreColor"
                         [style.box-shadow]="'0 0 15px ' + coreColor"
                         draggable="true"
                         (dragstart)="handleDragStart($event, tubeIdx)">
                    </div>
                  }
                </div>
              </div>
              <div class="tube-base"></div>
            </div>
          }
        </div>

        @if (showWinOverlay()) {
          <div class="win-overlay">
            <div class="win-content">
              <h2 i18n="@@sortComplete">🔋 Core Sequence Optimized!</h2>
              <p i18n="@@winDesc">All energy cores sorted in {{ moveCount() }} moves.</p>
              <button class="next-btn" (click)="generateLevel()" i18n="@@nextPuzzle">Next Level ⏭️</button>
            </div>
          </div>
        }
      </main>

      <footer class="game-footer">
        <p i18n="@@sortInfo">Tap a tube to select the top core, then tap another to move. Or use the Deep Pocket for temporary storage.</p>
        <button class="pocket-toggle" [class.active]="isPocketMode()" (click)="togglePocketMode()">
          🗃️ {{ isPocketMode() ? 'EXIT POCKET MODE' : 'DEEP POCKET MODE' }}
        </button>
      </footer>
    </div>
  `,
  styles: [`
    :host { display: block; height: 100%; }
    .game-container {
      display: flex; flex-direction: column; height: 100%;
      background: var(--bg-primary, #0f172a);
      color: #f8fafc; font-family: 'Outfit', sans-serif;
    }
    .game-header {
      padding: 1rem; display: flex; justify-content: space-between; align-items: center;
      background: rgba(30, 41, 59, 0.8); backdrop-filter: blur(10px);
      border-bottom: 1px solid rgba(255,255,255,0.1);
    }
    
    /* Deep Pocket Slot */
    .pocket-slot {
      display: flex; flex-direction: column; align-items: center; gap: 4px;
      padding: 6px 12px; border-radius: 12px;
      background: rgba(0,0,0,0.3); border: 1px solid rgba(255,255,255,0.1);
      cursor: pointer; transition: all 0.3s;
    }
    .pocket-slot.active { border-color: #3b82f6; box-shadow: 0 0 15px rgba(59, 130, 246, 0.3); }
    .pocket-label { font-size: 0.6rem; font-weight: 800; color: #94a3b8; }
    .core-slot {
      width: 32px; height: 32px; border-radius: 50%;
      background: rgba(255,255,255,0.05); border: 1px dashed rgba(255,255,255,0.2);
      display: flex; justify-content: center; align-items: center;
    }
    .pocket-slot.filled .core-slot { border-style: solid; border-color: rgba(255,255,255,0.4); }

    .game-board {
      flex: 1; display: flex; justify-content: center; align-items: center;
      padding: 2rem; position: relative;
    }
    .tubes-grid {
      display: flex; gap: 2rem; flex-wrap: wrap; justify-content: center;
      align-items: flex-end; perspective: 1000px;
    }

    /* Tube Rendering */
    .tube-container {
      display: flex; flex-direction: column; align-items: center;
      cursor: pointer; transition: transform 0.2s;
    }
    .tube-container.selected { transform: translateY(-10px); }
    .tube-glass {
      width: 60px; height: 200px;
      background: rgba(255, 255, 255, 0.05);
      border: 2px solid rgba(255, 255, 255, 0.1);
      border-top: none;
      border-radius: 0 0 30px 30px;
      position: relative;
      box-shadow: inset 0 0 20px rgba(255, 255, 255, 0.05);
      display: flex; flex-direction: column-reverse; padding: 10px;
    }
    .tube-glass::before {
      content: ''; position: absolute; top: 0; left: 0; right: 0; height: 4px;
      background: rgba(255, 255, 255, 0.2); border-radius: 2px;
    }
    .tube-base {
      width: 80px; height: 12px; background: #1e293b;
      border-radius: 6px; margin-top: -4px;
      border: 1px solid rgba(255,255,255,0.1);
    }

    .core-stack {
      display: flex; flex-direction: column-reverse; gap: 8px;
      align-items: center; width: 100%;
    }
    .core {
      width: 40px; height: 40px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.2);
      transition: all 0.3s cubic-bezier(0.34, 1.56, 0.64, 1);
      position: relative;
    }
    .selected .core:last-child {
      animation: float 1.5s infinite ease-in-out;
    }
    @keyframes float {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-15px); }
    }

    .win-overlay {
      position: absolute; inset: 0; background: rgba(0,0,0,0.8);
      display: flex; justify-content: center; align-items: center; z-index: 100;
    }
    .win-content {
      background: #1e293b; padding: 3rem; border-radius: 2rem; text-align: center;
      border: 1px solid #3b82f6; box-shadow: 0 0 30px rgba(59, 130, 246, 0.4);
    }

    .game-footer {
      padding: 1rem; background: rgba(30, 41, 59, 0.8);
      display: flex; justify-content: space-between; align-items: center;
      border-top: 1px solid rgba(255,255,255,0.1);
    }
    .pocket-toggle {
      padding: 0.75rem 1.5rem; border-radius: 12px; border: none;
      background: #334155; color: white; font-weight: 800;
      cursor: pointer; transition: all 0.3s;
    }
    .pocket-toggle.active { background: #3b82f6; box-shadow: 0 0 15px rgba(59, 130, 246, 0.5); }

    @media (max-width: 600px) {
      .tubes-grid { gap: 1rem; }
      .tube-glass { width: 50px; height: 160px; }
      .core { width: 32px; height: 32px; }
    }
  `]
})
export class RoboSortComponent implements OnInit {
  private history = inject(HistoryManagerService<SortState>);
  private persistence = inject(PersistenceService);
  private logic = inject(SortLogicService);

  difficulty = signal<'Easy' | 'Medium' | 'Hard'>('Easy');
  tubes = signal<string[][]>([]);
  pocketCore = signal<string | null>(null);
  moveCount = signal<number>(0);
  selectedTube = signal<number | null>(null);
  isPocketMode = signal<boolean>(false);
  showWinOverlay = signal<boolean>(false);

  canUndo = computed(() => this.moveCount() > 0);
  isDark = signal<boolean>(true);

  constructor() {
    effect(() => {
      const state: SortState = { tubes: this.tubes(), pocket: this.pocketCore() };
      if (this.logic.isWin(state)) {
        this.showWinOverlay.set(true);
      }
    });
  }

  ngOnInit() {
    const saved = this.persistence.loadGameState('robo-sort');
    if (saved) {
      this.tubes.set(saved.tubes);
      this.pocketCore.set(saved.pocket);
      this.moveCount.set(saved.moveCount);
      this.difficulty.set(saved.difficulty);
    } else {
      this.generateLevel();
    }
  }

  generateLevel() {
    const level = this.logic.generate(this.difficulty());
    this.tubes.set(level.initialState.tubes);
    this.pocketCore.set(level.initialState.pocket);
    this.moveCount.set(0);
    this.selectedTube.set(null);
    this.showWinOverlay.set(false);
    this.history.clear();
    this.saveState();
  }

  changeDifficulty(d: 'Easy' | 'Medium' | 'Hard') {
    this.difficulty.set(d);
    this.generateLevel();
  }

  handleTubeClick(index: number) {
    if (this.showWinOverlay()) return;

    const selected = this.selectedTube();
    const currentState: SortState = { tubes: this.tubes(), pocket: this.pocketCore() };

    if (this.isPocketMode()) {
      // Logic for moving from tube to pocket or vice versa
      if (this.pocketCore() === null) {
        // Move to pocket
        if (this.logic.isValidPocketMove(currentState, index)) {
          this.executeMove(() => {
            const tubes = this.tubes().map(t => [...t]);
            this.pocketCore.set(tubes[index].pop()!);
            this.tubes.set(tubes);
            this.vibrate(20);
          });
          this.isPocketMode.set(false);
        } else {
          this.vibrate([30, 30]);
        }
      } else {
        // Move from pocket to tube
        if (this.logic.isValidFromPocketMove(currentState, index)) {
          this.executeMove(() => {
            const tubes = this.tubes().map(t => [...t]);
            tubes[index].push(this.pocketCore()!);
            this.pocketCore.set(null);
            this.tubes.set(tubes);
            this.vibrate(20);
          });
          this.isPocketMode.set(false);
        } else {
          this.vibrate([30, 30]);
        }
      }
      return;
    }

    // Normal tube-to-tube move
    if (selected === null) {
      if (this.tubes()[index].length > 0) {
        this.selectedTube.set(index);
        this.vibrate(10);
      }
    } else if (selected === index) {
      this.selectedTube.set(null);
    } else {
      if (this.logic.isValidMove(currentState, selected, index)) {
        this.executeMove(() => {
          const tubes = this.tubes().map(t => [...t]);
          tubes[index].push(tubes[selected].pop()!);
          this.tubes.set(tubes);
          this.selectedTube.set(null);
          this.vibrate(20);
        });
      } else {
        this.selectedTube.set(null);
        this.vibrate([30, 30]);
      }
    }
  }

  handlePocketClick() {
    this.togglePocketMode();
  }

  togglePocketMode() {
    if (this.showWinOverlay()) return;
    this.isPocketMode.set(!this.isPocketMode());
    this.selectedTube.set(null);
  }

  private executeMove(fn: () => void) {
    const prevState: SortState = {
      tubes: this.tubes().map(t => [...t]),
      pocket: this.pocketCore()
    };
    
    this.history.pushState(prevState);
    fn();
    this.moveCount.update(m => m + 1);
    this.saveState();
  }

  undo() {
    const prev = this.history.undo();
    if (prev) {
      this.tubes.set(prev.tubes);
      this.pocketCore.set(prev.pocket);
      this.moveCount.update(m => m - 1);
      this.selectedTube.set(null);
      this.saveState();
    }
  }

  resetLevel() {
    this.generateLevel();
  }

  handleDragStart(event: DragEvent, index: number) {
    if (this.tubes()[index].length === 0) {
      event.preventDefault();
      return;
    }
    event.dataTransfer?.setData('text/plain', index.toString());
    this.selectedTube.set(index);
  }

  handleDrop(event: DragEvent, toIndex: number) {
    event.preventDefault();
    const fromIndex = parseInt(event.dataTransfer?.getData('text/plain') || '-1');
    if (fromIndex !== -1 && fromIndex !== toIndex) {
      this.selectedTube.set(fromIndex);
      this.handleTubeClick(toIndex);
    } else {
      this.selectedTube.set(null);
    }
  }

  private vibrate(pattern: number | number[]) {
    if (navigator.vibrate) navigator.vibrate(pattern);
  }

  private saveState() {
    this.persistence.saveGameState('robo-sort', {
      tubes: this.tubes(),
      pocket: this.pocketCore(),
      moveCount: this.moveCount(),
      difficulty: this.difficulty()
    });
  }
}
