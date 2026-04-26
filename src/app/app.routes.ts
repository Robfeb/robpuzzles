import { Routes } from '@angular/router';
import { SlidingBlockContainerComponent } from './components/sliding-block-container.component';

export const routes: Routes = [
  { path: 'sliding-block', component: SlidingBlockContainerComponent },
  { path: 'soko-rob', loadComponent: () => import('./components/soko-rob-container.component').then(m => m.SokoRobContainerComponent) },
  { path: 'robo-maze',   loadComponent: () => import('./components/robo-maze.component').then(m => m.RoboMazeComponent) },
  { path: '', redirectTo: 'sliding-block', pathMatch: 'full' }
];
