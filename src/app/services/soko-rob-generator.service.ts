import { Injectable } from '@angular/core';

export interface Position {
  x: number;
  y: number;
}

export interface Box extends Position {
  id: number;
}

export interface SokoRobState {
  robot: Position;
  boxes: Box[];
  targets: Position[];
  walls: Position[];
  gridWidth: number;
  gridHeight: number;
  isPullModeActive: boolean;
}

export interface GeneratedSokoRobPuzzle {
  initialState: SokoRobState;
  minMoves: number;
  difficulty: 'Easy' | 'Medium' | 'Hard';
}

@Injectable({
  providedIn: 'root'
})
export class SokoRobGeneratorService {
  private readonly gridWidth = 12;
  private readonly gridHeight = 12;

  constructor() {}

  generatePuzzle(difficulty: 'Easy' | 'Medium' | 'Hard'): GeneratedSokoRobPuzzle {
    let minTargetMoves = 5;
    let maxTargetMoves = 15;
    if (difficulty === 'Medium') {
      minTargetMoves = 15;
      maxTargetMoves = 28;
    } else if (difficulty === 'Hard') {
      minTargetMoves = 28;
      maxTargetMoves = 999;
    }

    const numBoxes = difficulty === 'Easy' ? 2 : (difficulty === 'Medium' ? 3 : 3);
    const minDepthForCandidate = numBoxes * 3;

    let generated: GeneratedSokoRobPuzzle | null = null;
    let bestFallback: GeneratedSokoRobPuzzle | null = null;

    const overallDeadline = Date.now() + 4000; // 4 second hard limit

    for (let attempts = 0; attempts < 15 && Date.now() < overallDeadline; attempts++) {
      const solvedState = this.createRandomSolvedState(numBoxes);
      if (!solvedState) continue;

      const reachableStates = this.performInverseBFS(solvedState, 50, minDepthForCandidate);
      reachableStates.sort((a, b) => b.depth - a.depth);

      for (const candidate of reachableStates.slice(0, 20)) {
        if (Date.now() > overallDeadline) break;

        const anyOnTarget = candidate.state.boxes.some(b =>
          candidate.state.targets.some(t => t.x === b.x && t.y === b.y)
        );
        if (anyOnTarget || this.isSolved(candidate.state)) continue;

        const trueMinMoves = this.solveBFS(candidate.state, 500);
        if (trueMinMoves > 0) {
          const puzzle: GeneratedSokoRobPuzzle = { initialState: candidate.state, minMoves: trueMinMoves, difficulty };
          if (trueMinMoves >= minTargetMoves && trueMinMoves <= maxTargetMoves) {
            return puzzle;
          }
          if (!bestFallback || trueMinMoves > bestFallback.minMoves) {
            bestFallback = puzzle;
          }
        }
      }
    }

    if (bestFallback) return bestFallback;

    // Emergency: find any valid unsolved puzzle fast
    return this.emergencyGenerate(numBoxes, difficulty);
  }

  private emergencyGenerate(numBoxes: number, difficulty: 'Easy' | 'Medium' | 'Hard'): GeneratedSokoRobPuzzle {
    const deadline = Date.now() + 3000;
    for (let i = 0; i < 30 && Date.now() < deadline; i++) {
      const solvedState = this.createRandomSolvedState(numBoxes);
      if (!solvedState) continue;

      const reachableStates = this.performInverseBFS(solvedState, 30, numBoxes * 2);
      reachableStates.sort((a, b) => b.depth - a.depth);

      for (const candidate of reachableStates.slice(0, 30)) {
        const anyOnTarget = candidate.state.boxes.some(b =>
          candidate.state.targets.some(t => t.x === b.x && t.y === b.y)
        );
        if (anyOnTarget || this.isSolved(candidate.state)) continue;
        const moves = this.solveBFS(candidate.state, 300);
        if (moves > 0) return { initialState: candidate.state, minMoves: moves, difficulty };
      }
    }
    // Absolute fallback — apply one forced scramble move from solved state
    const s = this.createRandomSolvedState(numBoxes)!;
    const reachable = this.performInverseBFS(s, 10, 1);
    if (reachable.length > 0) {
      const r = reachable[reachable.length - 1];
      if (!this.isSolved(r.state)) return { initialState: r.state, minMoves: 1, difficulty };
    }
    return { initialState: s, minMoves: 0, difficulty };
  }

  private createRandomSolvedState(numBoxes: number): SokoRobState | null {
    const walls: Position[] = [];
    const targets: Position[] = [];
    const boxes: Box[] = [];

    // Add perimeter walls
    for (let x = 0; x < this.gridWidth; x++) {
      walls.push({ x, y: 0 });
      walls.push({ x, y: this.gridHeight - 1 });
    }
    for (let y = 1; y < this.gridHeight - 1; y++) {
      walls.push({ x: 0, y });
      walls.push({ x: this.gridWidth - 1, y });
    }

    // Add random internal walls (more for larger grid)
    const numInternalWalls = 8;
    for (let i = 0; i < numInternalWalls; i++) {
        const x = Math.floor(Math.random() * (this.gridWidth - 4)) + 2;
        const y = Math.floor(Math.random() * (this.gridHeight - 4)) + 2;
        if (!walls.some(w => w.x === x && w.y === y)) {
            walls.push({ x, y });
        }
    }

    // Place targets
    let attempts = 0;
    while (targets.length < numBoxes && attempts < 100) {
      attempts++;
      const x = Math.floor(Math.random() * (this.gridWidth - 4)) + 2;
      const y = Math.floor(Math.random() * (this.gridHeight - 4)) + 2;
      
      if (!walls.some(w => w.x === x && w.y === y) && !targets.some(t => t.x === x && t.y === y)) {
        targets.push({ x, y });
        boxes.push({ id: targets.length, x, y });
      }
    }
    
    if (targets.length < numBoxes) return null; // Failed to place

    // Place robot adjacent to one of the boxes
    const firstBox = boxes[0];
    const adjs = [
      { x: firstBox.x + 1, y: firstBox.y },
      { x: firstBox.x - 1, y: firstBox.y },
      { x: firstBox.x, y: firstBox.y + 1 },
      { x: firstBox.x, y: firstBox.y - 1 }
    ];
    let robot: Position | null = null;
    for (const pos of adjs) {
        if (!walls.some(w => w.x === pos.x && w.y === pos.y) && !boxes.some(b => b.x === pos.x && b.y === pos.y)) {
            robot = pos;
            break;
        }
    }
    
    if (!robot) {
        // Just place robot anywhere free
        for (let x = 1; x < this.gridWidth - 1; x++) {
            for (let y = 1; y < this.gridHeight - 1; y++) {
                if (!walls.some(w => w.x === x && w.y === y) && !boxes.some(b => b.x === x && b.y === y)) {
                    robot = { x, y };
                    break;
                }
            }
            if (robot) break;
        }
    }
    
    if (!robot) return null;

    return {
      robot,
      boxes,
      targets,
      walls,
      gridWidth: this.gridWidth,
      gridHeight: this.gridHeight,
      isPullModeActive: false // Start with push mode by default
    };
  }

  private performInverseBFS(startState: SokoRobState, maxDepth: number, minDepth: number = 3): { state: SokoRobState; depth: number }[] {
    const queue: { state: SokoRobState; depth: number }[] = [];
    const visited = new Set<string>();
    const results: { state: SokoRobState; depth: number }[] = [];

    queue.push({ state: startState, depth: 0 });
    visited.add(this.serializeState(startState));

    while (queue.length > 0) {
      const current = queue.shift()!;

      if (current.depth >= minDepth) {
        results.push(current);
      }

      if (current.depth >= maxDepth) {
        continue;
      }

      const validReverseMoves = this.getAllValidReverseMoves(current.state);
      for (const nextState of validReverseMoves) {
        const serialized = this.serializeState(nextState);

        if (!visited.has(serialized)) {
          visited.add(serialized);
          queue.push({ state: nextState, depth: current.depth + 1 });
        }
      }

      if (visited.size > 8000) {
        break; // Safety limit
      }
    }

    return results;
  }

  private getAllValidReverseMoves(state: SokoRobState): SokoRobState[] {
    const nextStates: SokoRobState[] = [];
    const directions = [
      { dx: 0, dy: -1 },
      { dx: 0, dy: 1 },
      { dx: -1, dy: 0 },
      { dx: 1, dy: 0 }
    ];

    for (const dir of directions) {
      // Robot moves from current (R) to (R - dir)
      // This corresponds to a forward move of (R - dir) to R with direction `dir`.
      const prevRobotX = state.robot.x - dir.dx;
      const prevRobotY = state.robot.y - dir.dy;

      if (this.isWall(state, prevRobotX, prevRobotY)) continue;

      // 1. Just moving: No box interaction
      if (!this.getBoxAt(state, prevRobotX, prevRobotY)) {
        nextStates.push({
          ...state,
          robot: { x: prevRobotX, y: prevRobotY }
        });
      }

      // 2. Reverse Pull (Simulates Forward Push)
      // Forward: Robot at (prevRobotX, prevRobotY) pushes box at (robot.x, robot.y) to (robot.x + dir.dx, robot.y + dir.dy).
      // So in Reverse: If there's a box at (robot.x + dir.dx, robot.y + dir.dy), we pull it back to (robot.x, robot.y).
      const pushedBoxX = state.robot.x + dir.dx;
      const pushedBoxY = state.robot.y + dir.dy;
      const pushedBox = this.getBoxAt(state, pushedBoxX, pushedBoxY);
      
      // The spot the box was pushed from (current robot pos) must be empty (except for the robot being there now)
      if (pushedBox && !this.getBoxAt(state, state.robot.x, state.robot.y) && !this.getBoxAt(state, prevRobotX, prevRobotY)) {
         nextStates.push({
            ...state,
            robot: { x: prevRobotX, y: prevRobotY },
            boxes: state.boxes.map(b => b.id === pushedBox.id ? { ...b, x: state.robot.x, y: state.robot.y } : { ...b })
         });
      }

      // 3. Reverse Push (Simulates Forward Pull)
      // Forward: Robot at (prevRobotX, prevRobotY) moves to (robot.x, robot.y), pulling box at (prevRobotX - dir.dx, prevRobotY - dir.dy) to (prevRobotX, prevRobotY).
      // So in Reverse: If there is a box at (prevRobotX, prevRobotY), we push it back to (prevRobotX - dir.dx, prevRobotY - dir.dy).
      const pulledBox = this.getBoxAt(state, prevRobotX, prevRobotY);
      const originalBoxX = prevRobotX - dir.dx;
      const originalBoxY = prevRobotY - dir.dy;
      
      if (pulledBox && !this.isWall(state, originalBoxX, originalBoxY) && !this.getBoxAt(state, originalBoxX, originalBoxY)) {
          nextStates.push({
              ...state,
              robot: { x: prevRobotX, y: prevRobotY },
              boxes: state.boxes.map(b => b.id === pulledBox.id ? { ...b, x: originalBoxX, y: originalBoxY } : { ...b })
          });
      }
    }

    return nextStates;
  }

  solveBFS(startState: SokoRobState, maxNodes: number = 300): number {
    return this.solveBFSWithPath(startState, maxNodes).minMoves;
  }

  getSolutionPath(startState: SokoRobState, maxNodes: number = 2000): { dx: number, dy: number }[] | null {
    const result = this.solveBFSWithPath(startState, maxNodes);
    return result.path;
  }

  private solveBFSWithPath(startState: SokoRobState, maxNodes: number): { minMoves: number, path: { dx: number, dy: number }[] | null } {
    const queue: { state: SokoRobState; depth: number; path: { dx: number, dy: number }[] }[] = [];
    const visited = new Set<string>();
    let nodesExplored = 0;

    queue.push({ state: startState, depth: 0, path: [] });
    visited.add(this.serializeState(startState));

    while (queue.length > 0 && nodesExplored < maxNodes) {
      const { state, depth, path } = queue.shift()!;
      nodesExplored++;

      if (this.isSolved(state)) {
        return { minMoves: depth, path };
      }

      if (depth >= 40) continue;

      const directions = [
        { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
        { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
      ];

      for (const dir of directions) {
        const nextStates = this.getMovesForDirection(state, dir);
        for (const nextState of nextStates) {
          const serialized = this.serializeState(nextState);
          if (!visited.has(serialized)) {
            visited.add(serialized);
            queue.push({ state: nextState, depth: depth + 1, path: [...path, dir] });
          }
        }
      }
    }

    return { minMoves: -1, path: null };
  }

  private getAllValidForwardMoves(state: SokoRobState): SokoRobState[] {
    const nextStates: SokoRobState[] = [];
    const directions = [
      { dx: 0, dy: -1 }, { dx: 0, dy: 1 },
      { dx: -1, dy: 0 }, { dx: 1, dy: 0 }
    ];
    for (const dir of directions) {
      nextStates.push(...this.getMovesForDirection(state, dir));
    }
    return nextStates;
  }

  private getMovesForDirection(state: SokoRobState, dir: { dx: number, dy: number }): SokoRobState[] {
    const results: SokoRobState[] = [];
    const nx = state.robot.x + dir.dx;
    const ny = state.robot.y + dir.dy;

    if (this.isWall(state, nx, ny)) return results;

    const boxInFront = this.getBoxAt(state, nx, ny);

    if (!boxInFront) {
      // Regular move
      results.push({ ...state, robot: { x: nx, y: ny } });

      // Pull move: box directly behind robot
      const bx = state.robot.x - dir.dx;
      const by = state.robot.y - dir.dy;
      const boxBehind = this.getBoxAt(state, bx, by);
      if (boxBehind) {
        results.push({
          ...state,
          robot: { x: nx, y: ny },
          boxes: state.boxes.map(b => b.id === boxBehind.id ? { ...b, x: state.robot.x, y: state.robot.y } : { ...b })
        });
      }
    } else {
      // Push move
      const nnx = nx + dir.dx;
      const nny = ny + dir.dy;
      if (!this.isWall(state, nnx, nny) && !this.getBoxAt(state, nnx, nny)) {
        results.push({
          ...state,
          robot: { x: nx, y: ny },
          boxes: state.boxes.map(b => b.id === boxInFront.id ? { ...b, x: nnx, y: nny } : { ...b })
        });
      }
    }
    return results;
  }

  private isSolved(state: SokoRobState): boolean {
    return state.boxes.every(b => state.targets.some(t => t.x === b.x && t.y === b.y));
  }

  isSolvedPublic(state: SokoRobState): boolean {
    return this.isSolved(state);
  }

  private isWall(state: SokoRobState, x: number, y: number): boolean {
    return state.walls.some(w => w.x === x && w.y === y);
  }

  private getBoxAt(state: SokoRobState, x: number, y: number): Box | undefined {
    return state.boxes.find(b => b.x === x && b.y === y);
  }

  serializeState(state: SokoRobState): string {
    const bs = state.boxes.map(b => `${b.x},${b.y}`).sort().join('|');
    return `${state.robot.x},${state.robot.y};${bs}`;
  }
}
