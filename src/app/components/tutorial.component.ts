import { Component, Output, EventEmitter, signal } from '@angular/core';

@Component({
  selector: 'app-tutorial',
  standalone: true,
  template: `
    <div class="modal-overlay">
      <div class="modal-content tutorial">
        <h2 i18n="@@tutorialTitle">How to Play</h2>
        
        @if (step() === 1) {
          <p i18n="@@tutorialStep1">Welcome to Rob's Puzzle! The goal of the game is to slide the <span class="gold-text">gold key block</span> to the exit on the right.</p>
        }
        @if (step() === 2) {
          <p i18n="@@tutorialStep2">Blocks can only move along their longest side. Horizontal blocks move left and right. Vertical blocks move up and down.</p>
        }
        @if (step() === 3) {
          <p i18n="@@tutorialStep3">Select a block and use your arrow keys or drag to move it. Clear the path and solve the puzzle!</p>
        }
        
        <div class="tutorial-actions">
          @if (step() > 1) {
            <button (click)="prevStep()" i18n="@@prevBtn">Previous</button>
          }
          @if (step() < 3) {
            <button (click)="nextStep()" class="primary" i18n="@@nextBtn">Next</button>
          }
          @if (step() === 3) {
            <button (click)="finish()" class="primary" i18n="@@playBtn">Play Now</button>
          }
          <button (click)="finish()" class="text-btn" i18n="@@skipBtn">Skip</button>
        </div>
      </div>
    </div>
  `
})
export class TutorialComponent {
  @Output() completed = new EventEmitter<void>();
  step = signal(1);

  nextStep() { this.step.update(s => s + 1); }
  prevStep() { this.step.update(s => s - 1); }
  finish() { this.completed.emit(); }
}
