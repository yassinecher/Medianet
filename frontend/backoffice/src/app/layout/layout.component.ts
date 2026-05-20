import { Component, signal } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, RouterOutlet, Router, NavigationEnd } from '@angular/router';
import { AuthService } from '../core/services/auth.service';
import { filter, map } from 'rxjs/operators';

@Component({
  selector: 'app-layout',
  standalone: true,
  imports: [CommonModule, RouterModule, RouterOutlet],
  template: `
    <div class="shell">
      <!-- Sidebar -->
      <aside class="sidebar" [class.collapsed]="collapsed()">
        <div class="sidebar-header">
          <div class="brand">
            <div class="brand-mark">M</div>
            <div class="brand-text" *ngIf="!collapsed()">
              <span class="brand-name">Medianet</span>
              <span class="brand-sub">Incubateur</span>
            </div>
          </div>
          <button class="toggle-btn" (click)="toggleCollapsed()" [title]="collapsed() ? 'Agrandir' : 'Réduire'">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16">
              <path *ngIf="!collapsed()" d="M11 19l-7-7 7-7m8 14l-7-7 7-7"/>
              <path *ngIf="collapsed()" d="M13 5l7 7-7 7M5 5l7 7-7 7"/>
            </svg>
          </button>
        </div>

        <nav class="nav">
          <div class="nav-section-label" *ngIf="!collapsed()">Navigation</div>
          <a routerLink="/dashboard" routerLinkActive="nav-active" class="nav-link" [title]="collapsed() ? 'Dashboard' : ''">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/></svg>
            <span class="nav-text" *ngIf="!collapsed()">Dashboard</span>
          </a>
          <a routerLink="/sessions" routerLinkActive="nav-active" class="nav-link" [title]="collapsed() ? 'Sessions' : ''">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
            <span class="nav-text" *ngIf="!collapsed()">Sessions</span>
          </a>
          <a routerLink="/candidatures" routerLinkActive="nav-active" class="nav-link" [title]="collapsed() ? 'Candidatures' : ''">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><polyline points="14,2 14,8 20,8"/><line x1="16" y1="13" x2="8" y2="13"/><line x1="16" y1="17" x2="8" y2="17"/><polyline points="10,9 9,9 8,9"/></svg>
            <span class="nav-text" *ngIf="!collapsed()">Candidatures</span>
          </a>
          <a routerLink="/users" routerLinkActive="nav-active" class="nav-link" [title]="collapsed() ? 'Utilisateurs' : ''">
            <svg class="nav-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
            <span class="nav-text" *ngIf="!collapsed()">Utilisateurs</span>
          </a>
        </nav>

        <div class="sidebar-footer">
          <div class="user-card" *ngIf="!collapsed()">
            <div class="user-avatar-sm">{{ getInitials() }}</div>
            <div class="user-info-sm">
              <span class="user-name-sm">{{ user?.firstName }} {{ user?.lastName }}</span>
              <span class="user-role-sm">Administrateur</span>
            </div>
          </div>
          <div class="user-avatar-sm" *ngIf="collapsed()" style="margin:0 auto" [title]="(user?.firstName ?? '') + ' ' + (user?.lastName ?? '')">{{ getInitials() }}</div>
          <button class="logout-link" (click)="logout()" [title]="collapsed() ? 'Déconnexion' : ''">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><polyline points="16 17 21 12 16 7"/><line x1="21" y1="12" x2="9" y2="12"/></svg>
            <span *ngIf="!collapsed()">Déconnexion</span>
          </button>
        </div>
      </aside>

      <!-- Main -->
      <div class="main">
        <header class="header">
          <div class="breadcrumb">
            <span class="breadcrumb-item">Admin</span>
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><polyline points="9 18 15 12 9 6"/></svg>
            <span class="breadcrumb-current">{{ pageTitle() }}</span>
          </div>
          <div class="header-right">
            <div class="header-user">
              <div class="header-avatar">{{ getInitials() }}</div>
              <div>
                <div class="header-name">{{ user?.firstName }} {{ user?.lastName }}</div>
                <div class="header-role">Administrateur</div>
              </div>
            </div>
          </div>
        </header>
        <main class="content">
          <router-outlet></router-outlet>
        </main>
      </div>
    </div>
  `,
  styles: [`
    :host { display:contents; }
    .shell { display:flex; min-height:100vh; background:#f8fafc; font-family:-apple-system,BlinkMacSystemFont,'Segoe UI',sans-serif; }

    /* Sidebar */
    .sidebar { width:220px; background:#0f172a; color:#e2e8f0; display:flex; flex-direction:column; transition:width 0.25s cubic-bezier(0.4,0,0.2,1); flex-shrink:0; position:sticky; top:0; height:100vh; overflow:hidden; }
    .sidebar.collapsed { width:60px; }
    .sidebar-header { display:flex; align-items:center; justify-content:space-between; padding:1rem 0.75rem; border-bottom:1px solid rgba(255,255,255,0.06); min-height:64px; }
    .brand { display:flex; align-items:center; gap:0.625rem; overflow:hidden; min-width:0; }
    .brand-mark { width:32px; height:32px; background:linear-gradient(135deg,#3b82f6,#8b5cf6); border-radius:8px; display:flex; align-items:center; justify-content:center; font-weight:800; font-size:15px; color:#fff; flex-shrink:0; }
    .brand-text { display:flex; flex-direction:column; overflow:hidden; }
    .brand-name { font-size:0.9rem; font-weight:700; color:#f1f5f9; white-space:nowrap; line-height:1.2; }
    .brand-sub { font-size:0.68rem; color:#64748b; white-space:nowrap; }
    .toggle-btn { background:rgba(255,255,255,0.06); border:none; color:#94a3b8; width:28px; height:28px; border-radius:6px; cursor:pointer; display:flex; align-items:center; justify-content:center; flex-shrink:0; transition:all 0.15s; }
    .toggle-btn:hover { background:rgba(255,255,255,0.1); color:#f1f5f9; }

    .nav { flex:1; padding:0.75rem 0.5rem; overflow-y:auto; }
    .nav-section-label { font-size:0.65rem; font-weight:600; color:#475569; text-transform:uppercase; letter-spacing:0.08em; padding:0 0.5rem; margin-bottom:0.4rem; margin-top:0.5rem; }
    .nav-link { display:flex; align-items:center; gap:0.625rem; padding:0.6rem 0.75rem; border-radius:8px; color:#94a3b8; text-decoration:none; transition:all 0.15s; margin-bottom:0.125rem; font-size:0.875rem; font-weight:500; white-space:nowrap; }
    .nav-link:hover { background:rgba(255,255,255,0.06); color:#e2e8f0; }
    .nav-link.nav-active { background:rgba(59,130,246,0.15); color:#93c5fd; }
    .nav-icon { width:18px; height:18px; flex-shrink:0; }
    .nav-text { }

    .sidebar-footer { padding:0.75rem 0.5rem; border-top:1px solid rgba(255,255,255,0.06); display:flex; flex-direction:column; gap:0.5rem; }
    .user-card { display:flex; align-items:center; gap:0.5rem; padding:0.5rem; border-radius:8px; overflow:hidden; }
    .user-avatar-sm { width:28px; height:28px; background:linear-gradient(135deg,#3b82f6,#8b5cf6); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.7rem; font-weight:700; color:#fff; flex-shrink:0; }
    .user-info-sm { min-width:0; overflow:hidden; }
    .user-name-sm { display:block; font-size:0.8rem; font-weight:600; color:#e2e8f0; white-space:nowrap; overflow:hidden; text-overflow:ellipsis; }
    .user-role-sm { display:block; font-size:0.68rem; color:#64748b; }
    .logout-link { display:flex; align-items:center; gap:0.5rem; padding:0.5rem 0.75rem; border-radius:8px; color:#64748b; background:none; border:none; cursor:pointer; font-size:0.8rem; font-weight:500; transition:all 0.15s; width:100%; }
    .logout-link:hover { background:rgba(239,68,68,0.1); color:#f87171; }

    /* Main */
    .main { flex:1; display:flex; flex-direction:column; min-width:0; overflow:hidden; }
    .header { background:#fff; border-bottom:1px solid #e2e8f0; display:flex; align-items:center; justify-content:space-between; padding:0 1.5rem; height:64px; position:sticky; top:0; z-index:10; }
    .breadcrumb { display:flex; align-items:center; gap:0.4rem; font-size:0.875rem; }
    .breadcrumb-item { color:#94a3b8; }
    .breadcrumb svg { color:#cbd5e1; }
    .breadcrumb-current { color:#0f172a; font-weight:600; }
    .header-right { display:flex; align-items:center; gap:0.75rem; }
    .header-user { display:flex; align-items:center; gap:0.625rem; }
    .header-avatar { width:36px; height:36px; background:linear-gradient(135deg,#3b82f6,#8b5cf6); border-radius:50%; display:flex; align-items:center; justify-content:center; font-size:0.8rem; font-weight:700; color:#fff; }
    .header-name { font-size:0.875rem; font-weight:600; color:#0f172a; line-height:1.3; }
    .header-role { font-size:0.72rem; color:#94a3b8; line-height:1.3; }
    .content { padding:1.5rem; flex:1; overflow-y:auto; }
  `]
})
export class LayoutComponent {
  collapsed = signal(false);
  user = this.authService.getCurrentUser();
  private currentUrl = signal('');

  constructor(private authService: AuthService, private router: Router) {
    this.router.events.pipe(
      filter(e => e instanceof NavigationEnd),
      map(e => (e as NavigationEnd).urlAfterRedirects)
    ).subscribe(url => this.currentUrl.set(url));
  }

  pageTitle(): string {
    const url = this.currentUrl() || this.router.url;
    if (url.includes('dashboard')) return 'Dashboard';
    if (url.includes('sessions')) return 'Sessions';
    if (url.includes('candidatures')) return 'Candidatures';
    if (url.includes('users')) return 'Utilisateurs';
    return 'Medianet Admin';
  }

  toggleCollapsed() { this.collapsed.update(v => !v); }

  getInitials(): string {
    const u = this.user;
    if (!u) return 'A';
    return ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || 'A';
  }

  logout() { this.authService.logout(); }
}
