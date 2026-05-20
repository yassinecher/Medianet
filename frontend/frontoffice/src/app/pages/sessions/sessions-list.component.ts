import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { Session } from '../../core/models/session.model';

@Component({
  selector: 'app-sessions-list',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header-section">
      <div class="container">
        <h1>Sessions d'incubation</h1>
        <p>Découvrez toutes nos sessions et candidatez au programme qui vous correspond</p>
      </div>
    </div>

    <div class="container" style="padding-top: 32px; padding-bottom: 48px;">
      <!-- Filter Tabs -->
      <div class="filter-tabs">
        <button
          *ngFor="let tab of tabs"
          class="filter-tab"
          [class.active]="activeFilter === tab.value"
          (click)="setFilter(tab.value)">
          {{ tab.label }}
          <span class="tab-count">{{ getCount(tab.value) }}</span>
        </button>
      </div>

      <!-- Loading -->
      <div *ngIf="loading" class="spinner-overlay">
        <div class="spinner"></div>
      </div>

      <!-- Empty -->
      <div *ngIf="!loading && filteredSessions.length === 0" class="empty-state">
        <div style="font-size:3rem;margin-bottom:12px;">📭</div>
        <h3>Aucune session trouvée</h3>
        <p>Essayez un autre filtre ou revenez ultérieurement.</p>
      </div>

      <!-- Sessions Grid -->
      <div class="sessions-grid" *ngIf="!loading && filteredSessions.length > 0">
        <div class="session-card" *ngFor="let session of filteredSessions">
          <div class="card-top">
            <span class="badge" [ngClass]="'badge-' + session.status.toLowerCase()">
              {{ getStatusLabel(session.status) }}
            </span>
            <span class="days-left" *ngIf="session.status === 'OPEN' && getDaysLeft(session.submissionDeadline) > 0">
              {{ getDaysLeft(session.submissionDeadline) }} jours restants
            </span>
          </div>
          <h2 class="session-title">{{ session.title }}</h2>
          <p class="session-desc">{{ session.description | slice:0:150 }}{{ session.description.length > 150 ? '...' : '' }}</p>

          <div class="session-details">
            <div class="detail-row">
              <span class="detail-label">📅 Début</span>
              <span>{{ session.startDate | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">📅 Fin</span>
              <span>{{ session.endDate | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">⏰ Deadline</span>
              <span class="deadline-text">{{ session.submissionDeadline | date:'dd/MM/yyyy' }}</span>
            </div>
            <div class="detail-row">
              <span class="detail-label">🏢 Max projets</span>
              <span>{{ session.maxProjects }}</span>
            </div>
          </div>

          <a [routerLink]="['/sessions', session.id]" class="btn btn-primary" style="width:100%;text-align:center;">
            Voir les détails →
          </a>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header-section {
      background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%);
      color: #fff;
      padding: 52px 0;
      position: relative;
      overflow: hidden;
    }
    .page-header-section::after {
      content: '';
      position: absolute;
      inset: 0;
      background: url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");
      pointer-events: none;
    }
    .page-header-section h1 { font-size: 2.1rem; font-weight: 800; margin-bottom: 8px; letter-spacing: -0.025em; }
    .page-header-section p { color: rgba(255,255,255,0.75); font-size: 1rem; }
    .container { max-width: 1200px; margin: 0 auto; padding: 0 24px; }
    .filter-tabs { display: flex; gap: 8px; margin-bottom: 28px; flex-wrap: wrap; }
    .filter-tab {
      display: flex; align-items: center; gap: 8px;
      padding: 8px 18px; border: 1.5px solid #e2e8f0; border-radius: 9999px;
      background: #fff; font-family: inherit; font-size: 0.875rem; font-weight: 600;
      color: #64748b; cursor: pointer; transition: all 0.18s;
    }
    .filter-tab:hover { border-color: #6366f1; color: #6366f1; background: #f5f3ff; }
    .filter-tab.active { background: #6366f1; color: #fff; border-color: #6366f1; box-shadow: 0 4px 12px rgba(99,102,241,0.3); }
    .tab-count { background: rgba(255,255,255,0.25); padding: 1px 8px; border-radius: 10px; font-size: 0.72rem; }
    .filter-tab:not(.active) .tab-count { background: #f1f5f9; color: #64748b; }
    .spinner-overlay { display: flex; align-items: center; justify-content: center; padding: 60px; }
    .spinner { width: 40px; height: 40px; border: 3px solid #e2e8f0; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }
    .empty-state { text-align: center; padding: 60px 20px; color: #64748b; background: #fff; border-radius: 16px; border: 1px dashed #e2e8f0; }
    .empty-state h3 { font-size: 1.2rem; color: #334155; margin-bottom: 8px; font-weight: 700; }
    .sessions-grid { display: grid; grid-template-columns: repeat(3, 1fr); gap: 24px; }
    .session-card {
      background: #fff; border-radius: 16px; padding: 24px;
      box-shadow: 0 1px 4px rgba(0,0,0,0.06), 0 0 0 1px rgba(0,0,0,0.04);
      display: flex; flex-direction: column; gap: 16px;
      transition: all 0.22s;
    }
    .session-card:hover { transform: translateY(-3px); box-shadow: 0 12px 32px rgba(99,102,241,0.12), 0 0 0 1px rgba(99,102,241,0.08); }
    .card-top { display: flex; align-items: center; justify-content: space-between; gap: 8px; }
    .badge { display: inline-flex; align-items: center; padding: 3px 10px; border-radius: 20px; font-size: 0.72rem; font-weight: 700; }
    .badge-open { background: #eff6ff; color: #2563eb; }
    .badge-evaluation { background: #fffbeb; color: #d97706; }
    .badge-closed { background: #f0fdf4; color: #16a34a; }
    .badge-cancelled { background: #fef2f2; color: #dc2626; }
    .days-left { font-size: 0.72rem; font-weight: 700; color: #c2410c; background: #fff7ed; border: 1px solid #fed7aa; padding: 3px 10px; border-radius: 20px; }
    .session-title { font-size: 1.05rem; font-weight: 800; color: #0f172a; line-height: 1.4; }
    .session-desc { font-size: 0.875rem; color: #64748b; line-height: 1.65; flex: 1; }
    .session-details { display: flex; flex-direction: column; gap: 8px; background: #f8fafc; border-radius: 10px; padding: 14px; border: 1px solid #f1f5f9; }
    .detail-row { display: flex; justify-content: space-between; font-size: 0.83rem; }
    .detail-label { color: #94a3b8; font-weight: 500; }
    .deadline-text { color: #f97316; font-weight: 700; }
    .btn { display: inline-flex; align-items: center; justify-content: center; padding: 11px 20px; border: none; border-radius: 10px; font-family: inherit; font-size: 0.9rem; font-weight: 700; cursor: pointer; text-decoration: none; transition: all 0.2s; letter-spacing: 0.01em; }
    .btn-primary { background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff; box-shadow: 0 2px 8px rgba(99,102,241,0.3); }
    .btn-primary:hover { background: linear-gradient(135deg, #4f46e5, #4338ca); color: #fff; transform: translateY(-1px); box-shadow: 0 6px 16px rgba(99,102,241,0.4); }
    @media (max-width: 1024px) { .sessions-grid { grid-template-columns: repeat(2, 1fr); } }
    @media (max-width: 640px) { .sessions-grid { grid-template-columns: 1fr; } }
  `]
})
export class SessionsListComponent implements OnInit {
  allSessions: Session[] = [];
  filteredSessions: Session[] = [];
  loading = true;
  activeFilter = 'ALL';

  tabs = [
    { label: 'Toutes',        value: 'ALL'        },
    { label: 'Ouvertes',      value: 'OPEN'       },
    { label: 'En évaluation', value: 'EVALUATION' },
    { label: 'Fermées',       value: 'CLOSED'     }
  ];

  constructor(private sessionService: SessionService) {}

  ngOnInit(): void {
    this.sessionService.getSessions().subscribe({
      next: (sessions) => {
        this.allSessions = sessions;
        this.applyFilter();
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  setFilter(value: string): void {
    this.activeFilter = value;
    this.applyFilter();
  }

  applyFilter(): void {
    // Never show cancelled sessions
    const visible = this.allSessions.filter(s => s.status !== 'CANCELLED');
    this.filteredSessions = this.activeFilter === 'ALL'
      ? visible
      : visible.filter(s => s.status === this.activeFilter);
  }

  getCount(value: string): number {
    const visible = this.allSessions.filter(s => s.status !== 'CANCELLED');
    if (value === 'ALL') return visible.length;
    return visible.filter(s => s.status === value).length;
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      OPEN: 'Ouverte', EVALUATION: 'En évaluation', CLOSED: 'Fermée', CANCELLED: 'Annulée'
    };
    return labels[status] ?? status;
  }

  getDaysLeft(deadline: string): number {
    const d = new Date(deadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(d / 86400000));
  }
}
