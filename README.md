# Rob's Puzzle Game Portal

A modular Angular 21 portal hosting three puzzle games. Navigate between games using the top menu. Supports **dark & light mode**, **Spanish localization**, and **URL-based puzzle sharing**.

---

## 🎮 Games

### 🧩 Sliding Block
A "Rush Hour"-style game — slide the **gold 🔑 key block** to the exit on the right.

| Feature | Detail |
|---------|--------|
| Controls | Drag blocks with mouse/finger |
| Undo ↩️ | Step back any move |
| Solution 💡 | Watch the optimal solution auto-play |
| Share 🔗 | Copy a URL that recreates the exact puzzle |
| Difficulty | Easy / Medium / Hard (Inverse BFS guaranteed) |

### 🤖 Soko-Rob
A Sokoban variant — move the robot to push/pull **all boxes 📦 onto red ➕ targets**.

**Pull Mode** (unique mechanic): toggle 🧲 / press `M` / `Shift` to drag boxes *behind* the robot instead of pushing them in front.

| Control | Action |
|---------|--------|
| `↑↓←→` / `WASD` | Move robot |
| `M` / `Shift` | Toggle Pull Mode |
| `Enter` (solved) | Next puzzle |
| D-Pad (mobile) | Move robot |

### 🌀 Robo-Maze
Navigate a **fog-covered procedural maze** and reach the green 🚪 exit before ⚡ energy depletes.

| Feature | Detail |
|---------|--------|
| Fog radius | 3-tile Chebyshev visibility |
| Sonar 📡 | Illuminates full maze for 1.5s · costs 10⚡ |
| Energy | 1⚡/step · 0⚡ = game over |
| Undo ↩️ | Restores position **and** energy |
| Haptics | `vibrate()` on move, low energy, sonar |

| Control | Action |
|---------|--------|
| `↑↓←→` / `WASD` | Move |
| `Q` | Sonar scan |
| `U` / `Z` | Undo |
| `Enter` (win/lose) | Next / retry |
| Swipe on board | Move (mobile) |
| 📡 FAB | Sonar (mobile) |

### 💣 Rob-Bomb
A grid-based explosive action game. Drop bombs to destroy soft walls and eliminate all enemies to unlock the 🚪 door.

| Feature | Detail |
|---------|--------|
| Bombs 💣 | Explode in a cross shape after 3s |
| Power-ups | Max Bombs, Blast Range, Speed |
| Enemies 👾 | Random walking AI, speed scales with level |
| God Mode ✨| Press `I` 3 times for 0-second timers, piercing blasts, and ghost mode |

### ⚡ Rob-Ray
A laser reflection puzzle. Rotate mirrors and toggle Polarizer mode to direct a laser beam from an Emitter ⚙️ to a Receptor 📡.

| Feature | Detail |
|---------|--------|
| Mirrors `/` `\` | Rotate 90° by clicking to redirect the laser |
| Polarizer ⚡ | Allows the laser to pass through Glass blocks when active |
| Undo ↩️ | Rewind mirror rotations and polarizer toggles |
| Difficulty | Scales from 8x8 to 12x12 grids |

---

## Architecture

- **Angular 21** Standalone Components + Signals API
- **Angular Router** with lazy-loading for Soko-Rob and Robo-Maze
- **CSS Variables** full dark/light mode token system — toggle via 🌙/☀️ button
- **LocalStorage** persistence for theme, language, and progress
- **i18n**: English + Spanish builds (`npm run build:gh-pages`)

---

## Global Undo System (`HistoryManagerService<T>`)

Generic, Signals-based, provided at component level so each game has its own independent stack.

```typescript
// Before every move
history.pushState({ ...currentState });

// On undo
const prev = history.undo();
if (prev) gameState.set(prev);

// Disable undo button reactively
history.canUndo(); // → boolean
```

Stack is cleared on `generateNew()` and `resetPuzzle()`/`resetMaze()`.

---

## Puzzle Generation

### Sliding Block — Inverse BFS
1. **Start**: key block at exit, random obstacles placed.
2. **Inverse BFS**: explore states reachable backwards from solved position up to depth 90.
3. **Validate**: forward BFS confirms exact minimum moves → assign difficulty.

| Difficulty | Min Moves | Max Moves |
|------------|-----------|-----------|
| Easy       | 5         | 15        |
| Medium     | 15        | 28        |
| Hard       | 28+       | —         |

### Soko-Rob — Reverse-Pulling BFS
1. **Start**: all boxes on their targets.
2. **Inverse BFS** with dual mechanics (reverse-push ↔ reverse-pull).
3. **Validate**: forward BFS (push + pull freely) confirms min moves.

Both generators have a **4-second hard time limit** to prevent UI freezes.

### Robo-Maze — DFS Recursive Backtracker

```
1. Fill grid with all walls present.
2. Push start cell onto stack, mark visited.
3. While stack not empty:
   a. Pick a random unvisited neighbour.
   b. Remove wall between current cell and neighbour.
   c. Push neighbour, mark visited.
   d. If no unvisited neighbours → backtrack (pop).
4. Result: a perfect maze (every cell reachable, no loops).
```

Maze is generated with a **seeded LCG RNG** so the same seed always produces the same maze (useful for URL sharing).

| Difficulty | Grid | Max Energy |
|------------|------|------------|
| Easy       | 11×11 | 120⚡ |
| Medium     | 15×15 | 200⚡ |
| Hard       | 21×21 | 350⚡ |

### Rob-Bomb — Entity Loop
- Uses a `setInterval` (100ms TICK) decoupled from Angular's change detection but tied to Signals.
- Tracks `px, py` and maintains arrays of `bombs` and `enemies`.

### Rob-Ray — Reverse-Raycasting
1. **Start**: pick random receptor at an edge.
2. **Reverse Trace**: move randomly backwards 2-4 steps, place a corner mirror.
3. **Finish**: after placing required mirrors, place Emitter facing forward.
4. **Distractors**: fill empty cells with fake walls, glass, and random mirrors without blocking the true path.

---

## Soko-Rob Pull Mode — Mathematics

Let `R` = robot position, `d` = direction vector, `B` = box position.

**Push (mode OFF)**
- Move into `R + d` where a box is located → valid if `B + d` is empty.
- Result: Robot → `R + d`, Box → `B + d`.

**Pull (mode ON)**
- Robot moves freely to `R + d`.
- If `R − d = B` (box is directly *behind* robot in travel direction) → box is dragged.
- Result: Robot → `R + d`, Box → `R`.

---

## Customization

### Soko-Rob grid and boxes
```typescript
// src/app/services/soko-rob-generator.service.ts
private readonly gridWidth = 12;
private readonly gridHeight = 12;
const numBoxes = difficulty === 'Easy' ? 2 : (difficulty === 'Medium' ? 3 : 3);
```

### Robo-Maze grid sizes and energy
```typescript
// src/app/services/robo-maze-generator.service.ts
const sizes = { Easy: [11,11], Medium: [15,15], Hard: [21,21] };
const energies = { Easy: 120, Medium: 200, Hard: 350 };
```

### Robo-Maze fog radius
```typescript
// src/app/components/robo-maze.component.ts
const FOG_RADIUS = 3;  // tiles of Chebyshev visibility
```

---

## Development & Deployment

```bash
npm run start           # Dev server → http://localhost:4200/
npm run build           # Production build → dist/
npm run build:gh-pages  # Build + publish to /docs for GitHub Pages
```

**GitHub Pages**: run `npm run build:gh-pages`, commit the `docs/` folder, and set your repo's Pages source to the `/docs` folder on `main`. Base href is `/robpuzzles/`.
