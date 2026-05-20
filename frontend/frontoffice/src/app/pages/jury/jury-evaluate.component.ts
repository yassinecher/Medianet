import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { CandidatureService } from '../../core/services/candidature.service';
import { AuthService } from '../../core/services/auth.service';
import { Candidature } from '../../core/models/candidature.model';

@Component({
  selector: 'app-jury-evaluate',
  standalone: true,
  imports: [CommonModule, FormsModule, RouterModule],
  template: `
    <div class="eval-header">
      <div class="container">
        <a routerLink="/jury" class="back-link">← Retour à mes évaluations</a>
        <h1>Évaluation de candidature</h1>
        <p *ngIf="candidature">{{ candidature.projectName }}</p>
      </div>
    </div>

    <div class="container main-content">
      <div class="loading" *ngIf="loading">Chargement...</div>

      <div *ngIf="!loading && candidature" class="layout">

        <!-- Left: Project Details -->
        <div class="project-panel">
          <div class="panel-card">
            <h2>{{ candidature.projectName }}</h2>
            <span class="domain-badge">{{ candidature.domain }}</span>
            <p class="porteur-info">👤 {{ candidature.porteurName }} &nbsp;|&nbsp; 📅 {{ candidature.submittedAt | date:'dd/MM/yyyy' }}</p>

            <div class="section">
              <h4>Description générale</h4>
              <p>{{ candidature.projectDescription }}</p>
            </div>
            <div class="section">
              <h4>Problème identifié</h4>
              <p>{{ candidature.problemStatement }}</p>
            </div>
            <div class="section">
              <h4>Solution proposée</h4>
              <p>{{ candidature.solutionDescription }}</p>
            </div>
            <div class="section">
              <h4>Modèle économique</h4>
              <p>{{ candidature.businessModel }}</p>
            </div>
            <div class="section">
              <h4>Équipe</h4>
              <p>{{ candidature.teamBackground }}</p>
              <p class="meta">👥 {{ candidature.teamSize }} membre(s) &nbsp;|&nbsp; 💻 {{ candidature.techStack }}</p>
            </div>
            <div class="section">
              <h4>Marché cible</h4>
              <p>{{ candidature.targetMarket }}</p>
            </div>
          </div>
        </div>

        <!-- Right: Evaluation Form -->
        <div class="eval-panel">
          <div class="panel-card">
            <h3>Grille d'évaluation</h3>
            <p class="eval-hint">Attribuez une note de 0 à 10 pour chaque critère</p>

            <div *ngIf="success" class="alert-success">✅ Évaluation soumise avec succès !</div>
            <div *ngIf="error" class="alert-error">{{ error }}</div>

            <div class="criterion">
              <div class="criterion-header">
                <span class="criterion-name">💡 Innovation</span>
                <span class="criterion-weight">Poids : 30%</span>
                <span class="score-display">{{ scores.innovation }}/10</span>
              </div>
              <input type="range" min="0" max="10" step="1" [(ngModel)]="scores.innovation" class="score-range">
              <div class="score-ticks"><span>0</span><span>5</span><span>10</span></div>
              <p class="criterion-desc">Originalité, différenciation et potentiel disruptif du projet</p>
            </div>

            <div class="criterion">
              <div class="criterion-header">
                <span class="criterion-name">⚙️ Faisabilité</span>
                <span class="criterion-weight">Poids : 25%</span>
                <span class="score-display">{{ scores.feasibility }}/10</span>
              </div>
              <input type="range" min="0" max="10" step="1" [(ngModel)]="scores.feasibility" class="score-range">
              <div class="score-ticks"><span>0</span><span>5</span><span>10</span></div>
              <p class="criterion-desc">Viabilité technique, ressources disponibles et plan d'exécution</p>
            </div>

            <div class="criterion">
              <div class="criterion-header">
                <span class="criterion-name">📈 Impact marché</span>
                <span class="criterion-weight">Poids : 25%</span>
                <span class="score-display">{{ scores.marketImpact }}/10</span>
              </div>
              <input type="range" min="0" max="10" step="1" [(ngModel)]="scores.marketImpact" class="score-range">
              <div class="score-ticks"><span>0</span><span>5</span><span>10</span></div>
              <p class="criterion-desc">Taille du marché, potentiel de croissance et modèle économique</p>
            </div>

            <div class="criterion">
              <div class="criterion-header">
                <span class="criterion-name">👥 Qualité d'équipe</span>
                <span class="criterion-weight">Poids : 20%</span>
                <span class="score-display">{{ scores.teamQuality }}/10</span>
              </div>
              <input type="range" min="0" max="10" step="1" [(ngModel)]="scores.teamQuality" class="score-range">
              <div class="score-ticks"><span>0</span><span>5</span><span>10</span></div>
              <p class="criterion-desc">Compétences, complémentarité et expérience de l'équipe</p>
            </div>

            <div class="weighted-score">
              <div class="ws-label">Score pondéré estimé</div>
              <div class="ws-value">{{ weightedScore | number:'1.2-2' }} / 10</div>
              <div class="ws-formula">= Innovation×0.30 + Faisabilité×0.25 + Marché×0.25 + Équipe×0.20</div>
            </div>

            <div class="form-group">
              <label class="form-label">Commentaire (optionnel)</label>
              <textarea class="form-control" [(ngModel)]="comment" rows="4"
                        placeholder="Justifiez vos notes, partagez vos observations..."></textarea>
            </div>

            <button class="btn btn-primary btn-full" (click)="submit()" [disabled]="submitting">
              {{ submitting ? 'Envoi en cours...' : submitLabel }}
            </button>
          </div>
        </div>

      </div>
    </div>
  `,
  styles: [`
    .eval-header { background: linear-gradient(135deg, #1B4F8A 0%, #143d6b 100%); color: #fff; padding: 36px 0; }
    .eval-header h1 { font-size: 1.6rem; font-weight: 700; margin-bottom: 4px; }
    .eval-header p { color: rgba(255,255,255,0.8); margin: 0; font-size: 1rem; }
    .back-link { color: rgba(255,255,255,0.8); font-size: 0.875rem; text-decoration: none; display: block; margin-bottom: 10px; }
    .back-link:hover { color: #fff; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .main-content { padding-top: 32px; padding-bottom: 60px; }
    .loading { text-align: center; padding: 60px; color: #718096; }
    .layout { display: grid; grid-template-columns: 1fr 420px; gap: 24px; align-items: start; }
    .panel-card { background: #fff; border-radius: 12px; padding: 28px; border: 1px solid #E2E8F0; box-shadow: 0 1px 4px rgba(0,0,0,0.06); }
    .project-panel .panel-card h2 { font-size: 1.3rem; font-weight: 700; color: #1A202C; margin-bottom: 8px; }
    .domain-badge { background: #EEF2F7; color: #4A5568; font-size: 0.78rem; padding: 3px 10px; border-radius: 20px; display: inline-block; }
    .porteur-info { color: #718096; font-size: 0.85rem; margin: 10px 0 20px; }
    .section { margin-bottom: 18px; }
    .section h4 { font-size: 0.82rem; font-weight: 600; color: #4A5568; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 6px; }
    .section p { color: #2D3748; font-size: 0.9rem; line-height: 1.6; margin: 0; }
    .section .meta { color: #718096; font-size: 0.82rem; margin-top: 6px; }
    .eval-panel .panel-card h3 { font-size: 1.1rem; font-weight: 700; color: #1A202C; margin-bottom: 4px; }
    .eval-hint { color: #718096; font-size: 0.85rem; margin-bottom: 20px; }
    .alert-success { background: #d1fae5; color: #065f46; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 0.875rem; }
    .alert-error { background: #fee2e2; color: #991b1b; padding: 10px 14px; border-radius: 8px; margin-bottom: 16px; font-size: 0.875rem; }
    .criterion { margin-bottom: 22px; padding-bottom: 18px; border-bottom: 1px solid #F0F4F8; }
    .criterion:last-of-type { border-bottom: none; }
    .criterion-header { display: flex; align-items: center; gap: 8px; margin-bottom: 8px; flex-wrap: wrap; }
    .criterion-name { font-weight: 600; font-size: 0.9rem; color: #2D3748; flex: 1; }
    .criterion-weight { font-size: 0.75rem; color: #718096; background: #F0F4F8; padding: 2px 8px; border-radius: 10px; }
    .score-display { font-size: 1rem; font-weight: 700; color: #1B4F8A; min-width: 44px; text-align: right; }
    .score-range { width: 100%; -webkit-appearance: none; height: 6px; border-radius: 3px; background: linear-gradient(to right, #1B4F8A var(--val, 50%), #E2E8F0 var(--val, 50%)); outline: none; cursor: pointer; margin-bottom: 2px; }
    .score-range::-webkit-slider-thumb { -webkit-appearance: none; width: 18px; height: 18px; border-radius: 50%; background: #1B4F8A; cursor: pointer; box-shadow: 0 1px 4px rgba(0,0,0,0.2); }
    .score-ticks { display: flex; justify-content: space-between; font-size: 0.7rem; color: #A0AEC0; margin-bottom: 6px; }
    .criterion-desc { font-size: 0.78rem; color: #718096; margin: 0; }
    .weighted-score { background: linear-gradient(135deg, #1B4F8A, #2563eb); border-radius: 10px; padding: 16px 20px; color: #fff; margin: 20px 0; text-align: center; }
    .ws-label { font-size: 0.8rem; opacity: 0.85; margin-bottom: 4px; }
    .ws-value { font-size: 2rem; font-weight: 700; }
    .ws-formula { font-size: 0.7rem; opacity: 0.75; margin-top: 4px; }
    .form-group { margin-bottom: 18px; }
    .form-label { display: block; margin-bottom: 6px; font-weight: 500; font-size: 0.875rem; color: #4A5568; }
    .form-control { width: 100%; padding: 10px 14px; border: 1.5px solid #CBD5E0; border-radius: 8px; font-family: inherit; font-size: 0.9rem; resize: vertical; outline: none; box-sizing: border-box; }
    .form-control:focus { border-color: #1B4F8A; box-shadow: 0 0 0 3px rgba(27,79,138,0.1); }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 11px 22px; border: none; border-radius: 8px; font-family: inherit; font-size: 0.95rem; font-weight: 600; cursor: pointer; transition: all 0.2s; }
    .btn:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-primary { background: #1B4F8A; color: #fff; }
    .btn-primary:hover:not(:disabled) { background: #143d6b; }
    .btn-full { width: 100%; }
    @media (max-width: 768px) { .layout { grid-template-columns: 1fr; } }
  `]
})
export class JuryEvaluateComponent implements OnInit {
  candidature: Candidature | null = null;
  loading = true;
  submitting = false;
  success = false;
  error = '';
  alreadyEvaluated = false;
  juryId!: number;
  juryEmail!: string;
  juryName!: string;
  comment = '';

  scores = { innovation: 5, feasibility: 5, marketImpact: 5, teamQuality: 5 };

  constructor(
    private candidatureService: CandidatureService,
    private authService: AuthService,
    private route: ActivatedRoute,
    private router: Router
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.juryId = user?.userId ?? 0;
    this.juryEmail = user?.email ?? '';
    this.juryName = `${user?.firstName ?? ''} ${user?.lastName ?? ''}`.trim();

    const id = Number(this.route.snapshot.paramMap.get('id'));
    this.candidatureService.getCandidatureById(id).subscribe({
      next: (c) => {
        this.candidature = c;
        this.loading = false;
        // Pre-fill if already evaluated
        const existing = c.evaluations?.find(e => e.juryId === this.juryId);
        if (existing) {
          this.alreadyEvaluated = true;
          this.scores.innovation = existing.innovationScore;
          this.scores.feasibility = existing.feasibilityScore;
          this.scores.marketImpact = existing.marketImpactScore;
          this.scores.teamQuality = existing.teamQualityScore;
          this.comment = existing.comment ?? '';
        }
      },
      error: () => { this.loading = false; this.router.navigate(['/jury']); }
    });
  }

  get submitLabel(): string {
    return this.alreadyEvaluated ? "Mettre à jour l'évaluation" : "Soumettre l'évaluation";
  }

  get weightedScore(): number {
    return this.scores.innovation * 0.30 +
           this.scores.feasibility * 0.25 +
           this.scores.marketImpact * 0.25 +
           this.scores.teamQuality * 0.20;
  }

  submit(): void {
    if (!this.candidature) return;
    this.submitting = true;
    this.error = '';
    this.success = false;

    this.candidatureService.evaluate(this.candidature.id, {
      juryEmail: this.juryEmail,
      juryName: this.juryName,
      innovationScore: this.scores.innovation,
      feasibilityScore: this.scores.feasibility,
      marketImpactScore: this.scores.marketImpact,
      teamQualityScore: this.scores.teamQuality,
      comment: this.comment
    }).subscribe({
      next: (updated) => {
        this.submitting = false;
        this.success = true;
        this.candidature = updated;
        this.alreadyEvaluated = true;
        setTimeout(() => this.router.navigate(['/jury']), 2000);
      },
      error: (err) => {
        this.submitting = false;
        this.error = err?.error?.error ?? 'Une erreur est survenue.';
      }
    });
  }
}
