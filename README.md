# Rob's Puzzle Game Portal

A modular, single-page application built with Angular 21 for hosting puzzle games. The flagship game is **"Sliding Block"**, featuring dynamic, solvable puzzle generation with variable difficulty.

## Features

- **Sliding Block Puzzle**: A "Rush Hour"-style game where the objective is to slide the gold key block to the exit on the right.
- **Dynamic Solvable Puzzle Generation**: Uses an **Inverse BFS** approach. The engine starts from a solved state, scrambles blocks using random valid moves, and then uses a forward-solving BFS algorithm to compute the exact minimum moves to win. This guarantees that all generated puzzles are solvable and accurately categorized by difficulty.
- **State Persistence**: Uses Angular Signals and Local Storage to persist your progress (completed puzzles, current difficulty) and settings (language preference, tutorial views).
- **Internationalization (i18n)**: Fully set up for English (default) and Spanish.
- **Puzzle Sharing**: Easily share puzzles with friends by copying the unique state URL.

## Architecture

- **Angular 21 (Latest)**: Built with modern Standalone Components and the Signal API for robust reactive state management. No RxJS boilerplate.
- **Game Logic**: Pure TypeScript logic in `PuzzleGeneratorService`.
- **CSS Variables**: Styled using modern CSS Variables for easy theming and responsive design.

## Development Server

Run `npm run start` (or `ng serve`) for a dev server. Navigate to `http://localhost:4200/`. The application will automatically reload if you change any of the source files.

## Local Storage Schema

The portal stores the following objects in Local Storage:
- `robs_puzzle_settings`: `{ "language": "en" | "es", "tutorialSeen": boolean }`
- `robs_puzzle_progress`: `{ "completedPuzzles": string[], "currentLevel": "Easy" | "Medium" | "Hard" }`

## Build & Testing

- **Build**: Run `npm run build` to build the project. The build artifacts will be stored in the `dist/` directory.
- **Testing**: Run `npm run test` to execute the unit tests.

## Puzzle Generation Logic (Inverse BFS)

The puzzle generator is designed to always produce a playable, solvable puzzle. 
1. **Goal State Initialization**: The grid is initialized with the gold key block placed directly at the exit. Random non-colliding "obstacle" blocks are placed on the board.
2. **Reverse Scrambling**: The generator performs a random walk, applying valid reverse moves to the blocks for a set number of iterations.
3. **Difficulty Validation**: Finally, it performs a Breadth-First Search (BFS) to find the shortest path from the scrambled state back to the goal state. Puzzles with a shortest path of 5-10 moves are rated "Easy", 15-25 for "Medium", and 30+ for "Hard".

## Deployment

This app can be deployed to any static hosting service (GitHub Pages, Vercel, Netlify) by serving the `dist/robs-puzzle/browser` folder.
