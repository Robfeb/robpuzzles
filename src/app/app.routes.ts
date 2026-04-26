import { Routes } from '@angular/router';
import { SlidingBlockContainerComponent } from './components/sliding-block-container.component';

export const routes: Routes = [
  { path: 'sliding-block', component: SlidingBlockContainerComponent },
  { path: 'soko-rob',  loadComponent: () => import('./components/soko-rob-container.component').then(m => m.SokoRobContainerComponent) },
  { path: 'robo-maze', loadComponent: () => import('./components/robo-maze.component').then(m => m.RoboMazeComponent) },
  { path: 'rob-bomb',  loadComponent: () => import('./components/rob-bomb.component').then(m => m.RobBombComponent) },
  { path: 'rob-ray',   loadComponent: () => import('./components/rob-ray.component').then(m => m.RobRayComponent) },
  { path: 'robo-link', loadComponent: () => import('./components/robo-link.component').then(m => m.RoboLinkComponent) },
  { path: 'rob-weight', loadComponent: () => import('./components/rob-weight.component').then(m => m.RoboWeightComponent) },
  { path: 'robo-sort', loadComponent: () => import('./components/robo-sort.component').then(m => m.RoboSortComponent) },
  { path: '', redirectTo: 'sliding-block', pathMatch: 'full' }
];
