import { Injectable, signal, effect, WritableSignal } from '@angular/core';

export interface UserSettings {
  language: 'en' | 'es';
  tutorialSeen: boolean;
}

export interface GameProgress {
  completedPuzzles: string[]; // Store solved puzzle hashes or IDs
  currentLevel: string; // e.g. 'Easy', 'Medium', 'Hard'
}

@Injectable({
  providedIn: 'root'
})
export class PersistenceService {
  private readonly SETTINGS_KEY = 'robs_puzzle_settings';
  private readonly PROGRESS_KEY = 'robs_puzzle_progress';

  // Signals for state management
  public settings: WritableSignal<UserSettings> = signal(this.loadSettings());
  public progress: WritableSignal<GameProgress> = signal(this.loadProgress());

  constructor() {
    // Effect to automatically save settings when updated
    effect(() => {
      localStorage.setItem(this.SETTINGS_KEY, JSON.stringify(this.settings()));
    });

    // Effect to automatically save progress when updated
    effect(() => {
      localStorage.setItem(this.PROGRESS_KEY, JSON.stringify(this.progress()));
    });
  }

  private loadSettings(): UserSettings {
    const stored = localStorage.getItem(this.SETTINGS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error parsing settings', e);
      }
    }
    return { language: 'en', tutorialSeen: false };
  }

  private loadProgress(): GameProgress {
    const stored = localStorage.getItem(this.PROGRESS_KEY);
    if (stored) {
      try {
        return JSON.parse(stored);
      } catch (e) {
        console.error('Error parsing progress', e);
      }
    }
    return { completedPuzzles: [], currentLevel: 'Easy' };
  }

  setLanguage(lang: 'en' | 'es') {
    this.settings.update(s => ({ ...s, language: lang }));
  }

  setTutorialSeen(seen: boolean) {
    this.settings.update(s => ({ ...s, tutorialSeen: seen }));
  }

  markPuzzleCompleted(puzzleId: string) {
    this.progress.update(p => {
      if (!p.completedPuzzles.includes(puzzleId)) {
        return { ...p, completedPuzzles: [...p.completedPuzzles, puzzleId] };
      }
      return p;
    });
  }

  setCurrentLevel(level: 'Easy' | 'Medium' | 'Hard') {
    this.progress.update(p => ({ ...p, currentLevel: level }));
  }
}
