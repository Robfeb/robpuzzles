import { Component, signal, effect, inject } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PersistenceService } from './services/persistence.service';
import { GameContainerComponent } from './components/game-container.component';
import { TutorialComponent } from './components/tutorial.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, GameContainerComponent, TutorialComponent],
  template: `
    <header>
      <div class="logo">
        <svg width="40" height="40" viewBox="0 0 100 100">
          <!-- Stylized Puzzle Piece with "R" -->
          <path d="M 20 20 L 40 20 A 10 10 0 0 1 60 20 L 80 20 L 80 40 A 10 10 0 0 0 80 60 L 80 80 L 60 80 A 10 10 0 0 1 40 80 L 20 80 L 20 60 A 10 10 0 0 0 20 40 Z" fill="#007bff" />
          <text x="50" y="62" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#fff" text-anchor="middle">R</text>
        </svg>
        <h1 i18n="@@appTitle">Rob's Puzzle</h1>
      </div>
      <div class="header-actions">
        <!-- In a real @angular/localize setup, language switching usually reloads the app at a different baseHref. 
             We will simulate a toggle for demonstration. -->
        <select [value]="currentLang()" (change)="switchLanguage($event)">
          <option value="en">English</option>
          <option value="es">Español</option>
        </select>
      </div>
    </header>

    <main>
      <app-game-container></app-game-container>
    </main>

    @if (showTutorial()) {
      <app-tutorial (completed)="finishTutorial()"></app-tutorial>
    }
  `,
  styleUrl: './app.css'
})
export class App {
  persistence = inject(PersistenceService);
  showTutorial = signal(false);
  currentLang = signal('en');

  constructor() {
    effect(() => {
      if (!this.persistence.settings().tutorialSeen) {
        this.showTutorial.set(true);
      }
      this.currentLang.set(this.persistence.settings().language);
    }, { allowSignalWrites: true });
  }

  finishTutorial() {
    this.persistence.setTutorialSeen(true);
    this.showTutorial.set(false);
  }

  switchLanguage(event: Event) {
    const select = event.target as HTMLSelectElement;
    const lang = select.value as 'en' | 'es';
    this.persistence.setLanguage(lang);
    // Real implementation would redirect to the localized build:
    // window.location.href = `/${lang}/`;
  }
}
