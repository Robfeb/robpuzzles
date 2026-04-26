import { Component, Input, Output, EventEmitter, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { PuzzleState } from '../services/puzzle-generator.service';

@Component({
  selector: 'app-sliding-block',
  standalone: true,
  imports: [CommonModule],
  template: `
    <div class="grid-container" [style.width.px]="state.gridWidth * cellSize" [style.height.px]="state.gridHeight * cellSize">
      <div class="exit-opening" [style.top.px]="2 * cellSize" [style.right.px]="-4" [style.height.px]="cellSize"></div>
      
      @for (block of state.blocks; track block.id) {
        <div class="block" 
             [class.key-block]="block.isKey"
             [class.selected]="selectedBlockId === block.id"
             [style.left.px]="block.x * cellSize"
             [style.top.px]="block.y * cellSize"
             [style.width.px]="block.width * cellSize"
             [style.height.px]="block.height * cellSize"
             (mousedown)="selectBlock(block.id, $event)"
             (touchstart)="selectBlock(block.id, $event)">
             <div class="block-inner"></div>
        </div>
      }
    </div>
  `
})
export class SlidingBlockComponent {
  @Input() state!: PuzzleState;
  @Output() moveMade = new EventEmitter<{ blockId: number, dx: number, dy: number }>();
  
  cellSize = 50;
  selectedBlockId: number | null = null;
  draggingBlockId: number | null = null;
  
  startX = 0;
  startY = 0;
  
  selectBlock(id: number, event: MouseEvent | TouchEvent) {
    // Only prevent default on touch to allow click events to pass if needed, but we prevent text selection.
    if (event.cancelable) event.preventDefault();
    this.selectedBlockId = id;
    this.draggingBlockId = id;
    
    if (window.TouchEvent && event instanceof TouchEvent) {
        this.startX = event.touches[0].clientX;
        this.startY = event.touches[0].clientY;
    } else if (event instanceof MouseEvent) {
        this.startX = event.clientX;
        this.startY = event.clientY;
    }
  }

  @HostListener('window:mousemove', ['$event'])
  @HostListener('window:touchmove', ['$event'])
  handleDrag(event: MouseEvent | TouchEvent) {
    if (this.draggingBlockId === null) return;
    
    let clientX = 0;
    let clientY = 0;

    if (window.TouchEvent && event instanceof TouchEvent) {
        clientX = event.touches[0].clientX;
        clientY = event.touches[0].clientY;
    } else if (event instanceof MouseEvent) {
        if (event.buttons === 0) {
            this.draggingBlockId = null;
            return;
        }
        clientX = event.clientX;
        clientY = event.clientY;
    } else {
        return;
    }

    const dx = clientX - this.startX;
    const dy = clientY - this.startY;
    
    // Check if dragged far enough to trigger a move
    if (Math.abs(dx) > this.cellSize / 2) {
      this.moveMade.emit({ blockId: this.draggingBlockId, dx: Math.sign(dx), dy: 0 });
      this.startX = clientX; // Reset start so it can drag multiple cells seamlessly
    } else if (Math.abs(dy) > this.cellSize / 2) {
      this.moveMade.emit({ blockId: this.draggingBlockId, dx: 0, dy: Math.sign(dy) });
      this.startY = clientY;
    }
  }
  
  @HostListener('window:mouseup')
  @HostListener('window:touchend')
  @HostListener('window:touchcancel')
  endDrag() {
     this.draggingBlockId = null;
  }
  
  @HostListener('window:keydown', ['$event'])
  handleKeyDown(event: KeyboardEvent) {
    if (this.selectedBlockId === null) return;
    
    let dx = 0; let dy = 0;
    if (event.key === 'ArrowUp') dy = -1;
    else if (event.key === 'ArrowDown') dy = 1;
    else if (event.key === 'ArrowLeft') dx = -1;
    else if (event.key === 'ArrowRight') dx = 1;
    
    if (dx !== 0 || dy !== 0) {
      event.preventDefault();
      this.moveMade.emit({ blockId: this.selectedBlockId, dx, dy });
    }
  }
}
