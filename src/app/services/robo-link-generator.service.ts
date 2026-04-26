import { Injectable } from '@angular/core';

export type PieceType = 'I' | 'L' | 'T' | 'X' | 'Battery' | 'Motor' | 'Broken';

export interface CircuitCell {
  x: number;
  y: number;
  type: PieceType;
  basePorts: number;
  rotation: number;
  static: boolean;
}

export interface GeneratedRoboLink {
  width: number;
  height: number;
  cells: CircuitCell[][];
  batteryNode: number;
  motorNodes: number[];
  seed: number;
}

@Injectable({ providedIn: 'root' })
export class RoboLinkGeneratorService {

  generate(difficulty: 'Easy' | 'Medium' | 'Hard', seed?: number): GeneratedRoboLink {
    const sizes = { Easy: 6, Medium: 9, Hard: 12 };
    const size = sizes[difficulty];
    const actualSeed = seed ?? Math.floor(Math.random() * 999983);
    const rng = this.seededRng(actualSeed);

    const numCells = size * size;
    const parent = new Int32Array(numCells);
    for (let i = 0; i < numCells; i++) parent[i] = i;

    function find(i: number): number {
      let root = i;
      while (root !== parent[root]) root = parent[root];
      let curr = i;
      while (curr !== root) {
        let nxt = parent[curr];
        parent[curr] = root;
        curr = nxt;
      }
      return root;
    }

    function union(i: number, j: number): boolean {
      const rootI = find(i);
      const rootJ = find(j);
      if (rootI !== rootJ) {
        parent[rootI] = rootJ;
        return true;
      }
      return false;
    }

    // Generate edges
    interface Edge { u: number; v: number; weight: number; }
    const edges: Edge[] = [];
    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = y * size + x;
        if (x < size - 1) edges.push({ u, v: u + 1, weight: rng() }); // East
        if (y < size - 1) edges.push({ u, v: u + size, weight: rng() }); // South
      }
    }
    edges.sort((a, b) => a.weight - b.weight);

    const activePorts = new Int32Array(numCells);

    // Kruskal's to build MST
    for (const e of edges) {
      if (union(e.u, e.v)) {
        // e.v is either East or South of e.u
        if (e.v === e.u + 1) {
          activePorts[e.u] |= 2; // East
          activePorts[e.v] |= 8; // West
        } else {
          activePorts[e.u] |= 4; // South
          activePorts[e.v] |= 1; // North
        }
      }
    }

    // Identify leaves
    const leaves: number[] = [];
    for (let i = 0; i < numCells; i++) {
      const p = activePorts[i];
      if (p === 1 || p === 2 || p === 4 || p === 8) {
        leaves.push(i);
      }
    }

    // Shuffle leaves
    for (let i = leaves.length - 1; i > 0; i--) {
      const j = Math.floor(rng() * (i + 1));
      [leaves[i], leaves[j]] = [leaves[j], leaves[i]];
    }

    const batteryNode = leaves[0];
    const numMotors = difficulty === 'Hard' ? 3 : (difficulty === 'Medium' ? 2 : 1);
    const motorNodes = leaves.slice(1, 1 + numMotors);

    // Map to cells
    const cells: CircuitCell[][] = Array.from({ length: size }, (_, y) =>
      Array.from({ length: size }, (_, x) => {
        const id = y * size + x;
        let ports = activePorts[id];
        let type: PieceType = 'X';
        let isStatic = false;

        if (id === batteryNode) type = 'Battery';
        else if (motorNodes.includes(id)) type = 'Motor';
        else {
          // Fill missing ports to make complete pieces if needed
          const popcount = this.countBits(ports);
          if (popcount === 1) {
            // Identify valid neighbor directions for this cell
            const valid = [];
            if (y > 0) valid.push(1);
            if (x < size - 1) valid.push(2);
            if (y < size - 1) valid.push(4);
            if (x > 0) valid.push(8);

            // Filter out the required port
            const others = valid.filter(p => p !== ports);
            
            if (others.length > 0) {
              const extra = others[Math.floor(rng() * others.length)];
              ports |= extra;
              // Determine type based on resulting ports
              if (ports === 5 || ports === 10) type = 'I';
              else type = 'L';
            } else {
              type = 'I'; // Fallback
            }
          } else if (popcount === 2) {
            if (ports === 5 || ports === 10) type = 'I';
            else type = 'L';
          } else if (popcount === 3) {
            type = 'T';
          } else {
            type = 'X';
          }
        }

        isStatic = false;
        if (difficulty === 'Hard' && rng() < 0.04 && type !== 'Battery' && type !== 'Motor') {
          type = 'Broken';
          isStatic = true;
        }

        // Assign canonical basePorts based on type
        let basePorts = 0;
        switch (type) {
          case 'I': basePorts = 5; break; // N|S
          case 'L': basePorts = 3; break; // N|E
          case 'T': basePorts = 7; break; // N|E|S
          case 'X': basePorts = 15; break; // N|E|S|W
          case 'Battery':
          case 'Motor':
          case 'Broken':
            basePorts = ports; 
            break;
        }

        // Random starting rotation
        const rotation = isStatic ? 0 : Math.floor(rng() * 4);

        return { x, y, type, basePorts, rotation, static: isStatic };
      })
    );

    return { width: size, height: size, cells, batteryNode, motorNodes, seed: actualSeed };
  }

  // Engine: computes the electrified nodes given a grid
  computeElectrified(cells: CircuitCell[][], batteryNode: number, virtualBridges: {id1: number, id2: number}[] = []): Set<number> {
    const size = cells.length;
    const numCells = size * size;
    const parent = new Int32Array(numCells);
    for (let i = 0; i < numCells; i++) parent[i] = i;

    function find(i: number): number {
      let root = i;
      while (root !== parent[root]) root = parent[root];
      let curr = i;
      while (curr !== root) { let nxt = parent[curr]; parent[curr] = root; curr = nxt; }
      return root;
    }
    function union(i: number, j: number) {
      parent[find(i)] = find(j);
    }

    const getPorts = (c: CircuitCell) => c.type === 'Broken' ? 0 : this.rotateBits(c.basePorts, c.rotation);

    for (let y = 0; y < size; y++) {
      for (let x = 0; x < size; x++) {
        const u = y * size + x;
        const p1 = getPorts(cells[y][x]);
        
        // Check East
        if (x < size - 1) {
          const p2 = getPorts(cells[y][x + 1]);
          if ((p1 & 2) && (p2 & 8)) union(u, u + 1);
        }
        // Check South
        if (y < size - 1) {
          const p2 = getPorts(cells[y + 1][x]);
          if ((p1 & 4) && (p2 & 1)) union(u, u + size);
        }
      }
    }

    // Apply virtual bridges (Super-Charge)
    for (const b of virtualBridges) {
      union(b.id1, b.id2);
    }

    const batRoot = find(batteryNode);
    const electrified = new Set<number>();
    for (let i = 0; i < numCells; i++) {
      if (find(i) === batRoot) electrified.add(i);
    }
    return electrified;
  }

  rotateBits(ports: number, rotation: number): number {
    const r = rotation % 4;
    return ((ports << r) | (ports >> (4 - r))) & 15;
  }

  private countBits(n: number): number {
    let count = 0;
    while (n) { count += n & 1; n >>= 1; }
    return count;
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

  encodeState(seed: number): string { return btoa(seed.toString()); }
  decodeState(encoded: string): number {
    try { return parseInt(atob(encoded), 10); }
    catch { return Math.floor(Math.random() * 999983); }
  }
}
