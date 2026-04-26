import { Component, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { SokoRobState } from '../services/soko-rob-generator.service';

@Component({
  selector: 'app-soko-rob-board',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="board" [style.width.px]="state.gridWidth * cellSize" [style.height.px]="state.gridHeight * cellSize"
         [class.pull-mode-active]="state.isPullModeActive">
      
      <!-- Targets -->
      @for (target of state.targets; track target.x + ',' + target.y) {
        <div class="target" 
             [style.left.px]="target.x * cellSize" 
             [style.top.px]="target.y * cellSize"
             [style.width.px]="cellSize"
             [style.height.px]="cellSize">
             <div class="target-marker">
               <div class="target-arm target-arm-h"></div>
               <div class="target-arm target-arm-v"></div>
             </div>
        </div>
      }

      <!-- Walls -->
      @for (wall of state.walls; track wall.x + ',' + wall.y) {
        <div class="wall" 
             [style.left.px]="wall.x * cellSize" 
             [style.top.px]="wall.y * cellSize"
             [style.width.px]="cellSize"
             [style.height.px]="cellSize">
        </div>
      }

      <!-- Boxes -->
      @for (box of state.boxes; track box.id) {
        <div class="box" 
             [style.transform]="'translate(' + (box.x * cellSize) + 'px, ' + (box.y * cellSize) + 'px)'"
             [style.width.px]="cellSize"
             [style.height.px]="cellSize"
             [class.on-target]="isOnTarget(box.x, box.y)">
          📦
        </div>
      }

      <!-- Robot -->
      <div class="robot" 
           [style.transform]="'translate(' + (state.robot.x * cellSize) + 'px, ' + (state.robot.y * cellSize) + 'px)'"
           [style.width.px]="cellSize"
           [style.height.px]="cellSize"
           [class.pulling]="state.isPullModeActive">
        🤖
      </div>
    </div>
  `,
  styles: [`
    .board {
      position: relative;
      background: var(--surface);
      border: 4px solid var(--border);
      border-radius: var(--radius-lg);
      margin: 0 auto;
      overflow: hidden;
      box-shadow: 0 10px 30px rgba(0,0,0,0.5);
      transition: box-shadow 0.3s ease, border-color 0.3s ease;
    }
    
    .board.pull-mode-active {
        box-shadow: 0 0 30px rgba(0, 123, 255, 0.6);
        border-color: var(--primary);
    }

    .target, .wall, .box, .robot {
      position: absolute;
      display: flex;
      align-items: center;
      justify-content: center;
    }

    .target {
        background-color: rgba(255, 80, 80, 0.08);
    }

    .target-marker {
        position: relative;
        width: 70%;
        height: 70%;
    }

    .target-arm {
        position: absolute;
        background-color: #ff4444;
        border-radius: 3px;
        top: 50%;
        left: 50%;
    }

    .target-arm-h {
        width: 80%;
        height: 18%;
        transform: translate(-50%, -50%);
    }

    .target-arm-v {
        width: 18%;
        height: 80%;
        transform: translate(-50%, -50%);
    }

    .wall {
        background-color: #4a5568;
        border: 2px solid #2d3748;
        border-radius: 4px;
    }

    .box {
        font-size: 2rem;
        transition: transform 0.2s cubic-bezier(0.2, 0.8, 0.2, 1);
        z-index: 10;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
    }
    
    .box.on-target {
        filter: hue-rotate(90deg) brightness(1.2) drop-shadow(0 0 10px rgba(0, 255, 100, 0.8));
    }

    .robot {
        font-size: 2.2rem;
        transition: transform 0.15s cubic-bezier(0.2, 0.8, 0.2, 1);
        z-index: 20;
        filter: drop-shadow(0 4px 6px rgba(0,0,0,0.4));
    }
    
    .robot.pulling {
        filter: drop-shadow(0 0 15px #007bff);
    }
  `]
})
export class SokoRobBoardComponent {
  @Input() state!: SokoRobState;
  
  // Calculate cell size based on screen width but cap it
  get cellSize(): number {
    const screenWidth = window.innerWidth;
    const available = Math.min(screenWidth - 40, 560); // max 560px board
    return Math.floor(available / 12);
  }

  isOnTarget(x: number, y: number): boolean {
      return this.state.targets.some(t => t.x === x && t.y === y);
  }
}
