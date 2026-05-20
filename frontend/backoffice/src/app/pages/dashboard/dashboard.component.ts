import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { CandidatureService } from '../../core/services/candidature.service';
import { Session, SessionStats } from '../../core/models/session.model';
import { Candidature, CandidatureStats } from '../../core/models/candidature.model';

@Component({
  selector: 'app-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="dashboard">
      <div class="page-header">
        <h1 class="page-title">Dashboard</h1>
        <p class="page-subtitle">Vue d'ensemble du système d'incubation</p>
      </div>

      <!-- KPI Cards -->
      <div class="kpi-grid" *ngIf="sessionStats && candidatureStats">
        <div class="kpi-card blue">
          <div class="kpi-icon">🗓️</div>
          <div class="kpi-content">
            <div class="kpi-value">{{ sessionStats.total }}</div>
            <div class="kpi-label">Sessions totales</div>
            <div class="kpi-sub">{{ sessionStats.open }} actives</div>
          </div>
        </div>
        <div class="kpi-card orange">
          <div class="kpi-icon">📋</div>
          <div class="kpi-content">
            <div class="kpi-value">{{ candidatureStats.total }}</div>
            <div class="kpi-label">Candidatures</div>
            <div class="kpi-sub">{{ candidatureStats.pending }} en attente</div>
          </div>
        </div>
        <div class="kpi-card purple">
          <div class="kpi-icon">⚖️</div>
          <div class="kpi-content">
            <div class="kpi-value">{{ candidatureStats.underEvaluation }}</div>
            <div class="kpi-label">En évaluation</div>
            <div class="kpi-sub">Jurés assignés</div>
          </div>
        </div>
        <div class="kpi-card green">
          <div class="kpi-icon">✅</div>
          <div class="kpi-content">
            <div class="kpi-value">{{ candidatureStats.accepted }}</div>
            <div class="kpi-label">Acceptées</div>
            <div class="kpi-sub">{{ candidatureStats.rejected }} rejetées</div>
          </div>
        </div>
      </div>

      <!-- Status Bar Chart -->
      <div class="charts-row" *ngIf="candidatureStats && candidatureStats.total > 0">
        <div class="chart-card">
          <h3 class="card-title">Répartition des candidatures</h3>
          <div class="bar-chart">
            <div class="bar-item">
              <div class="bar-label">En attente</div>
              <div class="bar-track">
                <div class="bar-fill pending"
                     [style.width.%]="getPercent(candidatureStats.pending, candidatureStats.total)"></div>
              </div>
              <div class="bar-value">{{ candidatureStats.pending }}</div>
            </div>
            <div class="bar-item">
              <div class="bar-label">En évaluation</div>
              <div class="bar-track">
                <div class="bar-fill evaluation"
                     [style.width.%]="getPercent(candidatureStats.underEvaluation, candidatureStats.total)"></div>
              </div>
              <div class="bar-value">{{ candidatureStats.underEvaluation }}</div>
            </div>
            <div class="bar-item">
              <div class="bar-label">Acceptées</div>
              <div class="bar-track">
                <div class="bar-fill accepted"
                     [style.width.%]="getPercent(candidatureStats.accepted, candidatureStats.total)"></div>
              </div>
              <div class="bar-value">{{ candidatureStats.accepted }}</div>
            </div>
            <div class="bar-item">
              <div class="bar-label">Rejetées</div>
              <div class="bar-track">
                <div class="bar-fill rejected"
                     [style.width.%]="getPercent(candidatureStats.rejected, candidatureStats.total)"></div>
              </div>
              <div class="bar-value">{{ candidatureStats.rejected }}</div>
            </div>
          </div>
        </div>

        <div class="chart-card">
          <h3 class="card-title">Répartition des sessions</h3>
          <div class="bar-chart" *ngIf="sessionStats">
            <div class="bar-item">
              <div class="bar-label">Ouvertes</div>
              <div class="bar-track">
                <div class="bar-fill accepted"
                     [style.width.%]="getPercent(sessionStats.open, sessionStats.total)"></div>
              </div>
              <div class="bar-value">{{ sessionStats.open }}</div>
            </div>
            <div class="bar-item">
              <div class="bar-label">En évaluation</div>
              <div class="bar-track">
                <div class="bar-fill evaluation"
                     [style.width.%]="getPercent(sessionStats.evaluation, sessionStats.total)"></div>
              </div>
              <div class="bar-value">{{ sessionStats.evaluation }}</div>
            </div>
            <div class="bar-item">
              <div class="bar-label">Fermées</div>
              <div class="bar-track">
                <div class="bar-fill pending"
                     [style.width.%]="getPercent(sessionStats.closed, sessionStats.total)"></div>
              </div>
              <div class="bar-value">{{ sessionStats.closed }}</div>
            </div>
          </div>
        </div>
      </div>

      <!-- Recent Data -->
      <div class="tables-row">
        <div class="table-card">
          <div class="card-header-row">
            <h3 class="card-title">Sessions récentes</h3>
            <a routerLink="/sessions" class="view-all">Voir tout →</a>
          </div>
          <div class="loading" *ngIf="loadingSessions">Chargement...</div>
          <table class="data-table" *ngIf="recentSessions.length">
            <thead>
              <tr><th>Titre</th><th>Statut</th><th>Deadline</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let s of recentSessions">
                <td><a [routerLink]="['/sessions', s.id]">{{ s.title }}</a></td>
                <td><span [class]="'badge badge-' + s.status.toLowerCase()">{{ statusLabel(s.status) }}</span></td>
                <td>{{ s.submissionDeadline | date:'dd/MM/yy' }}</td>
              </tr>
            </tbody>
          </table>
          <div class="empty-state" *ngIf="!loadingSessions && !recentSessions.length">Aucune session</div>
        </div>

        <div class="table-card">
          <div class="card-header-row">
            <h3 class="card-title">Candidatures récentes</h3>
            <a routerLink="/candidatures" class="view-all">Voir tout →</a>
          </div>
          <div class="loading" *ngIf="loadingCandidatures">Chargement...</div>
          <table class="data-table" *ngIf="recentCandidatures.length">
            <thead>
              <tr><th>Projet</th><th>Statut</th><th>Score</th></tr>
            </thead>
            <tbody>
              <tr *ngFor="let c of recentCandidatures">
                <td><a [routerLink]="['/candidatures', c.id]">{{ c.projectName }}</a></td>
                <td><span [class]="'badge badge-' + c.status.toLowerCase().replace('_', '-')">{{ candStatusLabel(c.status) }}</span></td>
                <td>{{ c.totalScore ? (c.totalScore | number:'1.1-1') + '/10' : '-' }}</td>
              </tr>
            </tbody>
          </table>
          <div class="empty-state" *ngIf="!loadingCandidatures && !recentCandidatures.length">Aucune candidature</div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .dashboard { }
    .page-header { margin-bottom: 1.5rem; }
    .page-title { font-size: 1.75rem; font-weight: 700; color: #1a2332; margin: 0; }
    .page-subtitle { color: #6b7280; margin: 0.25rem 0 0; }

    .kpi-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1.5rem; }
    .kpi-card {
      background: white; border-radius: 12px; padding: 1.25rem;
      display: flex; align-items: center; gap: 1rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.08); border-left: 4px solid;
    }
    .kpi-card.blue { border-color: #1B4F8A; }
    .kpi-card.orange { border-color: #E85D26; }
    .kpi-card.purple { border-color: #7c3aed; }
    .kpi-card.green { border-color: #27AE60; }
    .kpi-icon { font-size: 2rem; }
    .kpi-value { font-size: 2rem; font-weight: 700; color: #1a2332; line-height: 1; }
    .kpi-label { font-size: 0.85rem; color: #6b7280; margin-top: 0.25rem; font-weight: 500; }
    .kpi-sub { font-size: 0.75rem; color: #9ca3af; margin-top: 0.15rem; }

    .charts-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; margin-bottom: 1.5rem; }
    .chart-card { background: white; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card-title { font-size: 1rem; font-weight: 600; color: #1a2332; margin: 0 0 1rem; }

    .bar-chart { display: flex; flex-direction: column; gap: 0.75rem; }
    .bar-item { display: flex; align-items: center; gap: 0.75rem; }
    .bar-label { width: 110px; font-size: 0.8rem; color: #6b7280; flex-shrink: 0; }
    .bar-track { flex: 1; height: 10px; background: #f3f4f6; border-radius: 9999px; overflow: hidden; }
    .bar-fill { height: 100%; border-radius: 9999px; transition: width 0.5s; min-width: 2px; }
    .bar-fill.pending { background: #3b82f6; }
    .bar-fill.evaluation { background: #E85D26; }
    .bar-fill.accepted { background: #27AE60; }
    .bar-fill.rejected { background: #ef4444; }
    .bar-value { width: 30px; font-size: 0.8rem; font-weight: 600; color: #374151; text-align: right; }

    .tables-row { display: grid; grid-template-columns: 1fr 1fr; gap: 1rem; }
    .table-card { background: white; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .view-all { font-size: 0.8rem; color: #1B4F8A; text-decoration: none; font-weight: 500; }
    .data-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
    .data-table th { text-align: left; padding: 0.5rem; color: #6b7280; font-weight: 500; border-bottom: 1px solid #f3f4f6; }
    .data-table td { padding: 0.6rem 0.5rem; border-bottom: 1px solid #f9fafb; }
    .data-table a { color: #1B4F8A; text-decoration: none; font-weight: 500; }
    .data-table a:hover { text-decoration: underline; }
    .empty-state { text-align: center; color: #9ca3af; padding: 2rem; font-size: 0.9rem; }
    .loading { color: #6b7280; font-size: 0.9rem; padding: 1rem 0; }

    .badge { display: inline-block; padding: 0.2rem 0.6rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-open { background: #dbeafe; color: #1d4ed8; }
    .badge-evaluation { background: #fed7aa; color: #c2410c; }
    .badge-closed { background: #d1fae5; color: #065f46; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
    .badge-pending { background: #dbeafe; color: #1d4ed8; }
    .badge-under-evaluation { background: #fed7aa; color: #c2410c; }
    .badge-accepted { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }

    @media (max-width: 1200px) {
      .kpi-grid { grid-template-columns: repeat(2, 1fr); }
      .charts-row, .tables-row { grid-template-columns: 1fr; }
    }
  `]
})
export class DashboardComponent implements OnInit {
  sessionStats: SessionStats | null = null;
  candidatureStats: CandidatureStats | null = null;
  recentSessions: Session[] = [];
  recentCandidatures: Candidature[] = [];
  loadingSessions = true;
  loadingCandidatures = true;

  constructor(
    private sessionService: SessionService,
    private candidatureService: CandidatureService
  ) {}

  ngOnInit() {
    this.sessionService.getStats().subscribe(s => this.sessionStats = s);
    this.candidatureService.getStats().subscribe(s => this.candidatureStats = s);
    this.sessionService.getSessions().subscribe(sessions => {
      this.recentSessions = sessions.slice(0, 5);
      this.loadingSessions = false;
    });
    this.candidatureService.getCandidatures().subscribe(cands => {
      this.recentCandidatures = cands.slice(0, 5);
      this.loadingCandidatures = false;
    });
  }

  getPercent(value: number, total: number): number {
    return total === 0 ? 0 : Math.round((value / total) * 100);
  }

  statusLabel(s: string): string {
    const map: Record<string, string> = { OPEN: 'Ouverte', EVALUATION: 'Évaluation', CLOSED: 'Fermée', CANCELLED: 'Annulée' };
    return map[s] || s;
  }

  candStatusLabel(s: string): string {
    const map: Record<string, string> = { PENDING: 'En attente', UNDER_EVALUATION: 'Évaluation', ACCEPTED: 'Acceptée', REJECTED: 'Rejetée' };
    return map[s] || s;
  }
}
