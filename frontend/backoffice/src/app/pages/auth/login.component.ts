import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, RouterModule } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-login',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="login-page">
      <div class="login-card">
        <div class="login-logo">
          <div class="logo-icon">M</div>
          <h1>Medianet</h1>
          <p>Espace Administrateur</p>
        </div>
        <form (ngSubmit)="onSubmit()" #loginForm="ngForm">
          <div class="form-group">
            <label class="form-label">Email</label>
            <input type="email" class="form-control" [(ngModel)]="email" name="email"
                   placeholder="admin@medianet.tn" required>
          </div>
          <div class="form-group">
            <label class="form-label">Mot de passe</label>
            <input type="password" class="form-control" [(ngModel)]="password" name="password"
                   placeholder="••••••••" required>
          </div>
          <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
          <button type="submit" class="btn-login" [disabled]="loading">
            {{ loading ? 'Connexion...' : 'Se connecter' }}
          </button>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .login-page {
      min-height: 100vh;
      background: linear-gradient(135deg, #1B4F8A 0%, #0d2d52 100%);
      display: flex;
      align-items: center;
      justify-content: center;
      padding: 1rem;
    }
    .login-card {
      background: white;
      border-radius: 16px;
      padding: 2.5rem;
      width: 100%;
      max-width: 420px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.3);
    }
    .login-logo {
      text-align: center;
      margin-bottom: 2rem;
    }
    .logo-icon {
      width: 64px;
      height: 64px;
      background: linear-gradient(135deg, #1B4F8A, #E85D26);
      border-radius: 16px;
      display: flex;
      align-items: center;
      justify-content: center;
      font-size: 28px;
      font-weight: 800;
      color: white;
      margin: 0 auto 1rem;
    }
    .login-logo h1 { font-size: 1.5rem; font-weight: 700; color: #1B4F8A; margin: 0; }
    .login-logo p { color: #666; margin: 0.25rem 0 0; font-size: 0.9rem; }
    .form-group { margin-bottom: 1.25rem; }
    .form-label { display: block; font-weight: 500; margin-bottom: 0.4rem; color: #333; font-size: 0.9rem; }
    .form-control {
      width: 100%; padding: 0.75rem 1rem; border: 1.5px solid #e0e0e0;
      border-radius: 8px; font-size: 0.95rem; transition: border-color 0.2s;
      box-sizing: border-box;
    }
    .form-control:focus { outline: none; border-color: #1B4F8A; }
    .alert { padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
    .alert-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
    .btn-login {
      width: 100%; padding: 0.875rem; background: linear-gradient(135deg, #1B4F8A, #2563eb);
      color: white; border: none; border-radius: 8px; font-size: 1rem; font-weight: 600;
      cursor: pointer; transition: opacity 0.2s;
    }
    .btn-login:hover { opacity: 0.9; }
    .btn-login:disabled { opacity: 0.6; cursor: not-allowed; }
  `]
})
export class LoginComponent {
  email = '';
  password = '';
  error = '';
  loading = false;

  constructor(private authService: AuthService, private router: Router) {}

  onSubmit() {
    this.error = '';
    this.loading = true;
    this.authService.login(this.email, this.password).subscribe({
      next: () => this.router.navigate(['/dashboard']),
      error: (err) => {
        this.error = err.error?.error || err.message || 'Identifiants invalides';
        this.loading = false;
      }
    });
  }
}
