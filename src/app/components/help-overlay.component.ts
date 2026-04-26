import { Component, Output, EventEmitter } from '@angular/core';

@Component({
  selector: 'app-help-overlay',
  standalone: true,
  template: `
    <div class="modal-overlay" (click)="close()">
      <div class="modal-content help" (click)="$event.stopPropagation()">
        <h2 i18n="@@helpTitle">Need Help?</h2>
        <p i18n="@@helpText">The gold block must reach the exit. Move other blocks out of the way. If you are stuck, you can try regenerating the puzzle!</p>
        <button (click)="close()" class="primary" i18n="@@closeBtn">Close</button>
      </div>
    </div>
  `
})
export class HelpOverlayComponent {
  @Output() closed = new EventEmitter<void>();
  close() { this.closed.emit(); }
}
