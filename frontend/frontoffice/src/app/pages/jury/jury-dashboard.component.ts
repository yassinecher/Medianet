import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CandidatureService } from '../../core/services/candidature.service';
import { AuthService } from '../../core/services/auth.service';
import { Candidature } from '../../core/models/candidature.model';

@Component({
  selector: 'app-jury-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header">
      <div class="container">
        <h1>Mes Évaluations</h1>
        <p>Candidatures qui vous sont assignées pour évaluation</p>
      </div>
    </div>

    <div class="container main-content">

      <div class="stats-row" *ngIf="!loading">
        <div class="stat-card">
          <div class="stat-num">{{ total }}</div>
          <div class="stat-label">Total assignées</div>
        </div>
        <div class="stat-card orange">
          <div class="stat-num">{{ pending }}</div>
          <div class="stat-label">En attente</div>
        </div>
        <div class="stat-card green">
          <div class="stat-num">{{ done }}</div>
          <div class="stat-label">Évaluées</div>
        </div>
      </div>

      <div class="loading" *ngIf="loading">Chargement...</div>

      <div class="empty" *ngIf="!loading && candidatures.length === 0">
        <div class="empty-icon">📋</div>
        <h3>Aucune candidature assignée</h3>
        <p>Les candidatures vous seront assignées par l'administrateur.</p>
      </div>

      <div class="cards-grid" *ngIf="!loading && candidatures.length > 0">
        <div class="cand-card" *ngFor="let c of candidatures" [class.evaluated]="hasMyEval(c)">
          <div class="card-top">
            <div class="project-info">
              <h3>{{ c.projectName }}</h3>
              <span class="domain-badge">{{ c.domain }}</span>
            </div>
            <div class="card-status" [class]="'status-' + c.status.toLowerCase()">
              {{ statusLabel(c.status) }}
            </div>
          </div>

          <p class="card-desc">{{ (c.projectDescription || '') | slice:0:120 }}{{ (c.projectDescription?.length ?? 0) > 120 ? '...' : '' }}</p>

          <div class="card-meta">
            <span>👤 {{ c.porteurName }}</span>
            <span>📅 {{ c.submittedAt | date:'dd/MM/yyyy' }}</span>
            <span *ngIf="c.teamSize">👥 {{ c.teamSize }} membre(s)</span>
          </div>

          <div class="eval-status" *ngIf="hasMyEval(c)">
            <span class="eval-badge">✓ Évalué — Score: {{ getMyScore(c) | number:'1.1-1' }}/10</span>
          </div>
          <div class="eval-status pending" *ngIf="!hasMyEval(c)">
            <span class="eval-badge pending">⏳ En attente de votre évaluation</span>
          </div>

          <div class="card-actions">
            <a [routerLink]="['/jury/evaluate', c.id]" class="btn btn-primary btn-sm">
              {{ hasMyEval(c) ? evalBtnLabel : 'Évaluer' }}
            </a>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header { background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%); color: #fff; padding: 40px 0; }
    .page-header h1 { font-size: 1.8rem; font-weight: 800; margin-bottom: 6px; letter-spacing: -0.02em; }
    .page-header p { color: rgba(255,255,255,0.75); margin: 0; }
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .main-content { padding-top: 32px; padding-bottom: 60px; }
    .stats-row { display: flex; gap: 16px; margin-bottom: 32px; flex-wrap: wrap; }
    .stat-card { background: #fff; border-radius: 14px; padding: 20px 28px; box-shadow: 0 1px 4px rgba(0,0,0,0.06); border: 1px solid #e2e8f0; min-width: 140px; }
    .stat-card.orange .stat-num { color: #f59e0b; }
    .stat-card.green .stat-num { color: #10b981; }
    .stat-num { font-size: 2.2rem; font-weight: 800; color: #6366f1; line-height: 1; }
    .stat-label { font-size: 0.78rem; color: #94a3b8; margin-top: 6px; font-weight: 500; }
    .loading { text-align: center; padding: 60px; color: #94a3b8; }
    .empty { text-align: center; padding: 60px 20px; background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; }
    .empty-icon { font-size: 3rem; margin-bottom: 12px; }
    .empty h3 { color: #1e293b; font-size: 1.1rem; margin-bottom: 8px; font-weight: 700; }
    .empty p { color: #64748b; font-size: 0.9rem; }
    .cards-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 20px; }
    .cand-card { background: #fff; border-radius: 14px; padding: 22px; border: 1.5px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.05); transition: all 0.22s; }
    .cand-card:hover { box-shadow: 0 8px 28px rgba(99,102,241,0.12); border-color: #c7d2fe; transform: translateY(-2px); }
    .cand-card.evaluated { border-color: #86efac; }
    .card-top { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 10px; gap: 8px; }
    .project-info h3 { font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0 0 4px; }
    .domain-badge { font-size: 0.72rem; background: #f5f3ff; color: #6d28d9; border: 1px solid #ede9fe; padding: 2px 9px; border-radius: 20px; }
    .card-status { font-size: 0.72rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.04em; }
    .status-pending { background: #fef3c7; color: #92400e; }
    .status-under_evaluation { background: #dbeafe; color: #1e40af; }
    .status-accepted { background: #d1fae5; color: #065f46; }
    .status-rejected { background: #fee2e2; color: #991b1b; }
    .card-desc { font-size: 0.85rem; color: #475569; line-height: 1.55; margin-bottom: 12px; }
    .card-meta { display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.78rem; color: #64748b; margin-bottom: 12px; }
    .eval-status { margin-bottom: 14px; }
    .eval-badge { display: inline-block; font-size: 0.78rem; font-weight: 700; padding: 4px 12px; border-radius: 20px; background: #d1fae5; color: #065f46; }
    .eval-badge.pending { background: #fef3c7; color: #92400e; }
    .card-actions { display: flex; gap: 8px; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 8px 18px; border: none; border-radius: 9px; font-family: inherit; font-size: 0.875rem; font-weight: 700; cursor: pointer; text-decoration: none; transition: all 0.2s; }
    .btn-primary { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; box-shadow: 0 3px 10px rgba(99,102,241,0.3); }
    .btn-primary:hover { transform: translateY(-1px); box-shadow: 0 5px 16px rgba(99,102,241,0.4); }
    .btn-sm { padding: 7px 14px; font-size: 0.82rem; }
    @media (max-width: 600px) { .cards-grid { grid-template-columns: 1fr; } .stats-row { gap: 10px; } }
  `]
})
export class JuryDashboardComponent implements OnInit {
  candidatures: Candidature[] = [];
  loading = true;
  juryId!: number;
  readonly evalBtnLabel = "Modifier l’évaluation";

  constructor(
    private candidatureService: CandidatureService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    const user = this.authService.getCurrentUser();
    this.juryId = user?.userId ?? 0;
    this.candidatureService.getMyJuryAssignments().subscribe({
      next: (data) => { this.candidatures = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  get total() { return this.candidatures.length; }
  get pending() { return this.candidatures.filter(c => !this.hasMyEval(c)).length; }
  get done() { return this.candidatures.filter(c => this.hasMyEval(c)).length; }

  hasMyEval(c: Candidature): boolean {
    return c.evaluations?.some(e => e.juryId === this.juryId) ?? false;
  }

  getMyScore(c: Candidature): number {
    const ev = c.evaluations?.find(e => e.juryId === this.juryId);
    return ev?.weightedScore ?? 0;
  }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'En attente',
      UNDER_EVALUATION: 'En évaluation',
      ACCEPTED: 'Acceptée',
      REJECTED: 'Rejetée'
    };
    return map[status] ?? status;
  }
}
