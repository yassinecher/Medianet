import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule } from '@angular/router';
import { ProfileService } from '../../core/services/profile.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="profile-page">
      <div class="profile-container">

        <!-- Page header -->
        <div class="page-hd">
          <a routerLink="/" class="back-link">
            <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><polyline points="15 18 9 12 15 6"/></svg>
            Retour
          </a>
          <h1>Mon profil</h1>
          <p>Gérez vos informations personnelles et votre mot de passe</p>
        </div>

        <div class="profile-grid">

          <!-- Avatar card -->
          <div class="avatar-card">
            <div class="big-avatar">{{ getInitials() }}</div>
            <div class="avatar-name">{{ user?.firstName }} {{ user?.lastName }}</div>
            <div class="avatar-email">{{ user?.email }}</div>
            <div class="avatar-role">
              <span class="role-chip">{{ roleLabel(user?.role) }}</span>
            </div>
            <div class="avatar-hint">Votre rôle est attribué par l'administrateur</div>
          </div>

          <!-- Forms -->
          <div class="forms-col">

            <!-- Identity card -->
            <div class="form-card">
              <div class="card-header">
                <div class="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><path d="M20 21v-2a4 4 0 0 0-4-4H8a4 4 0 0 0-4 4v2"/><circle cx="12" cy="7" r="4"/></svg>
                </div>
                <div>
                  <h2>Informations personnelles</h2>
                  <p>Modifiez votre prénom et votre nom</p>
                </div>
              </div>

              <div class="alert-success" *ngIf="infoSuccess">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                Profil mis à jour avec succès !
              </div>
              <div class="alert-error" *ngIf="infoError">{{ infoError }}</div>

              <form [formGroup]="infoForm" (ngSubmit)="saveInfo()">
                <div class="form-row">
                  <div class="field">
                    <label class="field-label">Prénom</label>
                    <input class="field-input" type="text" formControlName="firstName" placeholder="Votre prénom">
                    <div class="field-error" *ngIf="infoForm.get('firstName')?.invalid && infoForm.get('firstName')?.touched">Prénom requis</div>
                  </div>
                  <div class="field">
                    <label class="field-label">Nom</label>
                    <input class="field-input" type="text" formControlName="lastName" placeholder="Votre nom">
                    <div class="field-error" *ngIf="infoForm.get('lastName')?.invalid && infoForm.get('lastName')?.touched">Nom requis</div>
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Email</label>
                  <input class="field-input" type="email" [value]="user?.email" disabled>
                  <p class="field-hint">L'email ne peut pas être modifié</p>
                </div>
                <div class="card-footer">
                  <button type="submit" class="btn btn-primary" [disabled]="infoForm.invalid || savingInfo">
                    <svg *ngIf="savingInfo" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    {{ savingInfo ? 'Enregistrement...' : 'Sauvegarder' }}
                  </button>
                </div>
              </form>
            </div>

            <!-- Password card -->
            <div class="form-card">
              <div class="card-header">
                <div class="card-icon">
                  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="18" height="18"><rect x="3" y="11" width="18" height="11" rx="2" ry="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                </div>
                <div>
                  <h2>Changer le mot de passe</h2>
                  <p>Minimum 8 caractères</p>
                </div>
              </div>

              <div class="alert-success" *ngIf="pwSuccess">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/></svg>
                Mot de passe modifié avec succès !
              </div>
              <div class="alert-error" *ngIf="pwError">{{ pwError }}</div>

              <form [formGroup]="pwForm" (ngSubmit)="savePassword()">
                <div class="field">
                  <label class="field-label">Mot de passe actuel</label>
                  <div class="input-wrap">
                    <input class="field-input" [type]="showCurrent ? 'text' : 'password'" formControlName="currentPassword" placeholder="••••••••">
                    <button type="button" class="eye-btn" (click)="showCurrent = !showCurrent">
                      <svg *ngIf="!showCurrent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <svg *ngIf="showCurrent" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                  </div>
                </div>
                <div class="field">
                  <label class="field-label">Nouveau mot de passe</label>
                  <div class="input-wrap">
                    <input class="field-input" [type]="showNew ? 'text' : 'password'" formControlName="newPassword" placeholder="Min. 8 caractères">
                    <button type="button" class="eye-btn" (click)="showNew = !showNew">
                      <svg *ngIf="!showNew" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <svg *ngIf="showNew" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                  </div>
                  <div class="field-error" *ngIf="pwForm.get('newPassword')?.invalid && pwForm.get('newPassword')?.touched">Minimum 8 caractères</div>
                </div>
                <div class="field">
                  <label class="field-label">Confirmer le mot de passe</label>
                  <div class="input-wrap">
                    <input class="field-input" [type]="showConfirm ? 'text' : 'password'" formControlName="confirmPassword" placeholder="••••••••">
                    <button type="button" class="eye-btn" (click)="showConfirm = !showConfirm">
                      <svg *ngIf="!showConfirm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M1 12s4-8 11-8 11 8 11 8-4 8-11 8-11-8-11-8z"/><circle cx="12" cy="12" r="3"/></svg>
                      <svg *ngIf="showConfirm" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M17.94 17.94A10.07 10.07 0 0 1 12 20c-7 0-11-8-11-8a18.45 18.45 0 0 1 5.06-5.94M9.9 4.24A9.12 9.12 0 0 1 12 4c7 0 11 8 11 8a18.5 18.5 0 0 1-2.16 3.19m-6.72-1.07a3 3 0 1 1-4.24-4.24"/><line x1="1" y1="1" x2="23" y2="23"/></svg>
                    </button>
                  </div>
                  <div class="field-error" *ngIf="pwForm.errors?.['mismatch'] && pwForm.get('confirmPassword')?.touched">Les mots de passe ne correspondent pas</div>
                </div>
                <div class="card-footer">
                  <button type="submit" class="btn btn-primary" [disabled]="pwForm.invalid || savingPw">
                    <svg *ngIf="savingPw" class="spin" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="16" height="16"><path d="M21 12a9 9 0 1 1-6.219-8.56"/></svg>
                    {{ savingPw ? 'Enregistrement...' : 'Changer le mot de passe' }}
                  </button>
                </div>
              </form>
            </div>

          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .profile-page { min-height:100vh; background:#f8fafc; padding:0 0 60px; }
    .profile-container { max-width:900px; margin:0 auto; padding:0 24px; }
    .page-hd { padding:32px 0 28px; }
    .back-link { display:inline-flex; align-items:center; gap:6px; color:#64748b; font-size:0.875rem; text-decoration:none; margin-bottom:16px; transition:color 0.15s; font-weight:500; }
    .back-link:hover { color:#6366f1; }
    .page-hd h1 { font-size:1.75rem; font-weight:800; color:#0f172a; margin:0 0 4px; letter-spacing:-0.03em; }
    .page-hd p { color:#64748b; font-size:0.9rem; margin:0; }

    .profile-grid { display:grid; grid-template-columns:240px 1fr; gap:20px; }

    .avatar-card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; padding:28px 20px; display:flex; flex-direction:column; align-items:center; text-align:center; gap:10px; height:fit-content; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
    .big-avatar { width:80px; height:80px; border-radius:50%; background:linear-gradient(135deg,#6366f1,#8b5cf6); display:flex; align-items:center; justify-content:center; font-size:1.6rem; font-weight:800; color:#fff; box-shadow:0 6px 20px rgba(99,102,241,0.35); }
    .avatar-name { font-size:1rem; font-weight:800; color:#0f172a; }
    .avatar-email { font-size:0.78rem; color:#64748b; word-break:break-all; }
    .avatar-role { margin-top:4px; }
    .role-chip { display:inline-block; padding:0.25rem 0.75rem; border-radius:9999px; font-size:0.72rem; font-weight:700; background:#f5f3ff; color:#6d28d9; border:1px solid #ede9fe; }
    .avatar-hint { font-size:0.7rem; color:#94a3b8; margin-top:4px; line-height:1.4; }

    .forms-col { display:flex; flex-direction:column; gap:16px; }
    .form-card { background:#fff; border:1px solid #e2e8f0; border-radius:16px; overflow:hidden; box-shadow:0 1px 4px rgba(0,0,0,0.04); }
    .card-header { display:flex; align-items:flex-start; gap:12px; padding:20px 24px; border-bottom:1px solid #f1f5f9; }
    .card-icon { width:36px; height:36px; background:#f5f3ff; border-radius:10px; display:flex; align-items:center; justify-content:center; color:#6366f1; flex-shrink:0; }
    .card-header h2 { font-size:0.95rem; font-weight:800; color:#0f172a; margin:0 0 2px; }
    .card-header p { font-size:0.78rem; color:#94a3b8; margin:0; }
    form { padding:20px 24px; }
    .card-footer { padding-top:16px; border-top:1px solid #f1f5f9; margin-top:8px; }

    .alert-success { display:flex; align-items:center; gap:8px; background:#f0fdf4; color:#166534; border:1px solid #bbf7d0; padding:10px 14px; border-radius:10px; font-size:0.875rem; margin:0 24px 16px; }
    .alert-error { background:#fef2f2; color:#dc2626; border:1px solid #fecaca; padding:10px 14px; border-radius:10px; font-size:0.875rem; margin:0 24px 16px; }

    .form-row { display:grid; grid-template-columns:1fr 1fr; gap:14px; }
    .field { margin-bottom:14px; }
    .field:last-child { margin-bottom:0; }
    .field-label { display:block; font-size:0.8rem; font-weight:700; color:#374151; margin-bottom:5px; letter-spacing:0.01em; }
    .field-input { width:100%; padding:0.6rem 0.875rem; border:1.5px solid #e2e8f0; border-radius:10px; font-size:0.875rem; color:#0f172a; outline:none; transition:all 0.15s; box-sizing:border-box; font-family:inherit; background:#fff; }
    .field-input:focus { border-color:#6366f1; box-shadow:0 0 0 3px rgba(99,102,241,0.12); }
    .field-input:disabled { background:#f8fafc; color:#94a3b8; cursor:not-allowed; border-color:#f1f5f9; }
    .field-error { font-size:0.75rem; color:#dc2626; margin-top:4px; }
    .field-hint { font-size:0.75rem; color:#94a3b8; margin-top:4px; }
    .input-wrap { position:relative; }
    .input-wrap .field-input { padding-right:2.5rem; }
    .eye-btn { position:absolute; right:10px; top:50%; transform:translateY(-50%); background:none; border:none; cursor:pointer; color:#94a3b8; display:flex; align-items:center; padding:2px; }
    .eye-btn:hover { color:#6366f1; }

    .btn { display:inline-flex; align-items:center; gap:8px; padding:0.6rem 1.4rem; border:none; border-radius:10px; font-family:inherit; font-size:0.875rem; font-weight:700; cursor:pointer; transition:all 0.15s; letter-spacing:0.01em; }
    .btn:disabled { opacity:0.55; cursor:not-allowed; }
    .btn-primary { background:linear-gradient(135deg,#6366f1,#4f46e5); color:#fff; box-shadow:0 3px 10px rgba(99,102,241,0.35); }
    .btn-primary:hover:not(:disabled) { background:linear-gradient(135deg,#4f46e5,#4338ca); transform:translateY(-1px); box-shadow:0 5px 16px rgba(99,102,241,0.45); }
    .spin { animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }

    @media (max-width:680px) {
      .profile-grid { grid-template-columns:1fr; }
      .form-row { grid-template-columns:1fr; }
      .avatar-card { flex-direction:row; text-align:left; padding:16px; }
      .big-avatar { width:56px; height:56px; font-size:1.1rem; flex-shrink:0; }
    }
  `]
})
export class ProfileComponent implements OnInit {
  user = this.authService.getCurrentUser();
  infoForm!: FormGroup;
  pwForm!: FormGroup;
  savingInfo = false;
  savingPw = false;
  infoSuccess = false;
  infoError = '';
  pwSuccess = false;
  pwError = '';
  showCurrent = false;
  showNew = false;
  showConfirm = false;

  constructor(
    private fb: FormBuilder,
    private profileService: ProfileService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.infoForm = this.fb.group({
      firstName: [this.user?.firstName ?? '', Validators.required],
      lastName: [this.user?.lastName ?? '', Validators.required]
    });

    this.pwForm = this.fb.group({
      currentPassword: ['', Validators.required],
      newPassword: ['', [Validators.required, Validators.minLength(8)]],
      confirmPassword: ['', Validators.required]
    }, { validators: this.passwordMatch });
  }

  passwordMatch(g: FormGroup) {
    return g.get('newPassword')?.value === g.get('confirmPassword')?.value ? null : { mismatch: true };
  }

  saveInfo(): void {
    if (this.infoForm.invalid) return;
    this.savingInfo = true;
    this.infoError = '';
    this.infoSuccess = false;
    this.profileService.updateProfile(this.infoForm.value).subscribe({
      next: () => {
        this.savingInfo = false;
        this.infoSuccess = true;
        const current = this.authService.getCurrentUser();
        if (current) {
          const updated2 = { ...current, firstName: this.infoForm.value.firstName, lastName: this.infoForm.value.lastName };
          localStorage.setItem('medianet_user', JSON.stringify(updated2));
          this.authService.currentUser$.next(updated2);
          this.user = updated2;
        }
        setTimeout(() => this.infoSuccess = false, 4000);
      },
      error: (err: any) => {
        this.savingInfo = false;
        this.infoError = err?.error?.error ?? 'Une erreur est survenue';
      }
    });
  }

  savePassword(): void {
    if (this.pwForm.invalid) return;
    this.savingPw = true;
    this.pwError = '';
    this.pwSuccess = false;
    const { currentPassword, newPassword } = this.pwForm.value;
    this.profileService.updateProfile({
      firstName: this.user?.firstName ?? '',
      lastName: this.user?.lastName ?? '',
      currentPassword,
      newPassword
    }).subscribe({
      next: () => {
        this.savingPw = false;
        this.pwSuccess = true;
        this.pwForm.reset();
        setTimeout(() => this.pwSuccess = false, 4000);
      },
      error: (err: any) => {
        this.savingPw = false;
        this.pwError = err?.error?.error ?? 'Une erreur est survenue';
      }
    });
  }

  getInitials(): string {
    return ((this.user?.firstName?.[0] || '') + (this.user?.lastName?.[0] || '')).toUpperCase() || '?';
  }

  roleLabel(role?: string): string {
    const map: Record<string, string> = { PORTEUR: 'Porteur de projet', JURY: 'Jury', ADMIN: 'Admin', MENTOR: 'Mentor', CANDIDAT: 'Candidat' };
    return map[role ?? ''] ?? (role ?? '');
  }
}
