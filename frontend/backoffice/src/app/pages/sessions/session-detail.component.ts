import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { CandidatureService } from '../../core/services/candidature.service';
import { Session } from '../../core/models/session.model';
import { Candidature } from '../../core/models/candidature.model';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page" *ngIf="session">
      <div class="page-header">
        <div>
          <a routerLink="/sessions" class="back-link">← Sessions</a>
          <h1 class="page-title">{{ session.title }}</h1>
        </div>
        <div class="header-actions">
          <a [routerLink]="['/sessions', session.id, 'edit']" class="btn btn-outline">Modifier</a>
          <div class="status-select-wrap" *ngIf="session.status !== 'CLOSED' && session.status !== 'CANCELLED'">
            <select class="status-select" (change)="changeStatus($event)">
              <option value="">Changer statut</option>
              <option value="OPEN" *ngIf="session.status !== 'OPEN'">→ Ouvrir</option>
              <option value="EVALUATION" *ngIf="session.status === 'OPEN'">→ Évaluation</option>
              <option value="CLOSED">→ Fermer</option>
              <option value="CANCELLED">→ Annuler</option>
            </select>
          </div>
        </div>
      </div>

      <!-- Info Cards -->
      <div class="info-grid">
        <div class="info-card">
          <div class="info-icon">📅</div>
          <div>
            <div class="info-label">Période</div>
            <div class="info-value">{{ session.startDate | date:'dd/MM/yyyy' }} → {{ session.endDate | date:'dd/MM/yyyy' }}</div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon">⏰</div>
          <div>
            <div class="info-label">Deadline soumission</div>
            <div class="info-value">{{ session.submissionDeadline | date:'dd/MM/yyyy' }}</div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon">📊</div>
          <div>
            <div class="info-label">Statut</div>
            <div><span [class]="'badge badge-' + session.status.toLowerCase()">{{ statusLabel(session.status) }}</span></div>
          </div>
        </div>
        <div class="info-card">
          <div class="info-icon">🏗️</div>
          <div>
            <div class="info-label">Max projets</div>
            <div class="info-value">{{ session.maxProjects || 'Illimité' }}</div>
          </div>
        </div>
      </div>

      <div class="desc-card" *ngIf="session.description">
        <h3>Description</h3>
        <p>{{ session.description }}</p>
      </div>

      <!-- Candidatures -->
      <div class="card">
        <div class="card-header-row">
          <h3 class="card-title">Candidatures ({{ candidatures.length }})</h3>
          <a routerLink="/candidatures" [queryParams]="{sessionId: session.id}" class="view-all">Voir tout</a>
        </div>

        <div class="cand-stats" *ngIf="candidatures.length">
          <div class="stat-pill pending">En attente: {{ getCount('PENDING') }}</div>
          <div class="stat-pill evaluation">Évaluation: {{ getCount('UNDER_EVALUATION') }}</div>
          <div class="stat-pill accepted">Acceptées: {{ getCount('ACCEPTED') }}</div>
          <div class="stat-pill rejected">Rejetées: {{ getCount('REJECTED') }}</div>
        </div>

        <div class="empty-state" *ngIf="!loadingCands && candidatures.length === 0">Aucune candidature pour cette session</div>
        <table class="data-table" *ngIf="candidatures.length">
          <thead>
            <tr><th>Projet</th><th>Porteur</th><th>Statut</th><th>Score</th><th>Actions</th></tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of candidatures">
              <td><a [routerLink]="['/candidatures', c.id]" class="title-link">{{ c.projectName }}</a></td>
              <td>{{ c.porteurName || c.porteurEmail }}</td>
              <td><span [class]="'badge badge-' + c.status.toLowerCase().replace('_', '-')">{{ candLabel(c.status) }}</span></td>
              <td>{{ c.totalScore ? (c.totalScore | number:'1.1-1') + '/10' : '-' }}</td>
              <td><a [routerLink]="['/candidatures', c.id]" class="action-btn">Voir</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>

    <div class="loading-page" *ngIf="!session">Chargement...</div>
  `,
  styles: [`
    .loading-page { display: flex; align-items: center; justify-content: center; height: 60vh; color: #6b7280; font-size: 1.1rem; }
    .back-link { color: #6b7280; text-decoration: none; font-size: 0.9rem; display: block; margin-bottom: 0.25rem; }
    .back-link:hover { color: #1B4F8A; }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    .page-title { font-size: 1.75rem; font-weight: 700; color: #1a2332; margin: 0; }
    .header-actions { display: flex; gap: 0.75rem; align-items: center; }
    .btn { padding: 0.5rem 1.25rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: 1.5px solid #1B4F8A; background: white; color: #1B4F8A; text-decoration: none; font-size: 0.9rem; }

    .info-grid { display: grid; grid-template-columns: repeat(4, 1fr); gap: 1rem; margin-bottom: 1rem; }
    .info-card { background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); display: flex; align-items: center; gap: 0.75rem; }
    .info-icon { font-size: 1.5rem; }
    .info-label { font-size: 0.75rem; color: #9ca3af; font-weight: 500; }
    .info-value { font-size: 0.9rem; font-weight: 600; color: #1a2332; margin-top: 0.15rem; }

    .desc-card { background: white; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .desc-card h3 { margin: 0 0 0.75rem; font-size: 1rem; color: #1a2332; }
    .desc-card p { margin: 0; color: #374151; line-height: 1.6; }

    .card { background: white; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); }
    .card-header-row { display: flex; justify-content: space-between; align-items: center; margin-bottom: 1rem; }
    .card-title { font-size: 1rem; font-weight: 600; color: #1a2332; margin: 0; }
    .view-all { font-size: 0.8rem; color: #1B4F8A; text-decoration: none; }

    .cand-stats { display: flex; gap: 0.5rem; flex-wrap: wrap; margin-bottom: 1rem; }
    .stat-pill { padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; }
    .stat-pill.pending { background: #dbeafe; color: #1d4ed8; }
    .stat-pill.evaluation { background: #fed7aa; color: #c2410c; }
    .stat-pill.accepted { background: #d1fae5; color: #065f46; }
    .stat-pill.rejected { background: #fee2e2; color: #991b1b; }

    .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .data-table th { text-align: left; padding: 0.75rem; color: #6b7280; font-weight: 500; border-bottom: 1px solid #f3f4f6; }
    .data-table td { padding: 0.75rem; border-bottom: 1px solid #f9fafb; }
    .title-link { color: #1B4F8A; font-weight: 600; text-decoration: none; }
    .action-btn { padding: 0.25rem 0.75rem; background: #eff6ff; color: #1d4ed8; border-radius: 6px; font-size: 0.8rem; text-decoration: none; }
    .empty-state { text-align: center; color: #9ca3af; padding: 3rem; }

    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-open { background: #dbeafe; color: #1d4ed8; }
    .badge-evaluation { background: #fed7aa; color: #c2410c; }
    .badge-closed { background: #d1fae5; color: #065f46; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }
    .badge-pending { background: #dbeafe; color: #1d4ed8; }
    .badge-under-evaluation { background: #fed7aa; color: #c2410c; }
    .badge-accepted { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }

    .status-select { padding: 0.5rem; border-radius: 8px; border: 1.5px solid #e5e7eb; cursor: pointer; }
    @media (max-width: 900px) { .info-grid { grid-template-columns: repeat(2, 1fr); } }
  `]
})
export class SessionDetailComponent implements OnInit {
  session: Session | null = null;
  candidatures: Candidature[] = [];
  loadingCands = true;

  constructor(
    private sessionService: SessionService,
    private candidatureService: CandidatureService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const id = +this.route.snapshot.params['id'];
    this.sessionService.getSession(id).subscribe(s => {
      this.session = s;
      this.candidatureService.getCandidatures(undefined, id).subscribe(cands => {
        this.candidatures = cands;
        this.loadingCands = false;
      });
    });
  }

  changeStatus(event: Event) {
    const status = (event.target as HTMLSelectElement).value;
    if (!status || !this.session) return;
    this.sessionService.changeStatus(this.session.id, status).subscribe(s => {
      this.session = s;
      (event.target as HTMLSelectElement).value = '';
    });
  }

  getCount(status: string) { return this.candidatures.filter(c => c.status === status).length; }
  statusLabel(s: string) { return { OPEN: 'Ouverte', EVALUATION: 'Évaluation', CLOSED: 'Fermée', CANCELLED: 'Annulée' }[s] || s; }
  candLabel(s: string) { return { PENDING: 'En attente', UNDER_EVALUATION: 'Évaluation', ACCEPTED: 'Acceptée', REJECTED: 'Rejetée' }[s] || s; }
}
