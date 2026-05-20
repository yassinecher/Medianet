import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router, ActivatedRoute, RouterModule } from '@angular/router';
import { SessionService } from '../../core/services/session.service';

@Component({
  selector: 'app-session-form',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">{{ isEdit ? 'Modifier la session' : 'Nouvelle session' }}</h1>
          <p class="page-subtitle">{{ isEdit ? 'Modifier les informations de la session' : 'Créer une nouvelle session d\'incubation' }}</p>
        </div>
        <a routerLink="/sessions" class="btn btn-outline">← Retour</a>
      </div>

      <div class="form-card">
        <form (ngSubmit)="onSubmit()" #f="ngForm">
          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Titre de la session *</label>
              <input type="text" class="form-control" [(ngModel)]="form.title" name="title"
                     placeholder="ex: Session d'incubation 2025 — Cohorte 1" required>
            </div>
            <div class="form-group">
              <label class="form-label">Nombre maximum de projets</label>
              <input type="number" class="form-control" [(ngModel)]="form.maxProjects" name="maxProjects"
                     placeholder="ex: 15" min="1">
            </div>
          </div>

          <div class="form-group">
            <label class="form-label">Description</label>
            <textarea class="form-control" [(ngModel)]="form.description" name="description" rows="4"
                      placeholder="Décrivez les objectifs et le contexte de cette session d'incubation..."></textarea>
          </div>

          <div class="form-row">
            <div class="form-group">
              <label class="form-label">Date de début *</label>
              <input type="date" class="form-control" [(ngModel)]="form.startDate" name="startDate" required>
            </div>
            <div class="form-group">
              <label class="form-label">Date de fin *</label>
              <input type="date" class="form-control" [(ngModel)]="form.endDate" name="endDate" required>
            </div>
            <div class="form-group">
              <label class="form-label">Deadline de soumission *</label>
              <input type="date" class="form-control" [(ngModel)]="form.submissionDeadline" name="submissionDeadline" required>
            </div>
          </div>

          <div class="alert alert-danger" *ngIf="error">{{ error }}</div>
          <div class="alert alert-success" *ngIf="success">Session {{ isEdit ? 'modifiée' : 'créée' }} avec succès !</div>

          <div class="form-actions">
            <a routerLink="/sessions" class="btn btn-outline">Annuler</a>
            <button type="submit" class="btn btn-primary" [disabled]="loading || !f.valid">
              {{ loading ? 'Enregistrement...' : (isEdit ? 'Sauvegarder' : 'Créer la session') }}
            </button>
          </div>
        </form>
      </div>
    </div>
  `,
  styles: [`
    .page { }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    .page-title { font-size: 1.75rem; font-weight: 700; color: #1a2332; margin: 0; }
    .page-subtitle { color: #6b7280; margin: 0.25rem 0 0; }
    .form-card { background: white; border-radius: 12px; padding: 2rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); max-width: 900px; }
    .form-row { display: grid; grid-template-columns: repeat(auto-fit, minmax(200px, 1fr)); gap: 1rem; }
    .form-group { margin-bottom: 1.25rem; }
    .form-label { display: block; font-weight: 500; margin-bottom: 0.4rem; color: #374151; font-size: 0.9rem; }
    .form-control { width: 100%; padding: 0.75rem 1rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 0.95rem; box-sizing: border-box; font-family: inherit; }
    .form-control:focus { outline: none; border-color: #1B4F8A; }
    textarea.form-control { resize: vertical; }
    .alert { padding: 0.75rem 1rem; border-radius: 8px; margin-bottom: 1rem; font-size: 0.9rem; }
    .alert-danger { background: #fef2f2; color: #dc2626; border: 1px solid #fca5a5; }
    .alert-success { background: #f0fdf4; color: #16a34a; border: 1px solid #86efac; }
    .form-actions { display: flex; gap: 0.75rem; justify-content: flex-end; margin-top: 1rem; }
    .btn { display: inline-block; padding: 0.625rem 1.5rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.9rem; }
    .btn-primary { background: #1B4F8A; color: white; }
    .btn-primary:hover:not(:disabled) { background: #153d6f; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-outline { background: white; color: #1B4F8A; border: 1.5px solid #1B4F8A; }
  `]
})
export class SessionFormComponent implements OnInit {
  isEdit = false;
  sessionId: number | null = null;
  loading = false;
  error = '';
  success = false;

  form = {
    title: '',
    description: '',
    startDate: '',
    endDate: '',
    submissionDeadline: '',
    maxProjects: null as number | null
  };

  constructor(
    private sessionService: SessionService,
    private router: Router,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    this.sessionId = this.route.snapshot.params['id'] ? +this.route.snapshot.params['id'] : null;
    this.isEdit = !!this.sessionId;
    if (this.isEdit && this.sessionId) {
      this.sessionService.getSession(this.sessionId).subscribe(s => {
        this.form.title = s.title;
        this.form.description = s.description;
        this.form.startDate = s.startDate;
        this.form.endDate = s.endDate;
        this.form.submissionDeadline = s.submissionDeadline;
        this.form.maxProjects = s.maxProjects;
      });
    }
  }

  onSubmit() {
    this.error = '';
    this.loading = true;
    const payload = { ...this.form, maxProjects: this.form.maxProjects ?? 0 };
    const obs = this.isEdit && this.sessionId
      ? this.sessionService.updateSession(this.sessionId, payload)
      : this.sessionService.createSession(payload);

    obs.subscribe({
      next: (session) => {
        this.loading = false;
        this.success = true;
        setTimeout(() => this.router.navigate(['/sessions', session.id]), 1500);
      },
      error: (err) => {
        this.error = err.error?.error || 'Une erreur est survenue';
        this.loading = false;
      }
    });
  }
}
