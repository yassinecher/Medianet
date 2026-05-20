import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { ReactiveFormsModule, FormBuilder, FormGroup, Validators } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CandidatureService } from '../../core/services/candidature.service';
import { AuthService } from '../../core/services/auth.service';

@Component({
  selector: 'app-apply',
  standalone: true,
  imports: [CommonModule, ReactiveFormsModule, RouterModule],
  template: `
    <div class="apply-header">
      <div class="container">
        <a routerLink="/sessions" class="back-link">← Retour aux sessions</a>
        <h1>Déposer ma candidature</h1>
        <p>Complétez les 4 étapes pour soumettre votre projet</p>
      </div>
    </div>

    <div class="container" style="padding:32px 24px 60px;">
      <!-- Progress Bar -->
      <div class="progress-section">
        <div class="progress-steps">
          <div class="step-item" *ngFor="let s of steps; let i = index" [class.active]="currentStep === i + 1" [class.done]="currentStep > i + 1">
            <div class="step-circle">
              <span *ngIf="currentStep <= i + 1">{{ i + 1 }}</span>
              <span *ngIf="currentStep > i + 1">✓</span>
            </div>
            <div class="step-label">{{ s }}</div>
          </div>
        </div>
        <div class="progress-bar">
          <div class="progress-fill" [style.width.%]="((currentStep - 1) / (steps.length - 1)) * 100"></div>
        </div>
      </div>

      <!-- Success Message -->
      <div *ngIf="submitted" class="success-card">
        <div class="success-icon">🎉</div>
        <h2>Candidature soumise avec succès !</h2>
        <p>Votre dossier a été transmis. Vous pouvez suivre son évolution dans "Mon Dossier".</p>
        <a routerLink="/my-application" class="btn btn-primary" style="margin-top:20px;">Voir mon dossier</a>
      </div>

      <div *ngIf="!submitted">
        <!-- Error -->
        <div *ngIf="error" class="alert-error">{{ error }}</div>

        <!-- Step 1 -->
        <div class="form-card" *ngIf="currentStep === 1">
          <h2 class="step-title">Informations du projet</h2>
          <form [formGroup]="step1Form">
            <div class="form-group">
              <label class="form-label">Nom du projet *</label>
              <input type="text" class="form-control" formControlName="projectName" placeholder="Ex: EcoFinance">
              <div class="error-msg" *ngIf="isInvalid(step1Form, 'projectName')">Ce champ est requis</div>
            </div>
            <div class="form-group">
              <label class="form-label">Domaine *</label>
              <select class="form-control" formControlName="domain">
                <option value="">Sélectionner un domaine</option>
                <option *ngFor="let d of domains" [value]="d">{{ d }}</option>
              </select>
              <div class="error-msg" *ngIf="isInvalid(step1Form, 'domain')">Veuillez choisir un domaine</div>
            </div>
            <div class="form-group">
              <label class="form-label">Stade actuel *</label>
              <select class="form-control" formControlName="currentStage">
                <option value="">Sélectionner le stade</option>
                <option *ngFor="let s of stages" [value]="s">{{ s }}</option>
              </select>
              <div class="error-msg" *ngIf="isInvalid(step1Form, 'currentStage')">Veuillez choisir un stade</div>
            </div>
          </form>
        </div>

        <!-- Step 2 -->
        <div class="form-card" *ngIf="currentStep === 2">
          <h2 class="step-title">Description du projet</h2>
          <form [formGroup]="step2Form">
            <div class="form-group">
              <label class="form-label">Description générale *</label>
              <textarea class="form-control" formControlName="projectDescription" rows="4" placeholder="Décrivez votre projet en quelques phrases..."></textarea>
              <div class="error-msg" *ngIf="isInvalid(step2Form, 'projectDescription')">Ce champ est requis (min. 50 caractères)</div>
            </div>
            <div class="form-group">
              <label class="form-label">Problème identifié *</label>
              <textarea class="form-control" formControlName="problemStatement" rows="3" placeholder="Quel problème résolvez-vous ?"></textarea>
              <div class="error-msg" *ngIf="isInvalid(step2Form, 'problemStatement')">Ce champ est requis</div>
            </div>
            <div class="form-group">
              <label class="form-label">Solution proposée *</label>
              <textarea class="form-control" formControlName="solutionDescription" rows="3" placeholder="Comment votre solution résout ce problème ?"></textarea>
              <div class="error-msg" *ngIf="isInvalid(step2Form, 'solutionDescription')">Ce champ est requis</div>
            </div>
          </form>
        </div>

        <!-- Step 3 -->
        <div class="form-card" *ngIf="currentStep === 3">
          <h2 class="step-title">Équipe & Marché</h2>
          <form [formGroup]="step3Form">
            <div class="form-row">
              <div class="form-group">
                <label class="form-label">Taille de l'équipe *</label>
                <input type="number" class="form-control" formControlName="teamSize" min="1" max="50" placeholder="Ex: 3">
                <div class="error-msg" *ngIf="isInvalid(step3Form, 'teamSize')">Entre 1 et 50 membres</div>
              </div>
              <div class="form-group">
                <label class="form-label">Stack technologique *</label>
                <input type="text" class="form-control" formControlName="techStack" placeholder="Ex: React, Node.js, PostgreSQL">
                <div class="error-msg" *ngIf="isInvalid(step3Form, 'techStack')">Ce champ est requis</div>
              </div>
            </div>
            <div class="form-group">
              <label class="form-label">Parcours de l'équipe *</label>
              <textarea class="form-control" formControlName="teamBackground" rows="3" placeholder="Présentez les compétences et l'expérience de votre équipe..."></textarea>
              <div class="error-msg" *ngIf="isInvalid(step3Form, 'teamBackground')">Ce champ est requis</div>
            </div>
            <div class="form-group">
              <label class="form-label">Marché cible *</label>
              <input type="text" class="form-control" formControlName="targetMarket" placeholder="Ex: PME tunisiennes, 18-35 ans, secteur agricole">
              <div class="error-msg" *ngIf="isInvalid(step3Form, 'targetMarket')">Ce champ est requis</div>
            </div>
            <div class="form-group">
              <label class="form-label">Modèle économique *</label>
              <textarea class="form-control" formControlName="businessModel" rows="3" placeholder="Comment allez-vous générer des revenus ?"></textarea>
              <div class="error-msg" *ngIf="isInvalid(step3Form, 'businessModel')">Ce champ est requis</div>
            </div>
          </form>
        </div>

        <!-- Step 4 - Summary -->
        <div class="form-card" *ngIf="currentStep === 4">
          <h2 class="step-title">Récapitulatif & Soumission</h2>
          <div class="summary-grid">
            <div class="summary-section">
              <h3>Informations du projet</h3>
              <div class="summary-item"><span>Nom:</span><strong>{{ step1Form.value.projectName }}</strong></div>
              <div class="summary-item"><span>Domaine:</span><strong>{{ step1Form.value.domain }}</strong></div>
              <div class="summary-item"><span>Stade:</span><strong>{{ step1Form.value.currentStage }}</strong></div>
            </div>
            <div class="summary-section">
              <h3>Description</h3>
              <div class="summary-item"><span>Description:</span><strong>{{ (step2Form.value.projectDescription | slice:0:80) + '...' }}</strong></div>
            </div>
            <div class="summary-section">
              <h3>Équipe & Marché</h3>
              <div class="summary-item"><span>Équipe:</span><strong>{{ step3Form.value.teamSize }} membre(s)</strong></div>
              <div class="summary-item"><span>Tech:</span><strong>{{ step3Form.value.techStack }}</strong></div>
              <div class="summary-item"><span>Marché:</span><strong>{{ step3Form.value.targetMarket }}</strong></div>
            </div>
          </div>
          <div class="submit-note">
            En soumettant ce dossier, vous acceptez les conditions du programme d'incubation Medianet.
          </div>
        </div>

        <!-- Navigation -->
        <div class="step-nav">
          <button class="btn btn-secondary" *ngIf="currentStep > 1" (click)="prevStep()">← Précédent</button>
          <div style="flex:1"></div>
          <button class="btn btn-primary" *ngIf="currentStep < 4" (click)="nextStep()">Suivant →</button>
          <button class="btn btn-accent" *ngIf="currentStep === 4" (click)="submit()" [disabled]="submitting">
            <span *ngIf="submitting" class="spinner-sm"></span>
            {{ submitting ? 'Envoi...' : 'Soumettre ma candidature' }}
          </button>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .apply-header { background:linear-gradient(135deg,#4f46e5 0%,#312e81 100%);color:#fff;padding:48px 0;position:relative;overflow:hidden; }
    .apply-header::after { content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");pointer-events:none; }
    .apply-header h1 { font-size:1.9rem;font-weight:800;margin-bottom:6px;letter-spacing:-0.025em; }
    .apply-header p { color:rgba(255,255,255,0.75); }
    .back-link { color:rgba(255,255,255,0.7);font-size:0.875rem;text-decoration:none;display:block;margin-bottom:12px;font-weight:500;transition:color 0.15s; }
    .back-link:hover { color:#fff; }
    .container { max-width:860px;margin:0 auto;padding:0 24px; }
    .progress-section { margin-bottom:36px; }
    .progress-steps { display:flex;justify-content:space-between;position:relative;margin-bottom:12px; }
    .step-item { display:flex;flex-direction:column;align-items:center;gap:6px;flex:1; }
    .step-circle { width:36px;height:36px;border-radius:50%;border:2px solid #e2e8f0;background:#fff;display:flex;align-items:center;justify-content:center;font-size:0.875rem;font-weight:700;color:#94a3b8;z-index:1;position:relative;transition:all 0.3s; }
    .step-item.active .step-circle { border-color:#6366f1;background:#6366f1;color:#fff;box-shadow:0 4px 12px rgba(99,102,241,0.4); }
    .step-item.done .step-circle { border-color:#10b981;background:#10b981;color:#fff; }
    .step-label { font-size:0.72rem;color:#94a3b8;text-align:center;font-weight:500; }
    .step-item.active .step-label { color:#6366f1;font-weight:700; }
    .step-item.done .step-label { color:#10b981;font-weight:600; }
    .progress-bar { height:4px;background:#e2e8f0;border-radius:2px;overflow:hidden; }
    .progress-fill { height:100%;background:linear-gradient(to right,#6366f1,#8b5cf6);border-radius:2px;transition:width 0.5s cubic-bezier(0.4,0,0.2,1); }
    .success-card { text-align:center;background:#fff;border-radius:20px;padding:60px 40px;box-shadow:0 4px 24px rgba(0,0,0,0.06);border:1px solid #e2e8f0; }
    .success-icon { font-size:4rem;margin-bottom:16px; }
    .success-card h2 { font-size:1.6rem;font-weight:800;color:#0f172a;margin-bottom:10px;letter-spacing:-0.025em; }
    .success-card p { color:#64748b;font-size:1rem; }
    .alert-error { background:#fef2f2;color:#991b1b;padding:12px 16px;border-radius:10px;margin-bottom:20px;font-size:0.9rem;border:1px solid #fecaca; }
    .form-card { background:#fff;border-radius:16px;padding:32px;box-shadow:0 1px 6px rgba(0,0,0,0.05);border:1px solid #e2e8f0;margin-bottom:20px; }
    .step-title { font-size:1.15rem;font-weight:800;color:#0f172a;margin-bottom:24px;padding-bottom:16px;border-bottom:1px solid #f1f5f9;letter-spacing:-0.02em; }
    .form-group { margin-bottom:18px; }
    .form-row { display:grid;grid-template-columns:1fr 1fr;gap:16px; }
    .form-label { display:block;margin-bottom:6px;font-weight:700;font-size:0.8rem;color:#374151;letter-spacing:0.01em; }
    .form-control { width:100%;padding:11px 14px;border:1.5px solid #e2e8f0;border-radius:10px;font-family:inherit;font-size:0.9rem;color:#0f172a;background:#fff;outline:none;transition:all 0.2s; }
    .form-control:focus { border-color:#6366f1;box-shadow:0 0 0 3px rgba(99,102,241,0.12); }
    .form-control::placeholder { color:#94a3b8; }
    textarea.form-control { resize:vertical;min-height:90px; }
    .error-msg { color:#ef4444;font-size:0.78rem;margin-top:4px; }
    .summary-grid { display:flex;flex-direction:column;gap:16px; }
    .summary-section { background:#f8fafc;border-radius:12px;padding:18px;border:1px solid #f1f5f9; }
    .summary-section h3 { font-size:0.75rem;font-weight:800;color:#6366f1;margin-bottom:12px;text-transform:uppercase;letter-spacing:0.08em; }
    .summary-item { display:flex;justify-content:space-between;font-size:0.875rem;padding:5px 0;gap:16px;border-bottom:1px solid #f1f5f9; }
    .summary-item:last-child { border-bottom:none; }
    .summary-item span { color:#64748b;font-weight:500; }
    .summary-item strong { color:#0f172a;text-align:right;font-weight:700; }
    .submit-note { background:#fffbeb;color:#92400e;border-radius:10px;padding:14px;font-size:0.85rem;margin-top:20px;text-align:center;border:1px solid #fef3c7; }
    .step-nav { display:flex;align-items:center;gap:12px;margin-top:8px; }
    .btn { display:inline-flex;align-items:center;justify-content:center;gap:8px;padding:11px 22px;border:none;border-radius:10px;font-family:inherit;font-size:0.9rem;font-weight:700;cursor:pointer;text-decoration:none;transition:all 0.2s;letter-spacing:0.01em; }
    .btn:disabled { opacity:0.6;cursor:not-allowed; }
    .btn-primary { background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;box-shadow:0 3px 10px rgba(99,102,241,0.35); }
    .btn-primary:hover:not(:disabled) { background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;transform:translateY(-1px);box-shadow:0 5px 16px rgba(99,102,241,0.45); }
    .btn-secondary { background:#f1f5f9;color:#475569; }
    .btn-secondary:hover { background:#e2e8f0;color:#334155; }
    .btn-accent { background:linear-gradient(135deg,#f97316,#ea580c);color:#fff;box-shadow:0 3px 10px rgba(249,115,22,0.35); }
    .btn-accent:hover:not(:disabled) { background:linear-gradient(135deg,#ea580c,#c2410c);color:#fff;transform:translateY(-1px); }
    .spinner-sm { width:16px;height:16px;border:2px solid rgba(255,255,255,0.4);border-top-color:#fff;border-radius:50%;animation:spin 0.8s linear infinite;display:inline-block; }
    @keyframes spin { to { transform:rotate(360deg); } }
    @media (max-width:600px) { .form-row { grid-template-columns:1fr; } }
  `]
})
export class ApplyComponent implements OnInit {
  currentStep = 1;
  steps = ['Informations', 'Description', 'Équipe & Marché', 'Récapitulatif'];
  submitted = false;
  submitting = false;
  error = '';
  sessionId!: number;

  domains = ['Fintech', 'HealthTech', 'EdTech', 'AgriTech', 'E-commerce', 'Autre'];
  stages = ['Idée', 'Prototype', 'Label', 'Pré-Label'];

  step1Form!: FormGroup;
  step2Form!: FormGroup;
  step3Form!: FormGroup;

  constructor(
    private fb: FormBuilder,
    private route: ActivatedRoute,
    private router: Router,
    private candidatureService: CandidatureService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.sessionId = Number(this.route.snapshot.paramMap.get('sessionId'));

    // Redirect back to session detail if already applied
    this.candidatureService.getMyCandidatures().subscribe({
      next: (list) => {
        const already = list.find(c => c.sessionId === this.sessionId);
        if (already) {
          this.router.navigate(['/sessions', this.sessionId]);
        }
      },
      error: () => {} // non-blocking
    });

    this.step1Form = this.fb.group({
      projectName: ['', [Validators.required, Validators.minLength(3)]],
      domain: ['', Validators.required],
      currentStage: ['', Validators.required]
    });

    this.step2Form = this.fb.group({
      projectDescription: ['', [Validators.required, Validators.minLength(50)]],
      problemStatement: ['', [Validators.required, Validators.minLength(20)]],
      solutionDescription: ['', [Validators.required, Validators.minLength(20)]]
    });

    this.step3Form = this.fb.group({
      teamSize: [1, [Validators.required, Validators.min(1), Validators.max(50)]],
      techStack: ['', Validators.required],
      teamBackground: ['', [Validators.required, Validators.minLength(20)]],
      targetMarket: ['', Validators.required],
      businessModel: ['', [Validators.required, Validators.minLength(20)]]
    });
  }

  isInvalid(form: FormGroup, field: string): boolean {
    const ctrl = form.get(field);
    return !!(ctrl && ctrl.invalid && (ctrl.dirty || ctrl.touched));
  }

  nextStep(): void {
    const forms = [this.step1Form, this.step2Form, this.step3Form];
    const form = forms[this.currentStep - 1];
    if (form) {
      form.markAllAsTouched();
      if (form.invalid) return;
    }
    if (this.currentStep < 4) this.currentStep++;
  }

  prevStep(): void {
    if (this.currentStep > 1) this.currentStep--;
  }

  submit(): void {
    const user = this.authService.getCurrentUser();
    if (!user) return;

    this.submitting = true;
    this.error = '';

    const data = {
      sessionId: this.sessionId,
      ...this.step1Form.value,
      ...this.step2Form.value,
      ...this.step3Form.value
    };

    this.candidatureService.submitCandidature(data).subscribe({
      next: () => {
        this.submitting = false;
        this.submitted = true;
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.error ?? err?.error?.message ?? 'Une erreur est survenue. Veuillez réessayer.';
      }
    });
  }
}
