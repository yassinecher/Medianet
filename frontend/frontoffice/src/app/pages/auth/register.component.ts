import { Component } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, Router } from '@angular/router';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-register',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="auth-page">
      <div class="auth-container">
        <div class="auth-card">
          <div class="auth-header">
            <div class="brand-logo">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="26" height="26">
                <path d="M13 2L3 14h9l-1 8 10-12h-9l1-8z"/>
              </svg>
            </div>
            <h1>Créer un compte</h1>
            <p>Rejoignez Medianet Incubateur et lancez votre projet</p>
          </div>

          <div *ngIf="error" class="alert-error">
            <span>⚠️</span> {{ error }}
          </div>

          <div *ngIf="success" class="alert-success">
            <span>✅</span> Compte créé avec succès ! Redirection...
          </div>

          <form [formGroup]="registerForm" (ngSubmit)="submit()">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Prénom *</label>
                <input type="text" class="form-control" formControlName="firstName" placeholder="Ex: Ahmed" [class.error]="isInvalid('firstName')">
                <div class="error-msg" *ngIf="isInvalid('firstName')">Prénom requis</div>
              </div>
              <div class="form-group">
                <label class="form-label">Nom *</label>
                <input type="text" class="form-control" formControlName="lastName" placeholder="Ex: Ben Ali" [class.error]="isInvalid('lastName')">
                <div class="error-msg" *ngIf="isInvalid('lastName')">Nom requis</div>
              </div>
            </div>

            <div class="form-group">
              <label class="form-label">Email *</label>
              <input type="email" class="form-control" formControlName="email" placeholder="votre@email.com" [class.error]="isInvalid('email')">
              <div class="error-msg" *ngIf="isInvalid('email')">Email invalide</div>
            </div>

            <div class="form-group">
              <label class="form-label">Mot de passe *</label>
              <div class="input-wrap">
                <input [type]="showPassword ? 'text' : 'password'" class="form-control" formControlName="password" placeholder="Min. 8 caractères" [class.error]="isInvalid('password')">
                <button type="button" class="toggle-pw" (click)="showPassword = !showPassword">
                  {{ showPassword ? '🙈' : '👁️' }}
                </button>
              </div>
              <div class="error-msg" *ngIf="isInvalid('password')">Mot de passe requis (min. 8 caractères)</div>
            </div>

            <div class="form-group">
              <label class="form-label">Rôle</label>
              <div class="role-info">
                <span class="role-badge">👤 Porteur de projet</span>
                <p class="role-desc">Vous vous inscrivez en tant que porteur de projet pour soumettre votre candidature.</p>
              </div>
              <input type="hidden" formControlName="role" value="PORTEUR">
            </div>

            <button type="submit" class="btn btn-primary btn-full" [disabled]="loading">
              <span *ngIf="loading" class="spinner-sm"></span>
              {{ loading ? 'Création...' : 'Créer mon compte' }}
            </button>
          </form>

          <div class="auth-footer">
            <p>Déjà un compte ? <a routerLink="/login">Se connecter</a></p>
            <p style="margin-top:8px;"><a routerLink="/" class="back-home">← Retour à l'accueil</a></p>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .auth-page { min-height:100vh;background:linear-gradient(135deg,#1e1b4b 0%,#312e81 40%,#4338ca 100%);display:flex;align-items:center;justify-content:center;padding:24px;position:relative;overflow:hidden; }
    .auth-page::before { content:'';position:absolute;inset:0;background:radial-gradient(circle at 20% 30%,rgba(99,102,241,0.35) 0%,transparent 50%),radial-gradient(circle at 80% 70%,rgba(139,92,246,0.25) 0%,transparent 50%);pointer-events:none; }
    .auth-container { width:100%;max-width:480px;position:relative;z-index:1; }
    .auth-card { background:rgba(255,255,255,0.97);border-radius:24px;padding:40px;box-shadow:0 24px 80px rgba(0,0,0,0.28),0 0 0 1px rgba(255,255,255,0.12); }
    .auth-header { text-align:center;margin-bottom:28px; }
    .brand-logo { display:inline-flex;align-items:center;justify-content:center;width:52px;height:52px;border-radius:14px;background:linear-gradient(135deg,#6366f1,#8b5cf6);margin-bottom:16px;box-shadow:0 8px 24px rgba(99,102,241,0.4); }
    .brand-logo svg { color:#fff; }
    .auth-header h1 { font-size:1.6rem;font-weight:800;color:#0f172a;margin-bottom:6px;letter-spacing:-0.025em; }
    .auth-header p { color:#64748b;font-size:0.9rem; }
    .alert-error { background:#fef2f2;color:#991b1b;border:1px solid #fecaca;padding:12px 16px;border-radius:10px;margin-bottom:20px;font-size:0.875rem;display:flex;align-items:center;gap:8px; }
    .alert-success { background:#f0fdf4;color:#166534;border:1px solid #bbf7d0;padding:12px 16px;border-radius:10px;margin-bottom:20px;font-size:0.875rem;display:flex;align-items:center;gap:8px; }
    .form-row { display:grid;grid-template-columns:1fr 1fr;gap:14px; }
    .form-group { margin-bottom:16px; }
    .form-label { display:block;margin-bottom:6px;font-weight:600;font-size:0.82rem;color:#374151;letter-spacing:0.01em; }
    .form-control { width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:0.9rem;color:#0f172a;outline:none;transition:all 0.2s;background:#fff; }
    .form-control:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,0.12); }
    .form-control::placeholder { color:#94a3b8; }
    .form-control.error { border-color:#ef4444; }
    .input-wrap { position:relative; }
    .input-wrap .form-control { padding-right:44px; }
    .toggle-pw { position:absolute;right:12px;top:50%;transform:translateY(-50%);background:none;border:none;cursor:pointer;font-size:1rem;padding:4px;color:#94a3b8; }
    .error-msg { color:#ef4444;font-size:0.78rem;margin-top:4px; }
    .role-info { background:#f5f3ff;border-radius:10px;padding:14px;margin-top:4px;border:1px solid #ede9fe; }
    .role-badge { background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;padding:4px 12px;border-radius:20px;font-size:0.8rem;font-weight:600; }
    .role-desc { color:#6b7280;font-size:0.8rem;margin-top:8px; }
    .btn { display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:13px 20px;border:none;border-radius:10px;font-family:inherit;font-size:0.95rem;font-weight:700;cursor:pointer;transition:all 0.2s;letter-spacing:0.01em; }
    .btn:disabled { opacity:0.6;cursor:not-allowed; }
    .btn-primary { background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;box-shadow:0 4px 14px rgba(99,102,241,0.4); }
    .btn-primary:hover:not(:disabled) { background:linear-gradient(135deg,#4f46e5,#4338ca);transform:translateY(-1px);box-shadow:0 6px 20px rgba(99,102,241,0.5); }
    .btn-full { width:100%;margin-top:4px; }
    .spinner-sm { width:16px;height:16px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .auth-footer { text-align:center;margin-top:24px;font-size:0.875rem;color:#64748b; }
    .auth-footer a { color:#6366f1;font-weight:600;text-decoration:none; }
    .auth-footer a:hover { color:#4f46e5;text-decoration:underline; }
    .back-home { color:#94a3b8 !important;font-weight:400 !important; }
    .back-home:hover { color:#64748b !important; }
    @media (max-width:480px) { .form-row { grid-template-columns:1fr; } .auth-card { padding:28px 20px; } }
  `]
})
export class RegisterComponent {
  registerForm: FormGroup;
  loading = false;
  error = '';
  success = false;
  showPassword = false;

  constructor(private fb: FormBuilder, private authService: AuthService, private router: Router) {
    this.registerForm = this.fb.group({
      firstName: ['', Validators.required],
      lastName: ['', Validators.required],
      email: ['', [Validators.required, Validators.email]],
      password: ['', [Validators.required, Validators.minLength(8)]],
      role: ['PORTEUR']
    });
  }

  isInvalid(field: string): boolean {
    const ctrl = this.registerForm.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  submit(): void {
    this.registerForm.markAllAsTouched();
    if (this.registerForm.invalid) return;

    this.loading = true;
    this.error = '';

    this.authService.register(this.registerForm.value).subscribe({
      next: () => {
        this.loading = false;
        this.success = true;
        setTimeout(() => this.router.navigate(['/']), 1500);
      },
      error: (err) => {
        this.loading = false;
        this.error = err?.error?.error ?? err?.error?.message ?? 'Une erreur est survenue. Veuillez réessayer.';
      }
    });
  }
}
