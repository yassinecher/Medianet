import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';
import { AuthResponse } from '../../core/models/user.model';

@Component({
  selector: 'app-navbar',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <nav class="navbar">
      <div class="navbar-container">
        <a routerLink="/" class="navbar-brand">
          <div class="brand-logo">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="18" height="18">
              <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
            </svg>
          </div>
          <span class="brand-text">Medianet <span>Incubateur</span></span>
        </a>

        <button class="hamburger" (click)="toggleMenu()" [class.open]="menuOpen" aria-label="Menu">
          <span></span><span></span><span></span>
        </button>

        <div class="navbar-links" [class.open]="menuOpen">
          <a routerLink="/" routerLinkActive="active" [routerLinkActiveOptions]="{exact:true}" class="nav-link" (click)="closeMenu()">Accueil</a>
          <a routerLink="/sessions" routerLinkActive="active" class="nav-link" (click)="closeMenu()">Sessions</a>
        </div>

        <div class="navbar-actions" [class.open]="menuOpen">
          <ng-container *ngIf="currentUser; else guestActions">
            <!-- Single dashboard entry for all authenticated users -->
            <a routerLink="/dashboard" class="nav-link dashboard-link" routerLinkActive="active" (click)="closeMenu()">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14" style="flex-shrink:0">
                <path d="M1 2.5A1.5 1.5 0 012.5 1h3A1.5 1.5 0 017 2.5v3A1.5 1.5 0 015.5 7h-3A1.5 1.5 0 011 5.5v-3zm8 0A1.5 1.5 0 0110.5 1h3A1.5 1.5 0 0115 2.5v3A1.5 1.5 0 0113.5 7h-3A1.5 1.5 0 019 5.5v-3zm-8 8A1.5 1.5 0 012.5 9h3A1.5 1.5 0 017 10.5v3A1.5 1.5 0 015.5 15h-3A1.5 1.5 0 011 13.5v-3zm8 0A1.5 1.5 0 0110.5 9h3A1.5 1.5 0 0115 10.5v3A1.5 1.5 0 0113.5 15h-3A1.5 1.5 0 019 13.5v-3z"/>
              </svg>
              Tableau de bord
            </a>
            <a routerLink="/profile" class="nav-link" routerLinkActive="active" (click)="closeMenu()">
              Profil
            </a>
            <div class="user-info">
              <span class="user-avatar" [title]="rolesDisplay">{{ getInitials() }}</span>
              <div class="user-details">
                <span class="user-name">{{ currentUser.firstName }}</span>
                <div class="role-badges">
                  <span *ngFor="let r of userRoles" [class]="'role-chip role-' + r.toLowerCase()">
                    {{ roleLabel(r) }}
                  </span>
                </div>
              </div>
            </div>
            <button class="btn btn-outline btn-sm" (click)="logout()">Déconnexion</button>
          </ng-container>
          <ng-template #guestActions>
            <a routerLink="/login" class="btn btn-outline btn-sm" (click)="closeMenu()">Connexion</a>
            <a routerLink="/register" class="btn btn-primary btn-sm" (click)="closeMenu()">S'inscrire</a>
          </ng-template>
        </div>
      </div>
    </nav>
  `,
  styles: [`
    .navbar {
      background: rgba(255,255,255,0.95);
      backdrop-filter: blur(12px);
      -webkit-backdrop-filter: blur(12px);
      border-bottom: 1px solid rgba(226,232,240,0.8);
      position: sticky;
      top: 0;
      z-index: 100;
      box-shadow: 0 1px 8px rgba(0,0,0,0.05);
    }
    .navbar-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      height: 68px;
      display: flex;
      align-items: center;
      gap: 24px;
    }
    .navbar-brand {
      display: flex;
      align-items: center;
      gap: 10px;
      text-decoration: none;
      flex-shrink: 0;
    }
    .brand-logo {
      width: 36px; height: 36px;
      border-radius: 10px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(99,102,241,0.35);
    }
    .brand-logo svg { color: #fff; }
    .brand-text {
      font-size: 1.05rem;
      font-weight: 800;
      color: #0f172a;
      white-space: nowrap;
      letter-spacing: -0.02em;
    }
    .brand-text span { color: #6366f1; }
    .navbar-links {
      display: flex;
      align-items: center;
      gap: 2px;
      flex: 1;
    }
    .nav-link {
      padding: 7px 14px;
      border-radius: 8px;
      font-size: 0.875rem;
      font-weight: 600;
      color: #64748b;
      text-decoration: none;
      transition: all 0.18s;
    }
    .nav-link:hover { background: #f5f3ff; color: #6366f1; }
    .nav-link.active { background: #f5f3ff; color: #6366f1; }
    .dashboard-link { display: flex; align-items: center; gap: 6px; }
    .navbar-actions {
      display: flex;
      align-items: center;
      gap: 10px;
      margin-left: auto;
    }
    .user-info {
      display: flex;
      align-items: center;
      gap: 9px;
    }
    .user-avatar {
      width: 34px;
      height: 34px;
      border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 0.78rem;
      font-weight: 800;
      box-shadow: 0 2px 8px rgba(99,102,241,0.3);
    }
    .user-details { display: flex; flex-direction: column; gap: 2px; }
    .user-name {
      font-size: 0.85rem;
      font-weight: 700;
      color: #0f172a;
      line-height: 1.2;
    }
    .role-badges { display: flex; gap: 3px; flex-wrap: wrap; }
    .role-chip {
      font-size: 0.6rem;
      font-weight: 700;
      padding: 1px 6px;
      border-radius: 9999px;
      white-space: nowrap;
      letter-spacing: 0.02em;
    }
    .role-admin    { background: #f3e8ff; color: #6b21a8; }
    .role-porteur  { background: #eff6ff; color: #2563eb; }
    .role-jury     { background: #fefce8; color: #854d0e; }
    .role-mentor   { background: #f0fdf4; color: #166534; }
    .role-candidat { background: #f1f5f9; color: #475569; }
    .hamburger {
      display: none;
      flex-direction: column;
      gap: 5px;
      background: none;
      border: none;
      cursor: pointer;
      padding: 4px;
      margin-left: auto;
    }
    .hamburger span {
      display: block;
      width: 24px;
      height: 2px;
      background: #64748b;
      border-radius: 2px;
      transition: all 0.3s;
    }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 18px; border: none; border-radius: 8px; font-family: inherit; font-size: 0.85rem; font-weight: 700; cursor: pointer; text-decoration: none; transition: all 0.2s; white-space: nowrap; letter-spacing: 0.01em; }
    .btn-sm { padding: 7px 16px; font-size: 0.82rem; }
    .btn-primary { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; box-shadow: 0 2px 8px rgba(99,102,241,0.3); }
    .btn-primary:hover { background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff; transform: translateY(-1px); box-shadow: 0 4px 14px rgba(99,102,241,0.4); }
    .btn-outline { background: transparent; color: #6366f1; border: 1.5px solid #c7d2fe; }
    .btn-outline:hover { background: #f5f3ff; border-color: #6366f1; }
    @media (max-width: 768px) {
      .hamburger { display: flex; }
      .navbar-container { flex-wrap: wrap; height: auto; padding: 12px 16px; }
      .navbar-links, .navbar-actions {
        display: none;
        width: 100%;
        flex-direction: column;
        align-items: flex-start;
        padding: 12px 0;
        border-top: 1px solid #e2e8f0;
        gap: 8px;
      }
      .navbar-links.open, .navbar-actions.open { display: flex; }
      .navbar-actions { margin-left: 0; }
    }
  `]
})
export class NavbarComponent implements OnInit {
  currentUser: AuthResponse | null = null;
  menuOpen = false;

  constructor(private authService: AuthService, private router: Router) {}

  ngOnInit(): void {
    this.authService.currentUser$.subscribe(user => {
      this.currentUser = user;
    });
  }

  /** All roles the current user has (multi-role aware) */
  get userRoles(): string[] {
    if (!this.currentUser) return [];
    if (this.currentUser.roles?.length) return this.currentUser.roles;
    return this.currentUser.role ? [this.currentUser.role] : [];
  }

  get rolesDisplay(): string {
    return this.userRoles.map(r => this.roleLabel(r)).join(', ');
  }

  hasRole(role: string): boolean {
    return this.userRoles.includes(role);
  }

  getInitials(): string {
    if (!this.currentUser) return '';
    return `${this.currentUser.firstName?.[0] ?? ''}${this.currentUser.lastName?.[0] ?? ''}`.toUpperCase();
  }

  roleLabel(role: string): string {
    const map: Record<string, string> = {
      PORTEUR:  'Porteur',
      JURY:     'Jury',
      ADMIN:    'Admin',
      MENTOR:   'Mentor',
      CANDIDAT: 'Candidat'
    };
    return map[role] ?? role;
  }

  toggleMenu(): void { this.menuOpen = !this.menuOpen; }
  closeMenu():  void { this.menuOpen = false; }

  logout(): void {
    this.authService.logout();
    this.closeMenu();
  }
}
