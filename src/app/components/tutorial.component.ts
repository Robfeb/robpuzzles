import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

interface TutorialGame {
  icon: string;
  name: string;
  steps: { title: string; body: string }[];
}

const GAMES: TutorialGame[] = [
  {
    icon: '🧩',
    name: 'Sliding Block',
    steps: [
      {
        title: 'Goal',
        body: 'Slide the <strong>gold key block 🔑</strong> to the exit gap on the right side of the board.'
      },
      {
        title: 'Moving Blocks',
        body: 'Horizontal blocks slide <strong>left & right</strong>. Vertical blocks slide <strong>up & down</strong>. Drag a block or click then use arrow keys.'
      },
      {
        title: 'Controls',
        body: '<b>Desktop:</b> drag blocks with mouse.<br><b>Mobile:</b> drag with finger.<br><b>Toolbar:</b> ↩️ Undo · 💡 Solution · 🔄 Restart · ⏭️ New Puzzle.'
      },
    ]
  },
  {
    icon: '🤖',
    name: 'Soko-Rob',
    steps: [
      {
        title: 'Goal',
        body: 'Move the robot 🤖 to push all <strong>boxes 📦</strong> onto the red ➕ target tiles.'
      },
      {
        title: 'Push vs Pull',
        body: 'Walk into a box to <strong>push</strong> it. Toggle 🧲 (or press <kbd>M</kbd> / <kbd>Shift</kbd>) to switch to <strong>Pull Mode</strong> — the robot drags the box behind it as it walks away.'
      },
      {
        title: 'Controls',
        body: '<b>Desktop:</b> Arrow keys / WASD to move · M = Magnet toggle.<br><b>Mobile:</b> on-screen D-Pad at the bottom.<br><b>Toolbar:</b> ↩️ Undo · 💡 Solution · 🔄 Restart · ⏭️ New.'
      },
    ]
  },
  {
    icon: '🌀',
    name: 'Robo-Maze',
    steps: [
      {
        title: 'Goal',
        body: 'Navigate the robot through a dark maze and reach the green 🚪 exit — before your ⚡ energy runs out!'
      },
      {
        title: 'Fog of War & Sonar',
        body: 'Only a small area around you is visible. Use the 📡 Sonar button (costs 10⚡) to briefly illuminate the whole maze and plan your route.'
      },
      {
        title: 'Controls',
        body: '<b>Desktop:</b> Arrow keys / WASD to move · Q = Sonar · U/Z = Undo.<br><b>Mobile:</b> D-Pad bottom-left · 📡 FAB button bottom-right · Swipe on the board.'
      },
    ]
  },
  {
    icon: '💣',
    name: 'Rob-Bomb',
    steps: [
      {
        title: 'Goal',
        body: 'Eliminate all enemies 👾 and find the hidden 🚪 door by bombing soft walls.'
      },
      {
        title: 'Explosions',
        body: 'Drop bombs (Space/F) that explode in a cross shape after 3s. Collect power-ups hidden in walls to increase range and bomb count.'
      },
      {
        title: 'Controls',
        body: '<b>Desktop:</b> Arrow keys / WASD to move · Space / F to drop bombs.<br><b>Mobile:</b> D-Pad and 💣 FAB button.'
      },
    ]
  },
  {
    icon: '⚡',
    name: 'Rob-Ray',
    steps: [
      {
        title: 'Goal',
        body: 'Reflect the laser beam from the Emitter ⚙️ to the Receptor 📡 by rotating mirrors.'
      },
      {
        title: 'Polarizer',
        body: 'Glass blocks block the laser unless you activate the ⚡ Polarizer mode (Space/F). Once active, the laser passes straight through glass!'
      },
      {
        title: 'Controls',
        body: '<b>All:</b> Tap mirrors to rotate · ⚡ button/Space to toggle Polarizer · ↩️ Undo to step back.'
      },
    ]
  },
  {
    icon: '🔌',
    name: 'Robo-Link',
    steps: [
      {
        title: 'Goal',
        body: 'Rotate circuit components to connect the Battery ⚡ to all Motors ⚙️. Electrified paths will glow green.'
      },
      {
        title: 'Super-Charge',
        body: 'On hard levels, circuits might be broken. Use ⚡ Super-Charge mode to select two components and form a "Virtual Bridge" between them.'
      },
      {
        title: 'Controls',
        body: '<b>All:</b> Tap pieces to rotate · ⚡ button/Space for Super-Charge · ↩️ Undo support included.'
      },
    ]
  },
  {
    icon: '🧪',
    name: 'Rob-Weight',
    steps: [
      {
        title: 'Goal',
        body: 'Measure exactly the <strong>Target Volume</strong> by transferring fluid between jars of different sizes.'
      },
      {
        title: 'Actions',
        body: 'Drag one jar onto another to <strong>Pour</strong>. Use the context menu to <strong>Fill</strong> a jar to its max or <strong>Empty</strong> it completely.'
      },
      {
        title: 'The Evaporator',
        body: 'Toggle 💨 <strong>Evaporator Mode</strong> to remove exactly 1L from a jar by tapping it. This is often necessary for prime-number targets!'
      },
    ]
  },
  {
    icon: '🔋',
    name: 'Rob-Sort',
    steps: [
      {
        title: 'Goal',
        body: 'Sort all <strong>Energy Cores</strong> by color. Each tube must eventually contain only one color or be empty.'
      },
      {
        title: 'Movement Rules',
        body: 'A core can only be moved to an <strong>empty tube</strong> or on top of a core of the <strong>same color</strong>.'
      },
      {
        title: 'Deep Pocket',
        body: 'Use the 🗃️ <strong>Deep Pocket</strong> as a temporary slot for any single core. It can help you clear up a tube when you are stuck!'
      },
    ]
  },
];

@Component({
  selector: 'app-tutorial',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay">
      <div class="modal-content tutorial">
        <div class="tut-header">
          <h2>Welcome to Rob's Puzzle 🧠</h2>
          <p class="tut-subtitle">Eight games, one portal. Pick one to learn about:</p>
        </div>

        <!-- Game tabs -->
        <div class="tut-tabs">
          @for (game of games; track game.name; let i = $index) {
            <button class="tut-tab" [class.active]="gameIdx() === i" (click)="selectGame(i)">
              {{ game.icon }} {{ game.name }}
            </button>
          }
        </div>

        <!-- Step content -->
        <div class="tut-body">
          <div class="tut-step-indicator">
            @for (s of currentGame().steps; track $index; let i = $index) {
              <span class="step-dot" [class.active]="step() === i"></span>
            }
          </div>

          <div class="tut-step-content">
            <h3>{{ currentGame().steps[step()].title }}</h3>
            <p [innerHTML]="currentGame().steps[step()].body"></p>
          </div>
        </div>

        <!-- Navigation -->
        <div class="tutorial-actions">
          @if (step() > 0) {
            <button (click)="prevStep()">← Back</button>
          }
          @if (step() < currentGame().steps.length - 1) {
            <button (click)="nextStep()" class="primary">Next →</button>
          }
          @if (step() === currentGame().steps.length - 1) {
            <button (click)="finish()" class="primary">Play Now! 🎮</button>
          }
          <button (click)="finish()" class="text-btn">Skip</button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .tutorial { max-width: 480px; text-align: left; }
    .tut-header { text-align: center; margin-bottom: 1rem; }
    .tut-header h2 { margin: 0 0 0.25rem; }
    .tut-subtitle { margin: 0; color: var(--text-secondary); font-size: 0.9rem; }

    .tut-tabs {
      display: flex; gap: 6px; margin-bottom: 1.2rem; flex-wrap: wrap;
    }
    .tut-tab {
      flex: 1; padding: 0.4rem 0.6rem; border-radius: var(--radius-sm);
      border: 1px solid var(--border); background: var(--surface-alt);
      color: var(--text-secondary); font-size: 0.85rem; cursor: pointer;
      transition: all 0.15s; white-space: nowrap;
    }
    .tut-tab.active {
      background: var(--primary); color: var(--primary-text);
      border-color: var(--primary); font-weight: 700;
    }

    .tut-body { min-height: 110px; }
    .tut-step-indicator {
      display: flex; gap: 6px; margin-bottom: 0.75rem;
    }
    .step-dot {
      width: 8px; height: 8px; border-radius: 50%;
      background: var(--border); transition: background 0.2s;
    }
    .step-dot.active { background: var(--primary); }
    .tut-step-content h3 { margin: 0 0 0.5rem; color: var(--text); }
    .tut-step-content p  { margin: 0; color: var(--text-secondary); line-height: 1.6; }

    kbd {
      display: inline-block; padding: 1px 6px; border-radius: 4px;
      background: var(--surface-alt); border: 1px solid var(--border);
      font-size: 0.85em; font-family: monospace;
    }
  `]
})
export class TutorialComponent {
  @Output() completed = new EventEmitter<void>();
  games = GAMES;
  gameIdx = signal(0);
  step = signal(0);

  currentGame() { return this.games[this.gameIdx()]; }

  selectGame(i: number) { this.gameIdx.set(i); this.step.set(0); }
  nextStep() { this.step.update(s => s + 1); }
  prevStep() { this.step.update(s => s - 1); }
  finish() { this.completed.emit(); }
}
