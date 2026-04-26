import { Injectable } from '@angular/core';

export interface SortState {
  tubes: string[][];
  pocket: string | null;
}

export interface SortLevel {
  initialState: SortState;
  difficulty: 'Easy' | 'Medium' | 'Hard';
  seed: number;
}

@Injectable({
  providedIn: 'root'
})
export class SortLogicService {
  private readonly MAX_CAPACITY = 4;
  private readonly COLORS = [
    '#ff0055', // Neon Pink
    '#00ff99', // Cyan Green
    '#0099ff', // Azure Blue
    '#ffcc00', // Gold Yellow
    '#9900ff', // Electric Purple
    '#ff6600', // Blaze Orange
    '#ffffff', // Ghost White
    '#66ff00'  // Lime Green
  ];

  private mulberry32(a: number) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }

  generate(difficulty: 'Easy' | 'Medium' | 'Hard', seed?: number): SortLevel {
    const actualSeed = seed ?? Math.floor(Math.random() * 1000000);
    const rng = this.mulberry32(actualSeed);

    const numColors = difficulty === 'Easy' ? 3 : (difficulty === 'Medium' ? 5 : 7);
    const numTubes = numColors + 2;
    
    // 1. Create sorted state
    const tubes: string[][] = [];
    for (let i = 0; i < numColors; i++) {
      tubes.push(new Array(this.MAX_CAPACITY).fill(this.COLORS[i]));
    }
    for (let i = 0; i < 2; i++) {
      tubes.push([]);
    }

    // 2. Reverse Shuffle
    let currentState: SortState = { tubes: tubes.map(t => [...t]), pocket: null };
    const numShuffles = difficulty === 'Easy' ? 20 : (difficulty === 'Medium' ? 40 : 80);

    for (let i = 0; i < numShuffles; i++) {
      const fromIdx = Math.floor(rng() * numTubes);
      const toIdx = Math.floor(rng() * numTubes);
      
      if (fromIdx === toIdx) continue;
      
      const source = currentState.tubes[fromIdx];
      const dest = currentState.tubes[toIdx];
      
      if (source.length > 0 && dest.length < this.MAX_CAPACITY) {
        const core = source.pop()!;
        dest.push(core);
      }
    }

    return {
      initialState: currentState,
      difficulty,
      seed: actualSeed
    };
  }

  isValidMove(state: SortState, fromIdx: number, toIdx: number): boolean {
    const source = state.tubes[fromIdx];
    const dest = state.tubes[toIdx];

    if (!source || source.length === 0) return false;
    if (!dest || dest.length >= this.MAX_CAPACITY) return false;

    if (dest.length === 0) return true;
    return source[source.length - 1] === dest[dest.length - 1];
  }

  isValidPocketMove(state: SortState, fromIdx: number): boolean {
    return state.pocket === null && state.tubes[fromIdx].length > 0;
  }

  isValidFromPocketMove(state: SortState, toIdx: number): boolean {
    const dest = state.tubes[toIdx];
    if (state.pocket === null || dest.length >= this.MAX_CAPACITY) return false;
    if (dest.length === 0) return true;
    return state.pocket === dest[dest.length - 1];
  }

  isWin(state: SortState): boolean {
    if (state.pocket !== null) return false;
    return state.tubes.every(tube => {
      if (tube.length === 0) return true;
      if (tube.length !== this.MAX_CAPACITY) return false;
      const firstColor = tube[0];
      return tube.every(color => color === firstColor);
    });
  }

  // BFS Solver
  solve(state: SortState): number | null {
    const queue: { state: SortState, moves: number }[] = [{ state, moves: 0 }];
    const visited = new Set<string>();
    visited.add(this.serializeState(state));

    let head = 0;
    while (head < queue.length && head < 5000) { // Safety limit
      const { state: curr, moves } = queue[head++];

      if (this.isWin(curr)) return moves;

      // Try all tube-to-tube moves
      for (let i = 0; i < curr.tubes.length; i++) {
        for (let j = 0; j < curr.tubes.length; j++) {
          if (i === j) continue;
          if (this.isValidMove(curr, i, j)) {
            const next = this.cloneState(curr);
            next.tubes[j].push(next.tubes[i].pop()!);
            const key = this.serializeState(next);
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({ state: next, moves: moves + 1 });
            }
          }
        }
      }

      // Try pocket moves
      for (let i = 0; i < curr.tubes.length; i++) {
        if (this.isValidPocketMove(curr, i)) {
          const next = this.cloneState(curr);
          next.pocket = next.tubes[i].pop()!;
          const key = this.serializeState(next);
          if (!visited.has(key)) {
            visited.add(key);
            queue.push({ state: next, moves: moves + 1 });
          }
        }
      }

      if (curr.pocket) {
        for (let i = 0; i < curr.tubes.length; i++) {
          if (this.isValidFromPocketMove(curr, i)) {
            const next = this.cloneState(curr);
            next.tubes[i].push(next.pocket!);
            next.pocket = null;
            const key = this.serializeState(next);
            if (!visited.has(key)) {
              visited.add(key);
              queue.push({ state: next, moves: moves + 1 });
            }
          }
        }
      }
    }

    return null;
  }

  private cloneState(state: SortState): SortState {
    return {
      tubes: state.tubes.map(t => [...t]),
      pocket: state.pocket
    };
  }

  private serializeState(state: SortState): string {
    return state.tubes.map(t => t.join(',')).join('|') + ';' + (state.pocket || '');
  }
}
