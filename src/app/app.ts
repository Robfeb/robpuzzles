import { Component, signal, effect, inject, OnInit } from '@angular/core';
import { RouterOutlet, RouterLink, RouterLinkActive } from '@angular/router';
import { CommonModule } from '@angular/common';
import { PersistenceService } from './services/persistence.service';
import { TutorialComponent } from './components/tutorial.component';

@Component({
  selector: 'app-root',
  standalone: true,
  imports: [CommonModule, RouterOutlet, RouterLink, RouterLinkActive, TutorialComponent],
  template: `
    <header>
      <div class="logo">
        <svg width="40" height="40" viewBox="0 0 100 100">
          <path d="M 20 20 L 40 20 A 10 10 0 0 1 60 20 L 80 20 L 80 40 A 10 10 0 0 0 80 60 L 80 80 L 60 80 A 10 10 0 0 1 40 80 L 20 80 L 20 60 A 10 10 0 0 0 20 40 Z" fill="var(--primary)" />
          <text x="50" y="62" font-family="Arial, sans-serif" font-size="40" font-weight="bold" fill="#fff" text-anchor="middle">R</text>
        </svg>
        <h1 i18n="@@appTitle">Rob's Puzzle</h1>
      </div>
      <div class="header-actions">
        <button class="theme-toggle-btn" (click)="toggleTheme()" [title]="isDark() ? 'Switch to Light Mode' : 'Switch to Dark Mode'">
          {{ isDark() ? '☀️' : '🌙' }}
        </button>
        <select [value]="currentLang()" (change)="switchLanguage($event)">
          <option value="en">🌐 English</option>
          <option value="es">🌐 Español</option>
        </select>
      </div>
    </header>

    <nav class="game-nav">
      <a routerLink="/sliding-block" routerLinkActive="active" i18n="@@navSlidingBlock">
        🧩 Sliding Block
      </a>
      <a routerLink="/soko-rob" routerLinkActive="active" i18n="@@navSokoRob">
        🤖 Soko-Rob
      </a>
      <a routerLink="/robo-maze" routerLinkActive="active" i18n="@@navRoboMaze">
        🌀 Robo-Maze
      </a>
    </nav>

    <main>
      <router-outlet></router-outlet>
    </main>

    @if (showTutorial()) {
      <app-tutorial (completed)="finishTutorial()"></app-tutorial>
    }
  `,
  styleUrl: './app.css'
})
export class App implements OnInit {
  persistence = inject(PersistenceService);
  showTutorial = signal(false);
  currentLang = signal('en');
  isDark = signal(false);

  constructor() {
    effect(() => {
      if (!this.persistence.settings().tutorialSeen) {
        this.showTutorial.set(true);
      }
      this.currentLang.set(this.persistence.settings().language);
    }, { allowSignalWrites: true });
  }

  ngOnInit() {
    // Restore saved theme preference
    const saved = localStorage.getItem('robs_puzzle_theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const dark = saved ? saved === 'dark' : prefersDark;
    this.isDark.set(dark);
    this.applyTheme(dark);
  }

  toggleTheme() {
    const next = !this.isDark();
    this.isDark.set(next);
    this.applyTheme(next);
    localStorage.setItem('robs_puzzle_theme', next ? 'dark' : 'light');
  }

  private applyTheme(dark: boolean) {
    document.documentElement.setAttribute('data-theme', dark ? 'dark' : 'light');
  }

  finishTutorial() {
    this.persistence.setTutorialSeen(true);
    this.showTutorial.set(false);
  }

  switchLanguage(event: Event) {
    const select = event.target as HTMLSelectElement;
    const lang = select.value as 'en' | 'es';
    this.persistence.setLanguage(lang);
  }
}
