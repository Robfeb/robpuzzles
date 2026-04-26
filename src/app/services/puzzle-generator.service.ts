import { Injectable } from '@angular/core';

export interface Block {
  id: number;
  x: number;
  y: number;
  width: number;
  height: number;
  isKey: boolean;
}

export interface PuzzleState {
  blocks: Block[];
  gridWidth: number;
  gridHeight: number;
}

export interface GeneratedPuzzle {
  initialState: PuzzleState;
  minMoves: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  solution?: { blockId: number, dx: number, dy: number }[];
}

@Injectable({
  providedIn: 'root'
})
export class PuzzleGeneratorService {
  private readonly gridWidth = 6;
  private readonly gridHeight = 6;
  private readonly maxScrambleDepth = 1000;

  constructor() {}

  generatePuzzle(difficulty: 'Easy' | 'Medium' | 'Hard'): GeneratedPuzzle {
    let minTargetMoves = 5;
    let maxTargetMoves = 10;
    if (difficulty === 'Medium') {
      minTargetMoves = 14;
      maxTargetMoves = 22;
    } else if (difficulty === 'Hard') {
      minTargetMoves = 26; // Lowered slightly from 30 to ensure we find puzzles consistently
      maxTargetMoves = 999;
    }

    let generated: GeneratedPuzzle | null = null;
    let bestFallback: GeneratedPuzzle | null = null;
    let attempts = 0;
    
    while (!generated && attempts < 25) {
      attempts++;
      const solvedState = this.createRandomSolvedState();
      
      // Inverse BFS finds states far from THIS specific solved configuration
      const reachableStates = this.performInverseBFS(solvedState, 45); 
      
      // Sort by inverse depth descending to test hardest candidates first
      reachableStates.sort((a, b) => b.depth - a.depth);
      
      // Test the top candidates (we don't test all to keep it fast)
      const candidatesToTest = reachableStates.slice(0, 20);
      
      for (const candidate of candidatesToTest) {
          const result = this.solveBFS(candidate.state);
          const trueMinMoves = result.minMoves;
          if (trueMinMoves !== -1) {
              const puzzle: GeneratedPuzzle = { initialState: candidate.state, minMoves: trueMinMoves, difficulty, solution: result.path! };
              
              if (trueMinMoves >= minTargetMoves && trueMinMoves <= maxTargetMoves) {
                  generated = puzzle;
                  break; 
              }
              
              if (!bestFallback || trueMinMoves > bestFallback.minMoves) {
                  bestFallback = puzzle;
              }
          }
      }
    }

    if (!generated && bestFallback) {
        console.warn(`Could not generate exact ${difficulty} puzzle in 25 attempts. Returning best effort with ${bestFallback.minMoves} moves.`);
        return bestFallback;
    }

    return generated || bestFallback || { initialState: this.createRandomSolvedState(), minMoves: 0, difficulty };
  }

  private performInverseBFS(startState: PuzzleState, maxDepth: number): { state: PuzzleState; depth: number }[] {
    const queue: { state: PuzzleState; depth: number }[] = [];
    const visited = new Set<string>();
    const results: { state: PuzzleState; depth: number }[] = [];

    queue.push({ state: startState, depth: 0 });
    visited.add(this.serializeState(startState));

    while (queue.length > 0) {
      const current = queue.shift()!;
      
      if (current.depth >= 3) {
          results.push(current);
      }

      if (current.depth >= maxDepth) {
          continue; 
      }

      const validMoves = this.getAllValidMoves(current.state);
      for (const move of validMoves) {
        const nextState = this.applyMove(current.state, move);
        const serialized = this.serializeState(nextState);
        
        if (!visited.has(serialized)) {
          visited.add(serialized);
          queue.push({ state: nextState, depth: current.depth + 1 });
        }
      }
      
      if (visited.size > 6000) {
          break; // Safety limit
      }
    }

    return results;
  }

  private createRandomSolvedState(): PuzzleState {
    // Standard 6x6 grid. Exit is at y=2, x=5. 
    // Key block is 2x1. To be "solved", key block must be at x=4, y=2.
    const blocks: Block[] = [
      { id: 0, x: 4, y: 2, width: 2, height: 1, isKey: true }
    ];

    // Add random obstacle blocks
    const maxObstacles = 10;
    let nextId = 1;
    const blockTypes = [
      { w: 1, h: 2 },
      { w: 1, h: 3 },
      { w: 2, h: 1 },
      { w: 3, h: 1 }
    ];

    let attempts = 0;
    while (blocks.length < maxObstacles + 1 && attempts < 100) {
      attempts++;
      const type = blockTypes[Math.floor(Math.random() * blockTypes.length)];
      const x = Math.floor(Math.random() * (this.gridWidth - type.w + 1));
      const y = Math.floor(Math.random() * (this.gridHeight - type.h + 1));
      
      const newBlock: Block = { id: nextId, x, y, width: type.w, height: type.h, isKey: false };
      
      if (!this.checkCollision(newBlock, blocks)) {
        // Ensure we don't block the exit path for the key block in the SOLVED state
        if (newBlock.y === 2 && newBlock.x >= 4) {
          continue; // Key block takes up (4,2) and (5,2) in solved state
        }
        blocks.push(newBlock);
        nextId++;
      }
    }

    return { blocks, gridWidth: this.gridWidth, gridHeight: this.gridHeight };
  }



  solveBFS(startState: PuzzleState): { minMoves: number, path: { blockId: number, dx: number, dy: number }[] | null } {
    const queue: { state: PuzzleState; depth: number, path: { blockId: number, dx: number, dy: number }[] }[] = [];
    const visited = new Set<string>();

    queue.push({ state: startState, depth: 0, path: [] });
    visited.add(this.serializeState(startState));

    while (queue.length > 0) {
      const { state, depth, path } = queue.shift()!;

      // Check win condition: Key block at exit
      const keyBlock = state.blocks.find(b => b.isKey);
      if (keyBlock && keyBlock.x === this.gridWidth - keyBlock.width && keyBlock.y === 2) {
        const finalPath = [...path];
        const distanceToExit = this.gridWidth - keyBlock.x;
        for (let i = 0; i < distanceToExit; i++) {
            finalPath.push({ blockId: keyBlock.id, dx: 1, dy: 0 });
        }
        return { minMoves: depth + distanceToExit, path: finalPath };
      }

      if (depth >= 150) { // Limit depth to prevent hanging
        continue;
      }

      const validMoves = this.getAllValidMoves(state);
      for (const move of validMoves) {
        const nextState = this.applyMove(state, move);
        const serialized = this.serializeState(nextState);
        
        if (!visited.has(serialized)) {
          visited.add(serialized);
          queue.push({ state: nextState, depth: depth + 1, path: [...path, move] });
        }
      }
    }

    return { minMoves: -1, path: null };
  }

  private checkCollision(block: Block, others: Block[]): boolean {
    for (const other of others) {
      if (block.id !== other.id &&
          block.x < other.x + other.width &&
          block.x + block.width > other.x &&
          block.y < other.y + other.height &&
          block.y + block.height > other.y) {
        return true;
      }
    }
    return false;
  }

  private getAllValidMoves(state: PuzzleState): { blockId: number, dx: number, dy: number }[] {
    const moves: { blockId: number, dx: number, dy: number }[] = [];
    
    for (const block of state.blocks) {
      if (block.width > block.height) { // Horizontal
        // Try left
        if (block.x > 0) {
          const testBlock = { ...block, x: block.x - 1 };
          if (!this.checkCollision(testBlock, state.blocks)) {
            moves.push({ blockId: block.id, dx: -1, dy: 0 });
          }
        }
        // Try right
        if (block.x + block.width < state.gridWidth) {
          const testBlock = { ...block, x: block.x + 1 };
          if (!this.checkCollision(testBlock, state.blocks)) {
            moves.push({ blockId: block.id, dx: 1, dy: 0 });
          }
        }
      } else { // Vertical
        // Try up
        if (block.y > 0) {
          const testBlock = { ...block, y: block.y - 1 };
          if (!this.checkCollision(testBlock, state.blocks)) {
            moves.push({ blockId: block.id, dx: 0, dy: -1 });
          }
        }
        // Try down
        if (block.y + block.height < state.gridHeight) {
          const testBlock = { ...block, y: block.y + 1 };
          if (!this.checkCollision(testBlock, state.blocks)) {
            moves.push({ blockId: block.id, dx: 0, dy: 1 });
          }
        }
      }
    }
    
    return moves;
  }

  private applyMove(state: PuzzleState, move: { blockId: number, dx: number, dy: number }): PuzzleState {
    const newBlocks = state.blocks.map(b => 
      b.id === move.blockId ? { ...b, x: b.x + move.dx, y: b.y + move.dy } : { ...b }
    );
    return { ...state, blocks: newBlocks };
  }

  serializeState(state: PuzzleState): string {
    return state.blocks.map(b => `${b.x},${b.y}`).join(';');
  }
  
  deserializeState(serialized: string, originalTypes: {id: number, w: number, h: number, isKey: boolean}[]): PuzzleState {
      const parts = serialized.split(';');
      const blocks: Block[] = [];
      for (let i = 0; i < parts.length; i++) {
          const [x, y] = parts[i].split(',').map(Number);
          const typeInfo = originalTypes.find(t => t.id === i);
          if (typeInfo) {
              blocks.push({
                  id: typeInfo.id,
                  x, y,
                  width: typeInfo.w,
                  height: typeInfo.h,
                  isKey: typeInfo.isKey
              });
          }
      }
      return { blocks, gridWidth: this.gridWidth, gridHeight: this.gridHeight };
  }
}
