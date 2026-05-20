import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { Session } from '../../core/models/session.model';

@Component({
  selector: 'app-sessions',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Sessions d'incubation</h1>
          <p class="page-subtitle">Gérez les sessions d'incubation Medianet</p>
        </div>
        <a routerLink="/sessions/create" class="btn btn-primary">+ Nouvelle session</a>
      </div>

      <!-- Filter tabs -->
      <div class="filter-tabs">
        <button *ngFor="let tab of tabs" class="tab" [class.active]="activeTab === tab.value"
                (click)="setTab(tab.value)">
          {{ tab.label }}
          <span class="tab-count">{{ getCount(tab.value) }}</span>
        </button>
      </div>

      <!-- Table -->
      <div class="card">
        <div class="loading" *ngIf="loading">Chargement des sessions...</div>
        <div class="empty-state" *ngIf="!loading && filtered.length === 0">Aucune session trouvée</div>
        <table class="data-table" *ngIf="!loading && filtered.length > 0">
          <thead>
            <tr>
              <th>Titre</th>
              <th>Statut</th>
              <th>Date début</th>
              <th>Date fin</th>
              <th>Deadline soumission</th>
              <th>Max projets</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let s of filtered">
              <td class="title-cell">
                <a [routerLink]="['/sessions', s.id]" class="title-link">{{ s.title }}</a>
              </td>
              <td><span [class]="'badge badge-' + s.status.toLowerCase()">{{ statusLabel(s.status) }}</span></td>
              <td>{{ s.startDate | date:'dd/MM/yyyy' }}</td>
              <td>{{ s.endDate | date:'dd/MM/yyyy' }}</td>
              <td>{{ s.submissionDeadline | date:'dd/MM/yyyy' }}</td>
              <td>{{ s.maxProjects || '∞' }}</td>
              <td class="actions-cell">
                <a [routerLink]="['/sessions', s.id]" class="action-btn view">Voir</a>
                <a [routerLink]="['/sessions', s.id, 'edit']" class="action-btn edit">Modifier</a>
                <div class="status-menu" *ngIf="s.status !== 'CLOSED' && s.status !== 'CANCELLED'">
                  <select class="status-select" (change)="onStatusChange(s, $event)">
                    <option value="">Changer statut</option>
                    <option value="OPEN" *ngIf="s.status !== 'OPEN'">→ Ouvrir</option>
                    <option value="EVALUATION" *ngIf="s.status === 'OPEN'">→ Évaluation</option>
                    <option value="CLOSED">→ Fermer</option>
                    <option value="CANCELLED">→ Annuler</option>
                  </select>
                </div>
              </td>
            </tr>
          </tbody>
        </table>
      </div>

      <!-- Confirm dialog -->
      <div class="modal-overlay" *ngIf="confirmAction" (click)="cancelConfirm()">
        <div class="modal" (click)="$event.stopPropagation()">
          <h3>Confirmer le changement de statut</h3>
          <p>Voulez-vous changer le statut de <strong>{{ confirmSession?.title }}</strong> vers <strong>{{ statusLabel(confirmAction!) }}</strong> ?</p>
          <div class="modal-actions">
            <button class="btn btn-outline" (click)="cancelConfirm()">Annuler</button>
            <button class="btn btn-primary" (click)="doStatusChange()">Confirmer</button>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page { }
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    .page-title { font-size: 1.75rem; font-weight: 700; color: #1a2332; margin: 0; }
    .page-subtitle { color: #6b7280; margin: 0.25rem 0 0; }
    .btn { display: inline-block; padding: 0.625rem 1.25rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; text-decoration: none; font-size: 0.9rem; }
    .btn-primary { background: #1B4F8A; color: white; }
    .btn-primary:hover { background: #153d6f; }
    .btn-outline { background: white; color: #1B4F8A; border: 1.5px solid #1B4F8A; }

    .filter-tabs { display: flex; gap: 0.5rem; margin-bottom: 1rem; flex-wrap: wrap; }
    .tab { padding: 0.5rem 1rem; border-radius: 8px; border: 1.5px solid #e5e7eb; background: white; cursor: pointer; font-size: 0.85rem; font-weight: 500; color: #6b7280; display: flex; align-items: center; gap: 0.5rem; }
    .tab.active { border-color: #1B4F8A; background: #1B4F8A; color: white; }
    .tab-count { background: rgba(255,255,255,0.2); border-radius: 9999px; padding: 0 0.4rem; font-size: 0.75rem; }
    .tab.active .tab-count { background: rgba(255,255,255,0.3); }
    .tab:not(.active) .tab-count { background: #f3f4f6; color: #374151; }

    .card { background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow-x: auto; }
    .loading { color: #6b7280; padding: 2rem; text-align: center; }
    .empty-state { text-align: center; color: #9ca3af; padding: 3rem; }

    .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .data-table th { text-align: left; padding: 0.75rem; color: #6b7280; font-weight: 500; border-bottom: 1px solid #f3f4f6; white-space: nowrap; }
    .data-table td { padding: 0.75rem; border-bottom: 1px solid #f9fafb; vertical-align: middle; }
    .title-link { color: #1B4F8A; font-weight: 600; text-decoration: none; }
    .title-link:hover { text-decoration: underline; }

    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-open { background: #dbeafe; color: #1d4ed8; }
    .badge-evaluation { background: #fed7aa; color: #c2410c; }
    .badge-closed { background: #d1fae5; color: #065f46; }
    .badge-cancelled { background: #fee2e2; color: #991b1b; }

    .actions-cell { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
    .action-btn { padding: 0.3rem 0.75rem; border-radius: 6px; font-size: 0.8rem; font-weight: 500; text-decoration: none; cursor: pointer; border: none; }
    .action-btn.view { background: #eff6ff; color: #1d4ed8; }
    .action-btn.edit { background: #fef9c3; color: #854d0e; }
    .status-select { padding: 0.3rem 0.5rem; border-radius: 6px; border: 1px solid #e5e7eb; font-size: 0.8rem; cursor: pointer; }

    .modal-overlay { position: fixed; inset: 0; background: rgba(0,0,0,0.4); display: flex; align-items: center; justify-content: center; z-index: 100; }
    .modal { background: white; border-radius: 16px; padding: 2rem; max-width: 420px; width: 90%; }
    .modal h3 { margin: 0 0 0.75rem; font-size: 1.1rem; color: #1a2332; }
    .modal p { color: #374151; margin: 0 0 1.5rem; line-height: 1.5; }
    .modal-actions { display: flex; gap: 0.75rem; justify-content: flex-end; }
  `]
})
export class SessionsComponent implements OnInit {
  sessions: Session[] = [];
  filtered: Session[] = [];
  loading = true;
  activeTab = 'ALL';
  confirmAction: string | null = null;
  confirmSession: Session | null = null;

  tabs = [
    { label: 'Toutes', value: 'ALL' },
    { label: 'Ouvertes', value: 'OPEN' },
    { label: 'Évaluation', value: 'EVALUATION' },
    { label: 'Fermées', value: 'CLOSED' },
    { label: 'Annulées', value: 'CANCELLED' }
  ];

  constructor(private sessionService: SessionService) {}

  ngOnInit() {
    this.loadSessions();
  }

  loadSessions() {
    this.loading = true;
    this.sessionService.getSessions().subscribe({
      next: sessions => {
        this.sessions = sessions;
        this.applyFilter();
        this.loading = false;
      },
      error: () => this.loading = false
    });
  }

  setTab(value: string) {
    this.activeTab = value;
    this.applyFilter();
  }

  applyFilter() {
    this.filtered = this.activeTab === 'ALL'
      ? this.sessions
      : this.sessions.filter(s => s.status === this.activeTab);
  }

  getCount(tab: string): number {
    return tab === 'ALL' ? this.sessions.length : this.sessions.filter(s => s.status === tab).length;
  }

  onStatusChange(session: Session, event: Event) {
    const newStatus = (event.target as HTMLSelectElement).value;
    if (!newStatus) return;
    this.confirmSession = session;
    this.confirmAction = newStatus;
    (event.target as HTMLSelectElement).value = '';
  }

  doStatusChange() {
    if (!this.confirmSession || !this.confirmAction) return;
    this.sessionService.changeStatus(this.confirmSession.id, this.confirmAction).subscribe({
      next: () => { this.cancelConfirm(); this.loadSessions(); },
      error: () => this.cancelConfirm()
    });
  }

  cancelConfirm() { this.confirmAction = null; this.confirmSession = null; }

  statusLabel(s: string): string {
    const map: Record<string, string> = { OPEN: 'Ouverte', EVALUATION: 'Évaluation', CLOSED: 'Fermée', CANCELLED: 'Annulée' };
    return map[s] || s;
  }
}
