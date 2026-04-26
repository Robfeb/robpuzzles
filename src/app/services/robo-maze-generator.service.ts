import { Injectable } from '@angular/core';

export interface MazeCell {
  x: number;
  y: number;
  walls: { N: boolean; S: boolean; E: boolean; W: boolean };
}

export interface GeneratedMaze {
  cells: MazeCell[][];
  width: number;
  height: number;
  startX: number;
  startY: number;
  exitX: number;
  exitY: number;
  seed: number;
  maxEnergy: number;
  fogRadius: number;
  sonarCost: number;
  shortestPath: number;
}

@Injectable({ providedIn: 'root' })
export class RoboMazeGeneratorService {

  generate(difficulty: 'Easy' | 'Medium' | 'Hard', seed?: number): GeneratedMaze {
    const sizes: Record<string, [number, number]> = {
      Easy:   [11, 11],
      Medium: [15, 15],
      Hard:   [21, 21],
    };

    const [width, height] = sizes[difficulty];
    const actualSeed = seed ?? Math.floor(Math.random() * 999983);
    const rng = this.seededRng(actualSeed);

    // Build grid — all walls present
    const cells: MazeCell[][] = Array.from({ length: height }, (_, y) =>
      Array.from({ length: width }, (_, x) => ({
        x, y,
        walls: { N: true, S: true, E: true, W: true }
      }))
    );

    // Recursive Backtracker DFS
    const visited = new Set<string>(['0,0']);
    const stack: [number, number][] = [[0, 0]];

    while (stack.length > 0) {
      const [cx, cy] = stack[stack.length - 1];
      const neighbors = this.shuffledUnvisited(cx, cy, width, height, visited, rng);

      if (neighbors.length === 0) {
        stack.pop();
      } else {
        const [nx, ny, dir] = neighbors[0];
        this.carve(cells, cx, cy, nx, ny, dir);
        visited.add(`${nx},${ny}`);
        stack.push([nx, ny]);
      }
    }

    // Difficulty-scaled parameters
    const fogRadii:   Record<string, number> = { Easy: 3, Medium: 2, Hard: 1 };
    const sonarCosts: Record<string, number> = { Easy: 10, Medium: 15, Hard: 25 };
    const energyMult: Record<string, number> = { Easy: 4.0, Medium: 2.5, Hard: 1.6 };

    // BFS to find true shortest path length
    const shortestPath = this.bfsDistance(cells, 0, 0, width - 1, height - 1);
    const maxEnergy = Math.max(30, Math.round(shortestPath * energyMult[difficulty]));

    return {
      cells,
      width,
      height,
      startX: 0,
      startY: 0,
      exitX: width - 1,
      exitY: height - 1,
      seed: actualSeed,
      maxEnergy,
      fogRadius:  fogRadii[difficulty],
      sonarCost:  sonarCosts[difficulty],
      shortestPath,
    };
  }

  private shuffledUnvisited(
    x: number, y: number,
    w: number, h: number,
    visited: Set<string>,
    rng: () => number
  ): [number, number, string][] {
    const candidates: [number, number, string][] = [
      [x, y - 1, 'N'], [x, y + 1, 'S'],
      [x + 1, y, 'E'], [x - 1, y, 'W'],
    ].filter(([nx, ny]) =>
      (nx as number) >= 0 && (ny as number) >= 0 &&
      (nx as number) < w && (ny as number) < h &&
      !visited.has(`${nx},${ny}`)
    ) as [number, number, string][];

    // Fisher-Yates shuffle
    for (let i = candidates.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [candidates[i], candidates[j]] = [candidates[j], candidates[i]];
    }
    return candidates;
  }

  private carve(cells: MazeCell[][], cx: number, cy: number, nx: number, ny: number, dir: string) {
    const opp: Record<string, string> = { N: 'S', S: 'N', E: 'W', W: 'E' };
    (cells[cy][cx].walls as any)[dir] = false;
    (cells[ny][nx].walls as any)[opp[dir]] = false;
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

  private bfsDistance(
    cells: MazeCell[][], sx: number, sy: number, ex: number, ey: number
  ): number {
    const queue: [number, number, number][] = [[sx, sy, 0]];
    const visited = new Set<string>([`${sx},${sy}`]);
    const dirs = [['N', 0, -1], ['S', 0, 1], ['E', 1, 0], ['W', -1, 0]] as const;

    while (queue.length > 0) {
      const [x, y, dist] = queue.shift()!;
      if (x === ex && y === ey) return dist;
      for (const [dir, dx, dy] of dirs) {
        const nx = x + dx, ny = y + dy;
        const key = `${nx},${ny}`;
        if (!cells[y][x].walls[dir] && !visited.has(key)) {
          visited.add(key);
          queue.push([nx, ny, dist + 1]);
        }
      }
    }
    return cells.length * cells[0].length; // fallback
  }

  encodeSeed(seed: number): string {
    return btoa(seed.toString());
  }

  decodeSeed(encoded: string): number {
    try { return parseInt(atob(encoded), 10); }
    catch { return Math.floor(Math.random() * 999983); }
  }
}
