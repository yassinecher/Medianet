import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CandidatureService } from '../../core/services/candidature.service';
import { SessionService } from '../../core/services/session.service';
import { Candidature } from '../../core/models/candidature.model';
import { Session } from '../../core/models/session.model';

@Component({
  selector: 'app-candidatures',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page">
      <div class="page-header">
        <div>
          <h1 class="page-title">Candidatures</h1>
          <p class="page-subtitle">Gérez et évaluez les dossiers soumis</p>
        </div>
      </div>

      <!-- Filters -->
      <div class="filters-bar">
        <div class="filter-tabs">
          <button *ngFor="let tab of tabs" class="tab" [class.active]="activeTab === tab.value"
                  (click)="setTab(tab.value)">
            {{ tab.label }} <span class="tab-count">{{ getCount(tab.value) }}</span>
          </button>
        </div>
        <select class="session-filter" [(ngModel)]="selectedSession" (change)="applyFilter()">
          <option value="">Toutes les sessions</option>
          <option *ngFor="let s of sessions" [value]="s.id">{{ s.title }}</option>
        </select>
      </div>

      <div class="search-bar">
        <input type="text" class="search-input" [(ngModel)]="search" (input)="applyFilter()"
               placeholder="🔍 Rechercher par nom de projet ou porteur...">
      </div>

      <!-- Table -->
      <div class="card">
        <div class="loading" *ngIf="loading">Chargement...</div>
        <div class="empty-state" *ngIf="!loading && filtered.length === 0">Aucune candidature trouvée</div>
        <table class="data-table" *ngIf="!loading && filtered.length > 0">
          <thead>
            <tr>
              <th>Projet</th>
              <th>Porteur</th>
              <th>Domaine</th>
              <th>Statut</th>
              <th>Score</th>
              <th>Jury</th>
              <th>Soumis le</th>
              <th>Actions</th>
            </tr>
          </thead>
          <tbody>
            <tr *ngFor="let c of filtered">
              <td>
                <a [routerLink]="['/candidatures', c.id]" class="title-link">{{ c.projectName }}</a>
                <div class="stage-tag">{{ stageLabel(c.currentStage) }}</div>
              </td>
              <td>
                <div class="porteur-name">{{ c.porteurName }}</div>
                <div class="porteur-email">{{ c.porteurEmail }}</div>
              </td>
              <td>{{ c.domain }}</td>
              <td><span [class]="statusClass(c.status)">{{ statusLabel(c.status) }}</span></td>
              <td>
                <span class="score" *ngIf="c.totalScore">{{ c.totalScore | number:'1.1-1' }}/10</span>
                <span class="no-score" *ngIf="!c.totalScore">—</span>
              </td>
              <td>
                <span class="jury-count" *ngIf="c.juryAssignments?.length">{{ c.juryAssignments!.length }} juré(s)</span>
                <span class="no-score" *ngIf="!c.juryAssignments?.length">Non assigné</span>
              </td>
              <td>{{ c.submittedAt | date:'dd/MM/yyyy' }}</td>
              <td><a [routerLink]="['/candidatures', c.id]" class="action-btn">Voir →</a></td>
            </tr>
          </tbody>
        </table>
      </div>
    </div>
  `,
  styles: [`
    .page-header { display: flex; justify-content: space-between; align-items: flex-start; margin-bottom: 1.5rem; }
    .page-title { font-size: 1.75rem; font-weight: 700; color: #1a2332; margin: 0; }
    .page-subtitle { color: #6b7280; margin: 0.25rem 0 0; }

    .filters-bar { display: flex; justify-content: space-between; align-items: center; gap: 1rem; margin-bottom: 0.75rem; flex-wrap: wrap; }
    .filter-tabs { display: flex; gap: 0.4rem; flex-wrap: wrap; }
    .tab { padding: 0.4rem 0.9rem; border-radius: 8px; border: 1.5px solid #e5e7eb; background: white; cursor: pointer; font-size: 0.82rem; font-weight: 500; color: #6b7280; display: flex; align-items: center; gap: 0.4rem; }
    .tab.active { border-color: #1B4F8A; background: #1B4F8A; color: white; }
    .tab-count { background: #f3f4f6; color: #374151; border-radius: 9999px; padding: 0 0.4rem; font-size: 0.7rem; }
    .tab.active .tab-count { background: rgba(255,255,255,0.25); color: white; }
    .session-filter { padding: 0.5rem; border-radius: 8px; border: 1.5px solid #e5e7eb; font-size: 0.85rem; }

    .search-bar { margin-bottom: 1rem; }
    .search-input { width: 100%; padding: 0.75rem 1rem; border: 1.5px solid #e5e7eb; border-radius: 10px; font-size: 0.9rem; box-sizing: border-box; }
    .search-input:focus { outline: none; border-color: #1B4F8A; }

    .card { background: white; border-radius: 12px; padding: 1rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); overflow-x: auto; }
    .loading, .empty-state { text-align: center; color: #9ca3af; padding: 3rem; }

    .data-table { width: 100%; border-collapse: collapse; font-size: 0.875rem; }
    .data-table th { text-align: left; padding: 0.75rem; color: #6b7280; font-weight: 500; border-bottom: 1px solid #f3f4f6; white-space: nowrap; }
    .data-table td { padding: 0.75rem; border-bottom: 1px solid #f9fafb; vertical-align: middle; }
    .title-link { color: #1B4F8A; font-weight: 600; text-decoration: none; display: block; }
    .title-link:hover { text-decoration: underline; }
    .stage-tag { font-size: 0.7rem; color: #9ca3af; margin-top: 0.15rem; }
    .porteur-name { font-weight: 500; color: #1a2332; }
    .porteur-email { font-size: 0.75rem; color: #9ca3af; }
    .score { font-weight: 700; color: #1B4F8A; }
    .no-score { color: #d1d5db; }
    .jury-count { background: #eff6ff; color: #1d4ed8; padding: 0.15rem 0.5rem; border-radius: 9999px; font-size: 0.75rem; }
    .action-btn { padding: 0.3rem 0.75rem; background: #eff6ff; color: #1d4ed8; border-radius: 6px; font-size: 0.8rem; text-decoration: none; font-weight: 500; }

    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.75rem; font-weight: 600; }
    .badge-pending { background: #dbeafe; color: #1d4ed8; }
    .badge-under-evaluation { background: #fed7aa; color: #c2410c; }
    .badge-accepted { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }
  `]
})
export class CandidaturesComponent implements OnInit {
  candidatures: Candidature[] = [];
  filtered: Candidature[] = [];
  sessions: Session[] = [];
  loading = true;
  activeTab = 'ALL';
  selectedSession = '';
  search = '';

  tabs = [
    { label: 'Toutes', value: 'ALL' },
    { label: 'En attente', value: 'PENDING' },
    { label: 'Évaluation', value: 'UNDER_EVALUATION' },
    { label: 'Acceptées', value: 'ACCEPTED' },
    { label: 'Rejetées', value: 'REJECTED' }
  ];

  constructor(
    private candidatureService: CandidatureService,
    private sessionService: SessionService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const sessionId = this.route.snapshot.queryParams['sessionId'];
    if (sessionId) this.selectedSession = sessionId;
    this.sessionService.getSessions().subscribe(s => this.sessions = s);
    this.candidatureService.getCandidatures().subscribe({
      next: c => { this.candidatures = c; this.applyFilter(); this.loading = false; },
      error: () => this.loading = false
    });
  }

  setTab(value: string) { this.activeTab = value; this.applyFilter(); }

  applyFilter() {
    let result = this.candidatures;
    if (this.activeTab !== 'ALL') result = result.filter(c => c.status === this.activeTab);
    if (this.selectedSession) result = result.filter(c => c.sessionId === +this.selectedSession);
    if (this.search) {
      const q = this.search.toLowerCase();
      result = result.filter(c => c.projectName.toLowerCase().includes(q) || (c.porteurName || '').toLowerCase().includes(q));
    }
    this.filtered = result;
  }

  getCount(tab: string): number {
    return tab === 'ALL' ? this.candidatures.length : this.candidatures.filter(c => c.status === tab).length;
  }

  statusLabel(s: string) { return { PENDING: 'En attente', UNDER_EVALUATION: 'Évaluation', ACCEPTED: 'Acceptée', REJECTED: 'Rejetée' }[s] || s; }
  statusClass(s: string) { return 'badge badge-' + s.toLowerCase().replace('_', '-'); }
  stageLabel(s: string) { return { IDEA: 'Idée', PROTOTYPE: 'Prototype', LABEL: 'Label', PRE_LABEL: 'Pré-Label' }[s] || s; }
}
