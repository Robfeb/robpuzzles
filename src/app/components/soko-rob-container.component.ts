import { Component, signal, effect, inject, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersistenceService } from '../services/persistence.service';
import { SokoRobGeneratorService, SokoRobState } from '../services/soko-rob-generator.service';
import { HistoryManagerService } from '../services/history-manager.service';
import { SokoRobBoardComponent } from './soko-rob-board.component';

@Component({
  selector: 'app-soko-rob-container',
  standalone: true,
  imports: [CommonModule, SokoRobBoardComponent],
  providers: [HistoryManagerService],
  template: `
    <div class="game-container soko-rob">
      <div class="controls">
        <div class="difficulty-selector">
          <label i18n="@@difficultyLabel">Difficulty:</label>
          <select [value]="difficulty()" (change)="onDifficultyChange($event)">
            <option value="Easy" i18n="@@diffEasy">Easy</option>
            <option value="Medium" i18n="@@diffMedium">Medium</option>
            <option value="Hard" i18n="@@diffHard">Hard</option>
          </select>
        </div>
        
        <div class="actions">
          <button class="icon-btn" [class.active-mode]="pullMode()" (click)="togglePullMode()" title="Toggle Pull Mode (M / Shift)" i18n-title="@@togglePullTitle" [disabled]="isAutoPlaying()">
            🧲
          </button>
          <button class="icon-btn" (click)="undo()" title="Undo" i18n-title="@@undoTitle" [disabled]="!history.canUndo() || isAutoPlaying()">
            ↩️
          </button>
          <button class="icon-btn" (click)="showSolution()" title="Show Solution" i18n-title="@@showSolutionTitle" [disabled]="isAutoPlaying() || isSolved() || !solutionPath()">
            💡
          </button>
          <button class="icon-btn" (click)="generateNew()" title="New Puzzle" i18n-title="@@newPuzzleTitle" [disabled]="isAutoPlaying()">
            ⏭️
          </button>
          <button class="icon-btn" (click)="resetPuzzle()" title="Restart Puzzle" i18n-title="@@resetPuzzleTitle">
            🔄
          </button>
          <button class="icon-btn" (click)="sharePuzzle()" title="Share Puzzle" i18n-title="@@sharePuzzleTitle" [disabled]="isAutoPlaying()">
            🔗
          </button>
        </div>
      </div>
      
      <div class="status-bar">
        <span i18n="@@movesText">Moves: {{ moves() }}</span>
        @if (minMoves() > 0) {
          <span class="min-moves" i18n="@@minMovesText">Optimal: {{ minMoves() }}</span>
        }
      </div>

      <div class="game-area">
        @if (puzzleState()) {
          <app-soko-rob-board [state]="puzzleState()!"></app-soko-rob-board>
        } @else {
          <div class="loading" i18n="@@loadingText">Generating Soko-Rob Puzzle...</div>
        }
      </div>
      
      <!-- Mobile D-Pad -->
      <div class="d-pad-container" [style.pointer-events]="isAutoPlaying() ? 'none' : 'auto'">
         <div class="d-pad">
            <button class="d-pad-btn up" (click)="move(0, -1)">▲</button>
            <button class="d-pad-btn left" (click)="move(-1, 0)">◀</button>
            <button class="d-pad-btn right" (click)="move(1, 0)">▶</button>
            <button class="d-pad-btn down" (click)="move(0, 1)">▼</button>
         </div>
      </div>
      
      @if (isSolved()) {
        <div class="win-overlay">
          <h2 i18n="@@winTitle">Puzzle Solved!</h2>
          <p i18n="@@winText">You completed the puzzle in {{ moves() }} moves.</p>
          <div style="display: flex; gap: 10px; margin-top: 15px;">
            <button class="text-btn" (click)="resetPuzzle()" i18n="@@restartLevelBtn">Restart Level</button>
            <button class="primary" (click)="generateNew()" i18n="@@nextPuzzleBtn">Next Puzzle</button>
          </div>
        </div>
      }
    </div>
  `,
  styles: [`
    .soko-rob {
        display: flex;
        flex-direction: column;
        align-items: center;
    }
    .icon-btn.active-mode {
        background-color: var(--primary);
        color: white;
        box-shadow: 0 0 10px rgba(0, 123, 255, 0.5);
        transform: scale(1.1);
    }
    .d-pad-container {
        margin-top: 20px;
        display: flex;
        justify-content: center;
    }
    .d-pad {
        display: grid;
        grid-template-columns: 60px 60px 60px;
        grid-template-rows: 60px 60px;
        gap: 10px;
    }
    .d-pad-btn {
        background: var(--surface);
        border: 1px solid var(--border);
        border-radius: var(--radius-md);
        color: var(--text);
        font-size: 1.5rem;
        cursor: pointer;
        transition: background 0.1s;
    }
    .d-pad-btn:active {
        background: var(--primary);
        color: white;
    }
    .up { grid-column: 2; grid-row: 1; }
    .left { grid-column: 1; grid-row: 2; }
    .down { grid-column: 2; grid-row: 2; }
    .right { grid-column: 3; grid-row: 2; }
    
    @media (min-width: 768px) {
        .d-pad-container { display: none; } /* Hide on desktop */
    }
  `]
})
export class SokoRobContainerComponent implements OnInit {
  persistence = inject(PersistenceService);
  generator = inject(SokoRobGeneratorService);
  history = inject(HistoryManagerService<SokoRobState>);
  
  difficulty = signal<'Easy' | 'Medium' | 'Hard'>('Easy');
  puzzleState = signal<SokoRobState | null>(null);
  initialPuzzleState = signal<SokoRobState | null>(null);
  solutionPath = signal<{ dx: number, dy: number }[] | null>(null);
  minMoves = signal<number>(0);
  moves = signal<number>(0);
  isSolved = signal<boolean>(false);
  pullMode = signal<boolean>(false);
  isAutoPlaying = signal<boolean>(false);
  private autoPlayTimer: any;

  constructor() {
    effect(() => {
      // Can link diff to persistence if needed, but sliding block sets it globally.
      // Soko-Rob difficulty might be separate, or shared. We'll share it.
      this.difficulty.set(this.persistence.progress().currentLevel as any || 'Easy');
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    const urlParams = new URLSearchParams(window.location.search);
    const sharedState = urlParams.get('soko');
    
    if (sharedState) {
        try {
            const raw = atob(sharedState);
            const [robotPart, boxesPart] = raw.split(';');
            const [rx, ry] = robotPart.split(',').map(Number);
            const boxes = boxesPart.split('|').map((b, i) => {
                const [bx, by] = b.split(',').map(Number);
                return { id: i, x: bx, y: by };
            });
            // Problem: We need targets and walls too! 
            // The generator string format was basic. For real sharing, it must include walls/targets.
            // Let's fallback to generateNew since the serializeState didn't include walls/targets.
            this.generateNew();
        } catch (e) {
            this.generateNew();
        }
    } else {
        setTimeout(() => this.generateNew(), 0);
    }
  }

  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.isAutoPlaying()) return; // Block keyboard during playback

    // Enter = Next Puzzle when win overlay is showing
    if (this.isSolved()) {
      if (event.key === 'Enter') {
        this.generateNew();
        event.preventDefault();
      }
      return;
    }

    if (!this.puzzleState()) return;

    if (event.key === 'Shift' || event.key === 'm' || event.key === 'M') {
        this.togglePullMode();
        event.preventDefault();
        return;
    }

    let dx = 0, dy = 0;
    if (event.key === 'ArrowUp' || event.key === 'w') dy = -1;
    else if (event.key === 'ArrowDown' || event.key === 's') dy = 1;
    else if (event.key === 'ArrowLeft' || event.key === 'a') dx = -1;
    else if (event.key === 'ArrowRight' || event.key === 'd') dx = 1;

    if (dx !== 0 || dy !== 0) {
        this.move(dx, dy);
        event.preventDefault();
    }
  }

  togglePullMode() {
      this.pullMode.update(m => !m);
      const state = this.puzzleState();
      if (state) {
          this.puzzleState.set({ ...state, isPullModeActive: this.pullMode() });
      }
  }

  onDifficultyChange(event: Event) {
    const diff = (event.target as HTMLSelectElement).value as 'Easy' | 'Medium' | 'Hard';
    this.persistence.setCurrentLevel(diff);
    this.generateNew();
  }

  generateNew() {
    this.stopAutoPlay();
    this.history.clear();
    this.puzzleState.set(null);
    this.isSolved.set(false);
    this.moves.set(0);
    this.solutionPath.set(null);
    
    setTimeout(() => {
      const generated = this.generator.generatePuzzle(this.difficulty());
      generated.initialState.isPullModeActive = this.pullMode();
      this.puzzleState.set(generated.initialState);
      this.initialPuzzleState.set(generated.initialState);
      this.minMoves.set(generated.minMoves);
      // Compute solution path in the background
      const path = this.generator.getSolutionPath(generated.initialState, 3000);
      this.solutionPath.set(path);
    }, 50);
  }

  resetPuzzle() {
    this.stopAutoPlay();
    this.history.clear();
    const initialState = this.initialPuzzleState();
    if (initialState) {
      this.puzzleState.set({...initialState, isPullModeActive: this.pullMode()});
      this.isSolved.set(false);
      this.moves.set(0);
    }
  }

  stopAutoPlay() {
    if (this.autoPlayTimer) clearTimeout(this.autoPlayTimer);
    this.isAutoPlaying.set(false);
  }

  showSolution() {
    if (this.isAutoPlaying() || this.isSolved()) return;
    const path = this.solutionPath();
    if (!path || path.length === 0) return;

    this.resetPuzzle(); // go back to start
    this.isAutoPlaying.set(true);

    let step = 0;
    const playNext = () => {
      if (!this.isAutoPlaying() || step >= path.length) {
        this.isAutoPlaying.set(false);
        return;
      }
      this.move(path[step].dx, path[step].dy);
      step++;
      this.autoPlayTimer = setTimeout(playNext, 350);
    };
    this.autoPlayTimer = setTimeout(playNext, 400);
  }

  undo() {
    if (this.isSolved() || this.isAutoPlaying()) return;
    const prev = this.history.undo();
    if (prev) {
      this.puzzleState.set({ ...prev, isPullModeActive: this.pullMode() });
      this.moves.update(m => m - 1);
    }
  }

  sharePuzzle() {
      alert("Sharing Soko-Rob requires full board serialization (coming soon!).");
  }

  move(dx: number, dy: number) {
      if (this.isSolved()) return;
      
      const state = this.puzzleState();
      if (!state) return;

      const robotX = state.robot.x;
      const robotY = state.robot.y;
      const nx = robotX + dx;
      const ny = robotY + dy;

      // 1. Check Wall
      if (state.walls.some(w => w.x === nx && w.y === ny)) return;

      const boxInFront = state.boxes.find(b => b.x === nx && b.y === ny);

      let newState: SokoRobState | null = null;

      if (!boxInFront) {
          // Empty space forward
          if (this.pullMode()) {
              // Check for Pull
              const boxBehind = state.boxes.find(b => b.x === robotX - dx && b.y === robotY - dy);
              if (boxBehind) {
                  newState = {
                      ...state,
                      robot: { x: nx, y: ny },
                      boxes: state.boxes.map(b => b.id === boxBehind.id ? { ...b, x: robotX, y: robotY } : { ...b })
                  };
              }
          }
          
          if (!newState) {
              // Just move
              newState = { ...state, robot: { x: nx, y: ny } };
          }
      } else {
          // Push attempt (Pull mode active doesn't prevent pushing, it's just the classic push)
          const nnx = nx + dx;
          const nny = ny + dy;
          
          if (state.walls.some(w => w.x === nnx && w.y === nny)) return; // wall blocks push
          if (state.boxes.some(b => b.x === nnx && b.y === nny)) return; // box blocks push
          
          newState = {
              ...state,
              robot: { x: nx, y: ny },
              boxes: state.boxes.map(b => b.id === boxInFront.id ? { ...b, x: nnx, y: nny } : { ...b })
          };
      }

      if (newState) {
          this.history.pushState(JSON.parse(JSON.stringify(state))); // Deep clone for safety
          this.puzzleState.set(newState);
          this.moves.update(m => m + 1);
          this.checkWin(newState);
      }
  }

  checkWin(state: SokoRobState) {
      const won = state.boxes.every(b => state.targets.some(t => t.x === b.x && t.y === b.y));
      if (won) {
          this.isSolved.set(true);
      }
  }
}
