import { Component, signal, effect, inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PersistenceService } from '../services/persistence.service';
import { PuzzleGeneratorService, PuzzleState, GeneratedPuzzle } from '../services/puzzle-generator.service';
import { HistoryManagerService } from '../services/history-manager.service';
import { SlidingBlockComponent } from './sliding-block.component';
import { HelpOverlayComponent } from './help-overlay.component';

@Component({
  selector: 'app-sliding-block-container',
  standalone: true,
  imports: [CommonModule, SlidingBlockComponent, HelpOverlayComponent],
  providers: [HistoryManagerService],
  template: `
    <div class="game-container">
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
          <button class="icon-btn" (click)="undo()" title="Undo" i18n-title="@@undoTitle" [disabled]="isAutoPlaying() || !history.canUndo()">
            ↩️
          </button>
          <button class="icon-btn" (click)="generateNew()" title="New Puzzle" i18n-title="@@newPuzzleTitle" [disabled]="isAutoPlaying()">
            ⏭️
          </button>
          <button class="icon-btn" (click)="resetPuzzle()" title="Restart Puzzle" i18n-title="@@resetPuzzleTitle">
            🔄
          </button>
          <button class="icon-btn" (click)="showSolution()" title="Show Solution" i18n-title="@@showSolutionTitle" [disabled]="isAutoPlaying() || isSolved() || !solutionPath()">
            💡
          </button>
          <button class="icon-btn" (click)="sharePuzzle()" title="Share Puzzle" i18n-title="@@sharePuzzleTitle" [disabled]="isAutoPlaying()">
            🔗
          </button>
          <button class="icon-btn" (click)="showHelp.set(true)" title="Help" i18n-title="@@helpTitle" [disabled]="isAutoPlaying()">
            ❓
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
          <app-sliding-block 
            [state]="puzzleState()!" 
            (moveMade)="handleUserMove($event)"
            [style.pointer-events]="isAutoPlaying() ? 'none' : 'auto'">
          </app-sliding-block>
        } @else {
          <div class="loading" i18n="@@loadingText">Generating Puzzle...</div>
        }
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
      
      @if (showHelp()) {
        <app-help-overlay (closed)="showHelp.set(false)"></app-help-overlay>
      }
    </div>
  `
})
export class SlidingBlockContainerComponent implements OnInit {
  persistence = inject(PersistenceService);
  generator = inject(PuzzleGeneratorService);
  history = inject(HistoryManagerService<PuzzleState>);
  
  difficulty = signal<'Easy' | 'Medium' | 'Hard'>('Easy');
  puzzleState = signal<PuzzleState | null>(null);
  initialPuzzleState = signal<PuzzleState | null>(null);
  solutionPath = signal<{ blockId: number, dx: number, dy: number }[] | null>(null);
  minMoves = signal<number>(0);
  moves = signal<number>(0);
  isSolved = signal<boolean>(false);
  showHelp = signal<boolean>(false);
  isAutoPlaying = signal<boolean>(false);
  private autoPlayTimeout: any;
  
  constructor() {
    effect(() => {
      this.difficulty.set(this.persistence.progress().currentLevel as any || 'Easy');
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    // Check URL for shared puzzle
    const urlParams = new URLSearchParams(window.location.search);
    const sharedState = urlParams.get('state');
    
    if (sharedState) {
        try {
            const blocks = JSON.parse(atob(sharedState));
            const loadedState: PuzzleState = { blocks, gridWidth: 6, gridHeight: 6 };
            
            this.puzzleState.set(loadedState);
            this.initialPuzzleState.set(loadedState);
            
            // Run solver to get minMoves and solution path
            const result = this.generator.solveBFS(loadedState);
            if (result.minMoves !== -1) {
                this.minMoves.set(result.minMoves);
                this.solutionPath.set(result.path);
            } else {
                this.minMoves.set(0);
                this.solutionPath.set(null);
            }
        } catch (e) {
            console.error("Failed to parse shared state:", e);
            setTimeout(() => this.generateNew(), 0);
        }
    } else {
        setTimeout(() => this.generateNew(), 0);
    }
  }

  onDifficultyChange(event: Event) {
    const select = event.target as HTMLSelectElement;
    const diff = select.value as 'Easy' | 'Medium' | 'Hard';
    this.persistence.setCurrentLevel(diff);
    this.generateNew();
  }

  generateNew() {
    this.clearAutoPlay();
    this.history.clear();
    this.puzzleState.set(null);
    this.isSolved.set(false);
    this.moves.set(0);
    this.solutionPath.set(null);
    
    // Use setTimeout to allow UI to render loading state
    setTimeout(() => {
      const generated = this.generator.generatePuzzle(this.difficulty());
      this.puzzleState.set(generated.initialState);
      this.initialPuzzleState.set(generated.initialState);
      this.minMoves.set(generated.minMoves);
      this.solutionPath.set(generated.solution || null);
    }, 50);
  }

  resetPuzzle() {
    this.clearAutoPlay();
    this.history.clear();
    const initialState = this.initialPuzzleState();
    if (initialState) {
      this.puzzleState.set(initialState);
      this.isSolved.set(false);
      this.moves.set(0);
    }
  }

  clearAutoPlay() {
    if (this.autoPlayTimeout) clearTimeout(this.autoPlayTimeout);
    this.isAutoPlaying.set(false);
  }

  showSolution() {
    if (this.isAutoPlaying() || this.isSolved()) return;
    
    const path = this.solutionPath();
    if (!path || path.length === 0) return;

    this.resetPuzzle(); // Start from beginning
    this.isAutoPlaying.set(true);
    
    let step = 0;
    const playNext = () => {
      if (!this.isAutoPlaying() || step >= path.length) {
          this.isAutoPlaying.set(false);
          return;
      }
      this.handleMove(path[step]);
      step++;
      
      this.autoPlayTimeout = setTimeout(playNext, 300);
    };
    
    // Slight delay before starting
    this.autoPlayTimeout = setTimeout(playNext, 400);
  }

  undo() {
    if (this.isAutoPlaying() || this.isSolved()) return;
    const previousState = this.history.undo();
    if (previousState) {
      this.puzzleState.set(previousState);
      this.moves.update(m => m - 1);
    }
  }

  sharePuzzle() {
    if (!this.puzzleState()) return;
    
    // A more robust serialize would be needed to store types, but let's do a simple one.
    // For now, let's just alert a dummy share url to meet requirements, or build a real one.
    const stateStr = JSON.stringify(this.puzzleState()!.blocks);
    const base64 = btoa(stateStr);
    const url = `${window.location.origin}${window.location.pathname}?state=${base64}`;
    
    navigator.clipboard.writeText(url).then(() => {
        alert('Puzzle link copied to clipboard!');
    });
  }

  handleUserMove(move: { blockId: number, dx: number, dy: number }) {
    if (this.isAutoPlaying()) return;
    this.handleMove(move);
  }

  handleMove(move: { blockId: number, dx: number, dy: number }) {
    if (this.isSolved()) return;
    
    const state = this.puzzleState();
    if (!state) return;
    
    const block = state.blocks.find(b => b.id === move.blockId);
    if (!block) return;
    
    // Check if move matches block orientation
    if (block.width > block.height && move.dy !== 0) return;
    if (block.height > block.width && move.dx !== 0) return;
    
    // Calculate new position
    const newX = block.x + move.dx;
    const newY = block.y + move.dy;
    
    // Check bounds
    let maxRight = state.gridWidth;
    if (block.isKey && newY === 2) {
        maxRight = state.gridWidth + block.width; // Allow moving completely out
    }
    
    if (newX < 0 || newY < 0 || newX + block.width > maxRight || newY + block.height > state.gridHeight) return;
    
    // Check collision
    const testBlock = { ...block, x: newX, y: newY };
    const collision = state.blocks.some(b => 
        b.id !== block.id && 
        testBlock.x < b.x + b.width && testBlock.x + testBlock.width > b.x &&
        testBlock.y < b.y + b.height && testBlock.y + testBlock.height > b.y
    );
    
    if (collision) return;
    
    // Save state before applying move
    this.history.pushState({ ...state, blocks: state.blocks.map(b => ({...b})) });
    
    // Apply move
    const newBlocks = state.blocks.map(b => b.id === block.id ? testBlock : b);
    this.puzzleState.set({ ...state, blocks: newBlocks });
    this.moves.update(m => m + 1);
    
    // Check win condition (must be moved completely out of the grid)
    if (testBlock.isKey && testBlock.x === state.gridWidth && testBlock.y === 2) {
        this.isSolved.set(true);
        this.persistence.markPuzzleCompleted(new Date().getTime().toString()); // Mock ID
    }
  }
}
