import { Injectable } from '@angular/core';

export type RayDir = 'N' | 'S' | 'E' | 'W';
export type MirrorOri = '/' | '\\';
export type CellType = 'empty' | 'wall' | 'glass' | 'emitter' | 'receptor' | 'mirror';

export interface GridCell {
  x: number;
  y: number;
  type: CellType;
  // Emitter properties
  emitDir?: RayDir;
  // Mirror properties
  ori?: MirrorOri;
  rotatable?: boolean;
}

export interface GeneratedRobRay {
  width: number;
  height: number;
  cells: GridCell[][];
  emitterX: number;
  emitterY: number;
  receptorX: number;
  receptorY: number;
  seed: number;
  optimalMoves: number;
}

@Injectable({ providedIn: 'root' })
export class RobRayGeneratorService {

  generate(difficulty: 'Easy' | 'Medium' | 'Hard', seed?: number): GeneratedRobRay {
    const sizes: Record<string, number> = { Easy: 8, Medium: 10, Hard: 12 };
    const mirrorsCount: Record<string, number> = { Easy: 3, Medium: 6, Hard: 9 };
    
    const size = sizes[difficulty];
    const targetMirrors = mirrorsCount[difficulty];
    const actualSeed = seed ?? Math.floor(Math.random() * 999983);
    const rng = this.seededRng(actualSeed);

    let bestPuzzle: GeneratedRobRay | null = null;
    let maxTries = 200;

    while (maxTries-- > 0) {
      const p = this.tryGenerate(size, targetMirrors, rng, actualSeed);
      if (p) {
        bestPuzzle = p;
        break;
      }
    }

    if (!bestPuzzle) {
      bestPuzzle = this.tryGenerate(size, 1, rng, actualSeed);
    }
    
    // Ultimate fallback to prevent infinite loading
    if (!bestPuzzle) {
      const cells: GridCell[][] = Array.from({ length: size }, (_, y) =>
        Array.from({ length: size }, (_, x) => ({ x, y, type: 'empty' }))
      );
      cells[0][1].type = 'receptor';
      cells[2][1].type = 'emitter';
      cells[2][1].emitDir = 'N';
      bestPuzzle = {
        width: size, height: size, cells,
        emitterX: 1, emitterY: 2, receptorX: 1, receptorY: 0,
        seed: actualSeed, optimalMoves: 0
      };
    }

    return bestPuzzle;
  }

  private tryGenerate(size: number, targetMirrors: number, rng: () => number, seed: number): GeneratedRobRay | null {
    const cells: GridCell[][] = Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => ({ x, y, type: 'empty' }))
    );

    // Pick random receptor at an edge
    const rx = Math.floor(rng() * (size - 2)) + 1;
    const ry = rng() < 0.5 ? 0 : size - 1;
    cells[ry][rx].type = 'receptor';

    let cx = rx;
    let cy = ry;
    let dir: RayDir = ry === 0 ? 'N' : 'S'; // direction of the ray hitting the receptor
    // We trace backward, so the ray "comes from" the opposite of where we move
    let traceDir: RayDir = this.opposite(dir);

    const path: {x: number, y: number}[] = [];
    let mirrorsPlaced = 0;
    
    let loopProtect = 100;
    while (loopProtect-- > 0) {
      path.push({x: cx, y: cy});
      // Move backwards randomly 2 to 4 cells
      const dist = Math.floor(rng() * 3) + 2;
      let hitEdge = false;
      let stepsTaken = 0;

      for (let i = 0; i < dist; i++) {
        const nx = cx + (traceDir === 'E' ? 1 : traceDir === 'W' ? -1 : 0);
        const ny = cy + (traceDir === 'S' ? 1 : traceDir === 'N' ? -1 : 0);
        
        if (nx < 0 || ny < 0 || nx >= size || ny >= size) {
          hitEdge = true;
          break;
        }
        
        // If we cross our own path, fail generation
        if (path.some(p => p.x === nx && p.y === ny)) return null;

        cx = nx;
        cy = ny;
        path.push({x: cx, y: cy});
        stepsTaken++;
      }

      if (stepsTaken === 0) return null; // Prevent overwriting the previous mirror if trapped

      if (hitEdge || mirrorsPlaced >= targetMirrors) {
        // Place emitter
        cells[cy][cx].type = 'emitter';
        cells[cy][cx].emitDir = this.opposite(traceDir); // emitter points forward along path
        break;
      }

      // Place mirror
      cells[cy][cx].type = 'mirror';
      cells[cy][cx].rotatable = true;
      
      // Determine mirror orientation to turn left or right
      // Example: traceDir = 'N'. If we turn 'E', actual ray goes 'W' and reflects 'S'.
      // traceDir 'N' -> moving UP. 
      const turnRight = rng() < 0.5;
      const nextTraceDir = this.turn(traceDir, turnRight);
      
      // The ray is going opposite of nextTraceDir, and reflects opposite of traceDir
      const rayIn = this.opposite(nextTraceDir);
      const rayOut = this.opposite(traceDir);
      
      cells[cy][cx].ori = this.getMirrorOri(rayIn, rayOut);
      
      traceDir = nextTraceDir;
      mirrorsPlaced++;
    }

    if (mirrorsPlaced < targetMirrors * 0.5) return null;

    // Distractors
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (cells[y][x].type === 'empty' && !path.some(p => p.x === x && p.y === y)) {
          const r = rng();
          if (r < 0.05) cells[y][x].type = 'wall';
          else if (r < 0.10) { cells[y][x].type = 'glass'; }
          else if (r < 0.15) {
            cells[y][x].type = 'mirror';
            cells[y][x].rotatable = true;
            cells[y][x].ori = rng() < 0.5 ? '/' : '\\';
          }
        }
      }
    }

    // Scramble puzzle mirrors and count optimal moves
    let optimalMoves = 0;
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        if (cells[y][x].type === 'mirror' && cells[y][x].rotatable) {
          if (rng() < 0.5) {
            cells[y][x].ori = cells[y][x].ori === '/' ? '\\' : '/';
            // If it was part of the true path, it will require a rotation to solve
            if (path.some(p => p.x === x && p.y === y)) optimalMoves++;
          }
        }
      }
    }

    return {
      width: size,
      height: size,
      cells,
      emitterX: cx,
      emitterY: cy,
      receptorX: rx,
      receptorY: ry,
      seed,
      optimalMoves: Math.max(1, optimalMoves)
    };
  }

  private opposite(dir: RayDir): RayDir {
    const opp: Record<RayDir, RayDir> = { 'N': 'S', 'S': 'N', 'E': 'W', 'W': 'E' };
    return opp[dir];
  }

  private turn(dir: RayDir, right: boolean): RayDir {
    const dirs: RayDir[] = ['N', 'E', 'S', 'W'];
    let idx = dirs.indexOf(dir);
    idx = (idx + (right ? 1 : 3)) % 4;
    return dirs[idx];
  }

  private getMirrorOri(inDir: RayDir, outDir: RayDir): MirrorOri {
    if ((inDir === 'N' && outDir === 'E') || (inDir === 'W' && outDir === 'S') ||
        (inDir === 'S' && outDir === 'W') || (inDir === 'E' && outDir === 'N')) {
      return '/';
    }
    return '\\';
  }

  private seededRng(seed: number): () => number {
    let s = seed >>> 0;
    return () => {
      s = Math.imul(s ^ (s >>> 15), 0x2c1b3c6d);
      s = Math.imul(s ^ (s >>> 12), 0x297a2d39);
      s ^= s >>> 15;
      return (s >>> 0) / 0xffffffff;
    };
  }

  encodeSeed(seed: number): string {
    return btoa(seed.toString());
  }

  decodeSeed(encoded: string): number {
    try { return parseInt(atob(encoded), 10); }
    catch { return Math.floor(Math.random() * 999983); }
  }
}
