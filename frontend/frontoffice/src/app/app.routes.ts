import { Routes } from '@angular/router';
import { authGuard } from './core/guards/auth.guard';
import { porteurGuard } from './core/guards/porteur.guard';
import { juryGuard } from './core/guards/jury.guard';

export const routes: Routes = [
  // Public
  { path: '', loadComponent: () => import('./pages/home/home.component').then(m => m.HomeComponent) },
  { path: 'sessions', loadComponent: () => import('./pages/sessions/sessions-list.component').then(m => m.SessionsListComponent) },
  { path: 'sessions/:id', loadComponent: () => import('./pages/sessions/session-detail.component').then(m => m.SessionDetailComponent) },
  { path: 'login', loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent) },
  { path: 'register', loadComponent: () => import('./pages/auth/register.component').then(m => m.RegisterComponent) },

  // Role-based dashboard (unified entry point for all authenticated users)
  { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },

  // Role-specific routes (still accessible directly)
  { path: 'apply/:sessionId', loadComponent: () => import('./pages/apply/apply.component').then(m => m.ApplyComponent), canActivate: [authGuard, porteurGuard] },
  { path: 'my-application', loadComponent: () => import('./pages/my-application/my-application.component').then(m => m.MyApplicationComponent), canActivate: [authGuard, porteurGuard] },
  { path: 'jury', loadComponent: () => import('./pages/jury/jury-dashboard.component').then(m => m.JuryDashboardComponent), canActivate: [juryGuard] },
  { path: 'jury/evaluate/:id', loadComponent: () => import('./pages/jury/jury-evaluate.component').then(m => m.JuryEvaluateComponent), canActivate: [juryGuard] },

  // Authenticated
  { path: 'profile', loadComponent: () => import('./pages/profile/profile.component').then(m => m.ProfileComponent), canActivate: [authGuard] },

  { path: '**', redirectTo: '' }
];
