import { Component, Output, EventEmitter, signal } from '@angular/core';
import { CommonModule } from '@angular/common';

@Component({
  selector: 'app-help-overlay',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-content help" (click)="$event.stopPropagation()">

        <div class="help-header">
          <h2>🧠 How to Play</h2>
          <!-- Game tabs -->
          <div class="help-tabs">
            <button class="help-tab" [class.active]="tab() === 'sliding'" (click)="tab.set('sliding')">🧩 Sliding Block</button>
            <button class="help-tab" [class.active]="tab() === 'soko'"    (click)="tab.set('soko')">🤖 Soko-Rob</button>
            <button class="help-tab" [class.active]="tab() === 'maze'"    (click)="tab.set('maze')">🌀 Robo-Maze</button>
            <button class="help-tab" [class.active]="tab() === 'bomb'"    (click)="tab.set('bomb')">💣 Rob-Bomb</button>
            <button class="help-tab" [class.active]="tab() === 'ray'"     (click)="tab.set('ray')">⚡ Rob-Ray</button>
            <button class="help-tab" [class.active]="tab() === 'link'"    (click)="tab.set('link')">🔌 Robo-Link</button>
            <button class="help-tab" [class.active]="tab() === 'weight'"  (click)="tab.set('weight')">🧪 Rob-Weight</button>
            <button class="help-tab" [class.active]="tab() === 'sort'"    (click)="tab.set('sort')">🔋 Rob-Sort</button>
          </div>
        </div>

        <!-- ── Sliding Block ── -->
        @if (tab() === 'sliding') {
          <div class="help-body">
            <div class="help-section">
              <h3>🎯 Goal</h3>
              <p>Slide the <strong>gold key block 🔑</strong> to the exit gap on the right side of the board.</p>
            </div>
            <div class="help-section">
              <h3>🕹️ Controls</h3>
              <table class="help-table">
                <tr><td>🖱️ Drag</td><td>Move any block</td></tr>
                <tr><td>↩️</td><td>Undo last move</td></tr>
                <tr><td>💡</td><td>Watch the optimal solution</td></tr>
                <tr><td>🔄</td><td>Restart the same puzzle</td></tr>
                <tr><td>⏭️</td><td>Generate a new puzzle</td></tr>
                <tr><td>🔗</td><td>Copy shareable link</td></tr>
              </table>
            </div>
            <div class="help-section">
              <h3>⚙️ Rules</h3>
              <ul>
                <li>Horizontal blocks can only slide left or right.</li>
                <li>Vertical blocks can only slide up or down.</li>
                <li>Blocks cannot pass through each other.</li>
                <li>The gold block must completely exit through the gap to win.</li>
              </ul>
            </div>
          </div>
        }

        <!-- ── Soko-Rob ── -->
        @if (tab() === 'soko') {
          <div class="help-body">
            <div class="help-section">
              <h3>🎯 Goal</h3>
              <p>Move the robot 🤖 to place every <strong>box 📦</strong> on a red <strong>➕ target</strong> tile. Green glow = box is on target ✅.</p>
            </div>
            <div class="help-section">
              <h3>🧲 Push vs Pull Mode</h3>
              <ul>
                <li><strong>Push</strong> (default): walk into a box → it slides away from you.</li>
                <li><strong>Pull</strong> (🧲 active): walk away from an adjacent box → it follows you.</li>
                <li>Toggle with the <kbd>🧲</kbd> button, <kbd>M</kbd> key, or <kbd>Shift</kbd>.</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>🕹️ Controls</h3>
              <table class="help-table">
                <tr><td><kbd>↑↓←→</kbd> / <kbd>WASD</kbd></td><td>Move robot</td></tr>
                <tr><td><kbd>M</kbd> / <kbd>Shift</kbd></td><td>Toggle Pull Mode</td></tr>
                <tr><td><kbd>Enter</kbd> (on win)</td><td>Next Puzzle</td></tr>
                <tr><td>↩️</td><td>Undo</td></tr>
                <tr><td>💡</td><td>Show solution</td></tr>
                <tr><td>D-Pad (mobile)</td><td>Move robot</td></tr>
              </table>
            </div>
          </div>
        }

        <!-- ── Robo-Maze ── -->
        @if (tab() === 'maze') {
          <div class="help-body">
            <div class="help-section">
              <h3>🎯 Goal</h3>
              <p>Navigate the robot through a procedurally-generated maze to reach the <strong>green 🚪 exit</strong> — before ⚡ energy runs out!</p>
            </div>
            <div class="help-section">
              <h3>🌫️ Fog of War</h3>
              <ul>
                <li>Only a <strong>3-tile radius</strong> around you is visible.</li>
                <li>Previously visited cells stay <strong>dim</strong> (you saw them, they remain).</li>
                <li>Use <strong>📡 Sonar</strong> (costs 10⚡) to briefly illuminate the entire maze for 1.5 seconds.</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>⚡ Energy</h3>
              <ul>
                <li>Each step costs <strong>1 energy</strong>.</li>
                <li>Sonar scan costs <strong>10 energy</strong>.</li>
                <li>Undo <strong>restores</strong> the energy from before that move.</li>
                <li>At 0 energy the robot shuts down — <em>game over</em>.</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>🕹️ Controls</h3>
              <table class="help-table">
                <tr><td><kbd>↑↓←→</kbd> / <kbd>WASD</kbd></td><td>Move robot</td></tr>
                <tr><td><kbd>Q</kbd></td><td>Activate Sonar</td></tr>
                <tr><td><kbd>U</kbd> / <kbd>Z</kbd></td><td>Undo</td></tr>
                <tr><td><kbd>Enter</kbd> (on win/lose)</td><td>Next / Retry</td></tr>
                <tr><td>D-Pad (mobile)</td><td>Move robot</td></tr>
                <tr><td>Swipe on board</td><td>Move robot</td></tr>
                <tr><td>📡 FAB (mobile)</td><td>Sonar scan</td></tr>
              </table>
            </div>
          </div>
        }

        <!-- ── Rob-Bomb ── -->
        @if (tab() === 'bomb') {
          <div class="help-body">
            <div class="help-section">
              <h3>🎯 Goal</h3>
              <p>Eliminate all enemies 👾 and reach the hidden 🚪 door to advance to the next level.</p>
            </div>
            <div class="help-section">
              <h3>💣 Mechanics</h3>
              <ul>
                <li>Drop bombs to destroy soft walls (teal blocks) and enemies.</li>
                <li>Bombs explode after 3 seconds in a cross shape.</li>
                <li>Destroying soft walls may reveal power-ups: Extra Bomb, Range Up, Speed Up.</li>
                <li>Don't get caught in your own explosion!</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>🕹️ Controls</h3>
              <table class="help-table">
                <tr><td><kbd>↑↓←→</kbd> / <kbd>WASD</kbd></td><td>Move player</td></tr>
                <tr><td><kbd>Space</kbd> / <kbd>F</kbd></td><td>Drop Bomb</td></tr>
                <tr><td>D-Pad (mobile)</td><td>Move player</td></tr>
                <tr><td>💣 FAB (mobile)</td><td>Drop Bomb</td></tr>
              </table>
            </div>
          </div>
        }

        <!-- ── Rob-Ray ── -->
        @if (tab() === 'ray') {
          <div class="help-body">
            <div class="help-section">
              <h3>🎯 Goal</h3>
              <p>Rotate the mirrors to reflect the laser beam from the Emitter ⚙️ to the Receptor 📡.</p>
            </div>
            <div class="help-section">
              <h3>⚡ Polarizer Mode</h3>
              <ul>
                <li>Glass blocks normally act as solid walls, blocking the laser.</li>
                <li>Activate the <strong>Polarizer</strong> to make the laser pass straight through glass blocks!</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>🕹️ Controls</h3>
              <table class="help-table">
                <tr><td>🖱️ Tap / Click</td><td>Rotate a mirror 90°</td></tr>
                <tr><td><kbd>Space</kbd> / <kbd>F</kbd></td><td>Toggle Polarizer Mode</td></tr>
                <tr><td><kbd>U</kbd> / <kbd>Z</kbd></td><td>Undo last action</td></tr>
                <tr><td>⚡ FAB (mobile)</td><td>Toggle Polarizer Mode</td></tr>
              </table>
            </div>
          </div>
        }

        <!-- ── Robo-Link ── -->
        @if (tab() === 'link') {
          <div class="help-body">
            <div class="help-section">
              <h3>🎯 Goal</h3>
              <p>Rotate the circuit components to create an unbroken path of electricity from the <strong>Battery</strong> to all <strong>Motors</strong>.</p>
            </div>
            <div class="help-section">
              <h3>🔌 Super-Charge Mode</h3>
              <ul>
                <li>In Hard difficulty, you may encounter broken circuits.</li>
                <li>Activate <strong>Super-Charge Mode</strong>, then tap two non-adjacent components to form a virtual bridge.</li>
                <li>You can only have one active bridge at a time.</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>🕹️ Controls</h3>
              <table class="help-table">
                <tr><td>🖱️ Tap / Click</td><td>Rotate a piece 90° clockwise</td></tr>
                <tr><td><kbd>Space</kbd> / <kbd>F</kbd></td><td>Toggle Super-Charge Mode</td></tr>
                <tr><td><kbd>U</kbd> / <kbd>Z</kbd></td><td>Undo last rotation</td></tr>
                <tr><td>⚡ FAB (mobile)</td><td>Toggle Super-Charge Mode</td></tr>
              </table>
            </div>
          </div>
        }
 
        <!-- ── Rob-Weight ── -->
        @if (tab() === 'weight') {
          <div class="help-body">
            <div class="help-section">
              <h3>🎯 Goal</h3>
              <p>Manipulate jars to reach the target volume exactly. The target value is reached when at least one jar contains that amount.</p>
            </div>
            <div class="help-section">
              <h3>🧪 Fluid Mechanics</h3>
              <ul>
                <li><strong>Fill:</strong> Fill a jar to its maximum capacity.</li>
                <li><strong>Empty:</strong> Discard all fluid in a jar.</li>
                <li><strong>Pour:</strong> Transfer fluid from one jar to another until the source is empty or the destination is full.</li>
                <li><strong>Evaporate:</strong> Remove exactly 1L from a jar (costs one move).</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>🕹️ Controls</h3>
              <table class="help-table">
                <tr><td>🖱️ Drag Jar A → B</td><td>Pour A into B</td></tr>
                <tr><td>🖱️ Tap Jar</td><td>Open Fill/Empty menu</td></tr>
                <tr><td>💨 FAB</td><td>Toggle Evaporator Mode</td></tr>
                <tr><td>↩️</td><td>Undo move</td></tr>
              </table>
            </div>
          </div>
        }
 
        <!-- ── Rob-Sort ── -->
        @if (tab() === 'sort') {
          <div class="help-body">
            <div class="help-section">
              <h3>🎯 Goal</h3>
              <p>Sort all cores into the tubes until each tube contains only one color of cores (or is empty).</p>
            </div>
            <div class="help-section">
              <h3>🔋 Movement Rules</h3>
              <ul>
                <li>You can only move a core onto an <strong>empty tube</strong> or onto another core of the <strong>same color</strong>.</li>
                <li>Tubes have a maximum capacity of 4 cores.</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>🗃️ Deep Pocket</h3>
              <ul>
                <li>The Deep Pocket can hold exactly <strong>one core</strong> of any color at any time.</li>
                <li>You can move a core into the pocket whenever it's empty.</li>
                <li>To move a core out of the pocket, it must follow standard color-matching rules for the destination tube.</li>
              </ul>
            </div>
            <div class="help-section">
              <h3>🕹️ Controls</h3>
              <table class="help-table">
                <tr><td>🖱️ Tap Tube</td><td>Select top core / Move to tube</td></tr>
                <tr><td>🖱️ Drag & Drop</td><td>Move core between tubes</td></tr>
                <tr><td>🗃️ FAB</td><td>Toggle Deep Pocket Mode</td></tr>
              </table>
            </div>
          </div>
        }

        <button (click)="close()" class="primary close-btn">Got it! 👍</button>
      </div>
    </div>
  `,
  styles: [`
    .help { max-width: 500px; text-align: left; padding: 1.5rem; max-height: 90vh; overflow-y: auto; }
    .help-header { margin-bottom: 1rem; }
    .help-header h2 { margin: 0 0 0.75rem; text-align: center; }
    .help-tabs { display: flex; gap: 6px; flex-wrap: wrap; }
    .help-tab {
      flex: 1; padding: 0.35rem 0.5rem;
      border-radius: var(--radius-sm); border: 1px solid var(--border);
      background: var(--surface-alt); color: var(--text-secondary);
      font-size: 0.8rem; cursor: pointer; white-space: nowrap;
      transition: all 0.15s;
    }
    .help-tab.active {
      background: var(--primary); color: var(--primary-text);
      border-color: var(--primary); font-weight: 700;
    }
    .help-body { display: flex; flex-direction: column; gap: 1rem; margin-bottom: 1.2rem; }
    .help-section h3 { margin: 0 0 0.4rem; font-size: 1rem; color: var(--text); }
    .help-section p, .help-section ul { margin: 0; color: var(--text-secondary); line-height: 1.6; }
    .help-section ul { padding-left: 1.2rem; }
    .help-section li { margin-bottom: 0.25rem; }
    .help-table { width: 100%; border-collapse: collapse; font-size: 0.88rem; }
    .help-table tr { border-bottom: 1px solid var(--border); }
    .help-table tr:last-child { border-bottom: none; }
    .help-table td { padding: 5px 8px; color: var(--text-secondary); }
    .help-table td:first-child { color: var(--text); font-weight: 600; white-space: nowrap; }
    kbd {
      display: inline-block; padding: 1px 5px; border-radius: 4px;
      background: var(--surface-alt); border: 1px solid var(--border);
      font-size: 0.82em; font-family: monospace; color: var(--text);
    }
    .close-btn { width: 100%; margin-top: 0.5rem; }
  `]
})
export class HelpOverlayComponent {
  @Output() closed = new EventEmitter<void>();
  tab = signal<'sliding' | 'soko' | 'maze' | 'bomb' | 'ray' | 'link' | 'weight' | 'sort'>('sliding');
  close() { this.closed.emit(); }
}
