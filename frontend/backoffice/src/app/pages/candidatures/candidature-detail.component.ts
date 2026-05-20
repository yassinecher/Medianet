import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule, ActivatedRoute } from '@angular/router';
import { FormsModule } from '@angular/forms';
import { CandidatureService } from '../../core/services/candidature.service';
import { UserService } from '../../core/services/user.service';
import { Candidature } from '../../core/models/candidature.model';
import { User } from '../../core/models/user.model';

@Component({
  selector: 'app-candidature-detail',
  standalone: true,
  imports: [CommonModule, RouterModule, FormsModule],
  template: `
    <div class="page" *ngIf="candidature">
      <!-- Header -->
      <div class="page-header">
        <div>
          <a routerLink="/candidatures" class="back-link">← Candidatures</a>
          <h1 class="page-title">{{ candidature.projectName }}</h1>
          <div class="header-meta">
            <span [class]="statusClass(candidature.status)">{{ statusLabel(candidature.status) }}</span>
            <span class="score-badge" *ngIf="candidature.totalScore">
              Score moyen: <strong>{{ candidature.totalScore | number:'1.2-2' }}/10</strong>
            </span>
            <span class="meta-text">Soumis le {{ candidature.submittedAt | date:'dd/MM/yyyy' }}</span>
          </div>
        </div>
      </div>

      <!-- Decision banners -->
      <div class="banner accepted" *ngIf="candidature.status === 'ACCEPTED'">
        ✅ Candidature acceptée — Le porteur a été notifié.
      </div>
      <div class="banner rejected" *ngIf="candidature.status === 'REJECTED'">
        ❌ Candidature rejetée — Motif : {{ candidature.rejectionReason }}
      </div>

      <div class="two-col">
        <div class="left-col">
          <!-- Project Info -->
          <div class="section-card">
            <h3 class="section-title">📌 Informations du projet</h3>
            <div class="info-grid">
              <div class="info-item">
                <div class="info-label">Domaine</div>
                <div class="info-value">{{ candidature.domain }}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Stade actuel</div>
                <div class="info-value">{{ stageLabel(candidature.currentStage) }}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Marché cible</div>
                <div class="info-value">{{ candidature.targetMarket }}</div>
              </div>
              <div class="info-item">
                <div class="info-label">Taille équipe</div>
                <div class="info-value">{{ candidature.teamSize }} personnes</div>
              </div>
            </div>
            <div class="text-field">
              <div class="info-label">Stack technologique</div>
              <div class="info-value">{{ candidature.techStack }}</div>
            </div>
            <div class="text-field">
              <div class="info-label">Problème identifié</div>
              <p class="text-block">{{ candidature.problemStatement }}</p>
            </div>
            <div class="text-field">
              <div class="info-label">Solution proposée</div>
              <p class="text-block">{{ candidature.solutionDescription }}</p>
            </div>
            <div class="text-field">
              <div class="info-label">Description du projet</div>
              <p class="text-block">{{ candidature.projectDescription }}</p>
            </div>
          </div>

          <!-- Team & Market -->
          <div class="section-card">
            <h3 class="section-title">👥 Équipe & Marché</h3>
            <div class="text-field">
              <div class="info-label">Profil de l'équipe</div>
              <p class="text-block">{{ candidature.teamBackground }}</p>
            </div>
            <div class="text-field">
              <div class="info-label">Modèle économique</div>
              <p class="text-block">{{ candidature.businessModel }}</p>
            </div>
          </div>
        </div>

        <div class="right-col">
          <!-- Porteur -->
          <div class="section-card">
            <h3 class="section-title">🧑 Porteur de projet</h3>
            <div class="porteur-card">
              <div class="avatar">{{ getInitials(candidature.porteurName) }}</div>
              <div>
                <div class="porteur-name">{{ candidature.porteurName }}</div>
                <div class="porteur-email">{{ candidature.porteurEmail }}</div>
              </div>
            </div>
          </div>

          <!-- Jury Assignment -->
          <div class="section-card">
            <h3 class="section-title">⚖️ Mission jury</h3>

            <div class="jury-list" *ngIf="candidature.juryAssignments?.length">
              <div class="jury-item" *ngFor="let j of candidature.juryAssignments">
                <div class="avatar small">{{ getInitials(j.juryName) }}</div>
                <div>
                  <div class="jury-name">{{ j.juryName }}</div>
                  <div class="jury-email">{{ j.juryEmail }}</div>
                </div>
                <div class="eval-check" [class.done]="hasEvaluation(j.juryId)">
                  {{ hasEvaluation(j.juryId) ? '✅' : '⏳' }}
                </div>
              </div>
            </div>

            <!-- Assign Jury Form -->
            <div class="assign-section" *ngIf="candidature.status === 'PENDING' || candidature.status === 'UNDER_EVALUATION'">
              <div class="assign-header" (click)="toggleAssignForm()">
                <span>{{ showAssignForm ? '▼' : '▶' }} {{ candidature.juryAssignments?.length ? 'Modifier les jurés' : '+ Assigner des jurés' }}</span>
              </div>
              <div class="assign-form" *ngIf="showAssignForm">
                <div class="jury-select-list">
                  <div class="jury-option" *ngFor="let u of juryUsers">
                    <label>
                      <input type="checkbox" [checked]="isSelected(u)"
                             (change)="toggleJury(u, $event)">
                      <span class="option-name">{{ u.firstName }} {{ u.lastName }}</span>
                      <span class="option-email">{{ u.email }}</span>
                    </label>
                  </div>
                  <div class="empty" *ngIf="!juryUsers.length">Aucun juré disponible. Créez des comptes avec le rôle JURY.</div>
                </div>
                <button class="btn btn-primary" (click)="assignJury()" [disabled]="!selectedJury.length || savingJury">
                  {{ savingJury ? 'Assignation...' : 'Assigner (' + selectedJury.length + ' juré(s))' }}
                </button>
              </div>
            </div>
          </div>

          <!-- Evaluations -->
          <div class="section-card" *ngIf="candidature.evaluations?.length">
            <h3 class="section-title">📊 Évaluations reçues</h3>
            <div class="eval-card" *ngFor="let e of candidature.evaluations">
              <div class="eval-header">
                <strong>{{ e.juryName }}</strong>
                <span class="eval-score">{{ e.weightedScore | number:'1.1-1' }}/10</span>
              </div>
              <div class="criteria-list">
                <div class="criterion">
                  <span class="crit-label">Innovation (30%)</span>
                  <div class="score-bar">
                    <div class="score-fill" [style.width.%]="e.innovationScore * 10"></div>
                  </div>
                  <span class="crit-score">{{ e.innovationScore }}/10</span>
                </div>
                <div class="criterion">
                  <span class="crit-label">Faisabilité (25%)</span>
                  <div class="score-bar">
                    <div class="score-fill" [style.width.%]="e.feasibilityScore * 10"></div>
                  </div>
                  <span class="crit-score">{{ e.feasibilityScore }}/10</span>
                </div>
                <div class="criterion">
                  <span class="crit-label">Impact marché (25%)</span>
                  <div class="score-bar">
                    <div class="score-fill" [style.width.%]="e.marketImpactScore * 10"></div>
                  </div>
                  <span class="crit-score">{{ e.marketImpactScore }}/10</span>
                </div>
                <div class="criterion">
                  <span class="crit-label">Qualité équipe (20%)</span>
                  <div class="score-bar">
                    <div class="score-fill" [style.width.%]="e.teamQualityScore * 10"></div>
                  </div>
                  <span class="crit-score">{{ e.teamQualityScore }}/10</span>
                </div>
              </div>
              <div class="eval-comment" *ngIf="e.comment">
                <div class="info-label">Commentaire</div>
                <p>{{ e.comment }}</p>
              </div>
            </div>
          </div>

          <!-- Final Decision -->
          <div class="section-card decision-card"
               *ngIf="candidature.status === 'UNDER_EVALUATION' && candidature.evaluations?.length">
            <h3 class="section-title">🎯 Décision finale</h3>
            <div class="score-summary" *ngIf="candidature.totalScore">
              <div class="score-circle">{{ candidature.totalScore | number:'1.1-1' }}</div>
              <div class="score-label">Score moyen / 10</div>
            </div>
            <div class="decision-actions">
              <button class="btn btn-accept" (click)="accept()" [disabled]="deciding">
                ✅ Accepter la candidature
              </button>
              <button class="btn btn-reject" (click)="showRejectForm = !showRejectForm" [disabled]="deciding">
                ❌ Rejeter
              </button>
            </div>
            <div class="reject-form" *ngIf="showRejectForm">
              <textarea class="form-control" [(ngModel)]="rejectionReason" rows="3"
                        placeholder="Expliquez les raisons du rejet (motifs généraux)..."></textarea>
              <button class="btn btn-reject-confirm" (click)="reject()" [disabled]="!rejectionReason || deciding">
                Confirmer le rejet
              </button>
            </div>
          </div>

        </div>
      </div>
    </div>

    <div class="loading-page" *ngIf="!candidature">Chargement...</div>
  `,
  styles: [`
    .loading-page { display: flex; align-items: center; justify-content: center; height: 60vh; color: #6b7280; font-size: 1.1rem; }
    .back-link { color: #6b7280; text-decoration: none; font-size: 0.9rem; display: block; margin-bottom: 0.25rem; }
    .page-title { font-size: 1.75rem; font-weight: 700; color: #1a2332; margin: 0; }
    .page-header { margin-bottom: 1rem; }
    .header-meta { display: flex; align-items: center; gap: 0.75rem; margin-top: 0.5rem; flex-wrap: wrap; }
    .meta-text { color: #9ca3af; font-size: 0.85rem; }
    .score-badge { background: #1B4F8A; color: white; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.85rem; }

    .banner { padding: 1rem 1.25rem; border-radius: 10px; margin-bottom: 1rem; font-size: 0.95rem; font-weight: 500; }
    .banner.accepted { background: #d1fae5; color: #065f46; border: 1px solid #86efac; }
    .banner.rejected { background: #fee2e2; color: #991b1b; border: 1px solid #fca5a5; }

    .two-col { display: grid; grid-template-columns: 1fr 380px; gap: 1rem; align-items: start; }
    .section-card { background: white; border-radius: 12px; padding: 1.25rem; box-shadow: 0 1px 3px rgba(0,0,0,0.08); margin-bottom: 1rem; }
    .section-title { font-size: 1rem; font-weight: 600; color: #1a2332; margin: 0 0 1rem; }

    .info-grid { display: grid; grid-template-columns: 1fr 1fr; gap: 0.75rem; margin-bottom: 1rem; }
    .info-item, .text-field { margin-bottom: 0.75rem; }
    .info-label { font-size: 0.75rem; color: #9ca3af; font-weight: 500; text-transform: uppercase; letter-spacing: 0.5px; margin-bottom: 0.2rem; }
    .info-value { font-size: 0.9rem; color: #1a2332; font-weight: 500; }
    .text-block { color: #374151; line-height: 1.6; margin: 0.25rem 0 0; font-size: 0.9rem; }

    .porteur-card { display: flex; align-items: center; gap: 0.75rem; }
    .avatar { width: 44px; height: 44px; background: linear-gradient(135deg, #1B4F8A, #E85D26); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-weight: 700; color: white; font-size: 0.9rem; flex-shrink: 0; }
    .avatar.small { width: 36px; height: 36px; font-size: 0.8rem; }
    .porteur-name { font-weight: 600; color: #1a2332; }
    .porteur-email { font-size: 0.8rem; color: #9ca3af; }

    .jury-list { margin-bottom: 1rem; }
    .jury-item { display: flex; align-items: center; gap: 0.75rem; padding: 0.6rem 0; border-bottom: 1px solid #f9fafb; }
    .jury-name { font-weight: 500; font-size: 0.9rem; color: #1a2332; }
    .jury-email { font-size: 0.75rem; color: #9ca3af; }
    .eval-check { margin-left: auto; font-size: 1.1rem; }

    .assign-header { cursor: pointer; color: #1B4F8A; font-weight: 500; font-size: 0.9rem; padding: 0.5rem 0; }
    .assign-form { margin-top: 0.75rem; }
    .jury-select-list { max-height: 200px; overflow-y: auto; border: 1px solid #e5e7eb; border-radius: 8px; margin-bottom: 0.75rem; }
    .jury-option { padding: 0.6rem 0.75rem; border-bottom: 1px solid #f9fafb; }
    .jury-option label { display: flex; align-items: center; gap: 0.5rem; cursor: pointer; }
    .option-name { font-weight: 500; font-size: 0.85rem; }
    .option-email { font-size: 0.75rem; color: #9ca3af; margin-left: auto; }
    .empty { padding: 1rem; text-align: center; color: #9ca3af; font-size: 0.85rem; }

    .eval-card { border: 1px solid #f3f4f6; border-radius: 10px; padding: 1rem; margin-bottom: 0.75rem; }
    .eval-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
    .eval-score { background: #1B4F8A; color: white; padding: 0.2rem 0.6rem; border-radius: 9999px; font-weight: 700; font-size: 0.85rem; }
    .criteria-list { display: flex; flex-direction: column; gap: 0.5rem; margin-bottom: 0.75rem; }
    .criterion { display: flex; align-items: center; gap: 0.75rem; }
    .crit-label { width: 140px; font-size: 0.78rem; color: #6b7280; flex-shrink: 0; }
    .score-bar { flex: 1; height: 8px; background: #f3f4f6; border-radius: 9999px; overflow: hidden; }
    .score-fill { height: 100%; background: linear-gradient(90deg, #1B4F8A, #E85D26); border-radius: 9999px; transition: width 0.5s; }
    .crit-score { width: 35px; text-align: right; font-size: 0.8rem; font-weight: 600; color: #1a2332; }
    .eval-comment p { margin: 0.25rem 0 0; font-size: 0.85rem; color: #374151; font-style: italic; }

    .decision-card { border: 2px solid #e5e7eb; }
    .score-summary { text-align: center; margin-bottom: 1rem; }
    .score-circle { width: 80px; height: 80px; background: linear-gradient(135deg, #1B4F8A, #E85D26); border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 1.5rem; font-weight: 800; color: white; margin: 0 auto 0.5rem; }
    .score-label { color: #6b7280; font-size: 0.85rem; }
    .decision-actions { display: flex; flex-direction: column; gap: 0.75rem; margin-bottom: 0.75rem; }
    .reject-form { margin-top: 0.75rem; }
    .form-control { width: 100%; padding: 0.75rem; border: 1.5px solid #e5e7eb; border-radius: 8px; font-size: 0.9rem; box-sizing: border-box; font-family: inherit; resize: vertical; margin-bottom: 0.75rem; }

    .btn { display: block; width: 100%; padding: 0.75rem; border-radius: 8px; font-weight: 600; cursor: pointer; border: none; text-align: center; font-size: 0.9rem; }
    .btn-primary { background: #1B4F8A; color: white; }
    .btn-primary:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-accept { background: #27AE60; color: white; }
    .btn-accept:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-reject { background: white; color: #dc2626; border: 2px solid #dc2626; }
    .btn-reject:disabled { opacity: 0.6; cursor: not-allowed; }
    .btn-reject-confirm { background: #dc2626; color: white; }
    .btn-reject-confirm:disabled { opacity: 0.6; cursor: not-allowed; }

    .badge { display: inline-block; padding: 0.25rem 0.75rem; border-radius: 9999px; font-size: 0.8rem; font-weight: 600; }
    .badge-pending { background: #dbeafe; color: #1d4ed8; }
    .badge-under-evaluation { background: #fed7aa; color: #c2410c; }
    .badge-accepted { background: #d1fae5; color: #065f46; }
    .badge-rejected { background: #fee2e2; color: #991b1b; }

    @media (max-width: 1100px) { .two-col { grid-template-columns: 1fr; } }
  `]
})
export class CandidatureDetailComponent implements OnInit {
  candidature: Candidature | null = null;
  juryUsers: User[] = [];
  selectedJury: { juryId: number; juryEmail: string; juryName: string }[] = [];
  showAssignForm = false;
  showRejectForm = false;
  rejectionReason = '';
  savingJury = false;
  deciding = false;

  constructor(
    private candidatureService: CandidatureService,
    private userService: UserService,
    private route: ActivatedRoute
  ) {}

  ngOnInit() {
    const id = +this.route.snapshot.params['id'];
    this.load(id);
    this.userService.getUsersByRole('JURY').subscribe(users => this.juryUsers = users);
  }

  load(id: number) {
    this.candidatureService.getCandidatureById(id).subscribe(c => {
      this.candidature = c;
      this.selectedJury = (c.juryAssignments || []).map(j => ({
        juryId: j.juryId, juryEmail: j.juryEmail, juryName: j.juryName
      }));
    });
  }

  toggleAssignForm() { this.showAssignForm = !this.showAssignForm; }

  isSelected(u: User): boolean { return this.selectedJury.some(j => j.juryId === u.id); }

  toggleJury(u: User, event: Event) {
    const checked = (event.target as HTMLInputElement).checked;
    if (checked) {
      this.selectedJury.push({ juryId: u.id, juryEmail: u.email, juryName: u.firstName + ' ' + u.lastName });
    } else {
      this.selectedJury = this.selectedJury.filter(j => j.juryId !== u.id);
    }
  }

  assignJury() {
    if (!this.candidature) return;
    this.savingJury = true;
    this.candidatureService.assignJury(this.candidature.id, { juryAssignments: this.selectedJury }).subscribe({
      next: (c) => { this.candidature = c; this.showAssignForm = false; this.savingJury = false; },
      error: () => this.savingJury = false
    });
  }

  hasEvaluation(juryId: number): boolean {
    return (this.candidature?.evaluations || []).some(e => e.juryId === juryId);
  }

  accept() {
    if (!this.candidature || !confirm('Confirmer l\'acceptation de cette candidature ?')) return;
    this.deciding = true;
    this.candidatureService.acceptCandidature(this.candidature.id).subscribe({
      next: c => { this.candidature = c; this.deciding = false; },
      error: () => this.deciding = false
    });
  }

  reject() {
    if (!this.candidature || !this.rejectionReason) return;
    this.deciding = true;
    this.candidatureService.rejectCandidature(this.candidature.id, this.rejectionReason).subscribe({
      next: c => { this.candidature = c; this.showRejectForm = false; this.deciding = false; },
      error: () => this.deciding = false
    });
  }

  getInitials(name: string | undefined): string {
    if (!name) return '?';
    return name.split(' ').map(n => n[0]).join('').toUpperCase().slice(0, 2);
  }

  statusLabel(s: string) { return { PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', ACCEPTED: 'Acceptée', REJECTED: 'Rejetée' }[s] || s; }
  statusClass(s: string) { return 'badge badge-' + s.toLowerCase().replace('_', '-'); }
  stageLabel(s: string) { return { IDEA: 'Idée', PROTOTYPE: 'Prototype', LABEL: 'Label', PRE_LABEL: 'Pré-Label' }[s] || s; }
}
