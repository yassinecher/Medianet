import { Routes } from '@angular/router';
import { adminGuard } from './core/guards/admin.guard';

export const routes: Routes = [
  { path: 'login', loadComponent: () => import('./pages/auth/login.component').then(m => m.LoginComponent) },
  {
    path: '',
    loadComponent: () => import('./layout/layout.component').then(m => m.LayoutComponent),
    canActivate: [adminGuard],
    children: [
      { path: '', redirectTo: 'dashboard', pathMatch: 'full' },
      { path: 'dashboard', loadComponent: () => import('./pages/dashboard/dashboard.component').then(m => m.DashboardComponent) },
      { path: 'sessions', loadComponent: () => import('./pages/sessions/sessions.component').then(m => m.SessionsComponent) },
      { path: 'sessions/create', loadComponent: () => import('./pages/sessions/session-form.component').then(m => m.SessionFormComponent) },
      { path: 'sessions/:id/edit', loadComponent: () => import('./pages/sessions/session-form.component').then(m => m.SessionFormComponent) },
      { path: 'sessions/:id', loadComponent: () => import('./pages/sessions/session-detail.component').then(m => m.SessionDetailComponent) },
      { path: 'candidatures', loadComponent: () => import('./pages/candidatures/candidatures.component').then(m => m.CandidaturesComponent) },
      { path: 'candidatures/:id', loadComponent: () => import('./pages/candidatures/candidature-detail.component').then(m => m.CandidatureDetailComponent) },
      { path: 'users', loadComponent: () => import('./pages/users/users.component').then(m => m.UsersComponent) }
    ]
  },
  { path: '**', redirectTo: '' }
];
