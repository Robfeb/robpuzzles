import { Injectable, signal } from '@angular/core';

@Injectable()
export class HistoryManagerService<T> {
  private history = signal<T[]>([]);

  pushState(state: T) {
    this.history.update(h => [...h, state]);
  }

  undo(): T | undefined {
    const currentHistory = this.history();
    if (currentHistory.length === 0) return undefined;
    
    const previousState = currentHistory[currentHistory.length - 1];
    this.history.update(h => h.slice(0, -1));
    return previousState;
  }

  canUndo(): boolean {
    return this.history().length > 0;
  }

  clear() {
    this.history.set([]);
  }
}
