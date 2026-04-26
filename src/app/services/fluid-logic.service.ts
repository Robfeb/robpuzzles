import { Injectable } from '@angular/core';

export interface FluidLevel {
  capacities: number[];
  target: number;
  initialVolumes: number[];
  difficulty: 'Easy' | 'Medium' | 'Hard';
  seed: number;
}

export interface SolverStep {
  action: string;
  volumes: number[];
}

@Injectable({
  providedIn: 'root'
})
export class FluidLogicService {

  // Simple seeded RNG (Mulberry32)
  private mulberry32(a: number) {
    return function() {
      let t = a += 0x6D2B79F5;
      t = Math.imul(t ^ t >>> 15, t | 1);
      t ^= t + Math.imul(t ^ t >>> 7, t | 61);
      return ((t ^ t >>> 14) >>> 0) / 4294967296;
    }
  }

  generate(difficulty: 'Easy' | 'Medium' | 'Hard', seed?: number): FluidLevel {
    const actualSeed = seed ?? Math.floor(Math.random() * 1000000);
    const rng = this.mulberry32(actualSeed);

    let level: FluidLevel | null = null;
    let attempts = 0;

    while (!level && attempts < 100) {
      attempts++;
      const numJars = difficulty === 'Easy' ? 2 : 3;
      const capacities: number[] = [];
      
      // Random capacities between 3 and 15
      for (let i = 0; i < numJars; i++) {
        let cap = Math.floor(rng() * 13) + 3;
        while (capacities.includes(cap)) cap = Math.floor(rng() * 13) + 3;
        capacities.push(cap);
      }
      capacities.sort((a, b) => b - a);

      const target = Math.floor(rng() * (capacities[0] - 1)) + 1;

      const path = this.solve(capacities, target, false);
      if (!path) continue;

      const length = path.length - 1;
      let match = false;
      if (difficulty === 'Easy' && length >= 3 && length <= 5) match = true;
      if (difficulty === 'Medium' && length >= 6 && length <= 10) match = true;
      if (difficulty === 'Hard') {
        const hardPath = this.solve(capacities, target, true);
        if (hardPath && hardPath.length > 10) match = true;
      }

      if (match) {
        level = {
          capacities,
          target,
          initialVolumes: new Array(numJars).fill(0),
          difficulty,
          seed: actualSeed
        };
      }
    }

    return level || {
      capacities: [8, 5, 3],
      target: 4,
      initialVolumes: [0, 0, 0],
      difficulty: 'Easy',
      seed: actualSeed
    };
  }

  solve(capacities: number[], target: number, allowEvaporate: boolean): SolverStep[] | null {
    const initial = new Array(capacities.length).fill(0);
    const queue: number[][] = [initial];
    const visited = new Map<string, SolverStep | null>();
    visited.set(JSON.stringify(initial), null);

    let head = 0;
    while (head < queue.length) {
      const current = queue[head++];
      
      if (current.some(v => v === target)) {
        return this.reconstructPath(visited, current);
      }

      const neighbors = this.getNeighbors(current, capacities, allowEvaporate);
      for (const { action, volumes } of neighbors) {
        const key = JSON.stringify(volumes);
        if (!visited.has(key)) {
          visited.set(key, { action, volumes: current });
          queue.push(volumes);
        }
      }
    }

    return null;
  }

  private getNeighbors(current: number[], capacities: number[], allowEvaporate: boolean): SolverStep[] {
    const neighbors: SolverStep[] = [];
    const n = current.length;

    for (let i = 0; i < n; i++) {
      if (current[i] < capacities[i]) {
        const next = [...current];
        next[i] = capacities[i];
        neighbors.push({ action: `Fill Jar ${i+1}`, volumes: next });
      }
    }

    for (let i = 0; i < n; i++) {
      if (current[i] > 0) {
        const next = [...current];
        next[i] = 0;
        neighbors.push({ action: `Empty Jar ${i+1}`, volumes: next });
      }
    }

    for (let i = 0; i < n; i++) {
      for (let j = 0; j < n; j++) {
        if (i === j) continue;
        if (current[i] > 0 && current[j] < capacities[j]) {
          const amount = Math.min(current[i], capacities[j] - current[j]);
          const next = [...current];
          next[i] -= amount;
          next[j] += amount;
          neighbors.push({ action: `Pour Jar ${i+1} into ${j+1}`, volumes: next });
        }
      }
    }

    if (allowEvaporate) {
      for (let i = 0; i < n; i++) {
        if (current[i] > 0) {
          const next = [...current];
          next[i] -= 1;
          neighbors.push({ action: `Evaporate Jar ${i+1}`, volumes: next });
        }
      }
    }

    return neighbors;
  }

  private reconstructPath(visited: Map<string, SolverStep | null>, endState: number[]): SolverStep[] {
    const path: SolverStep[] = [];
    let curr: number[] | undefined = endState;
    while (curr) {
      const key = JSON.stringify(curr);
      const entry = visited.get(key);
      if (entry) {
        path.unshift({ action: entry.action, volumes: curr });
        curr = entry.volumes;
      } else {
        path.unshift({ action: 'Start', volumes: curr });
        curr = undefined;
      }
    }
    return path;
  }

  serialize(level: FluidLevel): string {
    return btoa(JSON.stringify(level));
  }

  deserialize(data: string): FluidLevel {
    return JSON.parse(atob(data));
  }
}
