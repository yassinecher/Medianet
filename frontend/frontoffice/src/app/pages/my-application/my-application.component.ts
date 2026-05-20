import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CandidatureService } from '../../core/services/candidature.service';
import { Candidature } from '../../core/models/candidature.model';

@Component({
  selector: 'app-my-application',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <div class="page-header-section">
      <div class="container">
        <h1>Mon Dossier</h1>
        <p>Suivez l'état de votre candidature en temps réel</p>
      </div>
    </div>

    <div class="container" style="padding:32px 24px 60px;">
      <!-- Loading -->
      <div *ngIf="loading" class="spinner-overlay">
        <div class="spinner"></div>
      </div>

      <!-- No Application -->
      <div *ngIf="!loading && candidatures.length === 0" class="empty-state">
        <div class="empty-icon">📋</div>
        <h2>Aucune candidature</h2>
        <p>Vous n'avez pas encore soumis de candidature.</p>
        <a routerLink="/sessions" class="btn btn-primary" style="margin-top:20px;">Voir les sessions ouvertes</a>
      </div>

      <!-- Candidatures List -->
      <div *ngIf="!loading && candidatures.length > 0">
        <div class="candidature-card" *ngFor="let candidature of candidatures">
          <!-- Status Banner -->
          <div class="status-banner" [ngClass]="'status-' + candidature.status.toLowerCase()">
            <div class="banner-icon">
              <span *ngIf="candidature.status === 'PENDING'">⏳</span>
              <span *ngIf="candidature.status === 'UNDER_EVALUATION'">🔍</span>
              <span *ngIf="candidature.status === 'ACCEPTED'">🎉</span>
              <span *ngIf="candidature.status === 'REJECTED'">❌</span>
            </div>
            <div class="banner-content">
              <div class="banner-title">{{ getStatusTitle(candidature.status) }}</div>
              <div class="banner-sub">{{ getStatusDescription(candidature.status) }}</div>
            </div>
            <div class="banner-badge">
              <span class="badge" [ngClass]="getBadgeClass(candidature.status)">{{ getStatusLabel(candidature.status) }}</span>
            </div>
          </div>

          <!-- Rejection Reason -->
          <div class="rejection-box" *ngIf="candidature.status === 'REJECTED' && candidature.rejectionReason">
            <strong>Motif du rejet :</strong> {{ candidature.rejectionReason }}
          </div>

          <!-- Score -->
          <div class="score-section" *ngIf="candidature.totalScore !== null">
            <div class="score-header">
              <h3>Score total</h3>
              <div class="score-value">{{ candidature.totalScore | number:'1.1-1' }}/10</div>
            </div>
            <div class="score-bar">
              <div class="score-fill" [style.width.%]="(candidature.totalScore / 10) * 100"></div>
            </div>
          </div>

          <!-- Project Info -->
          <div class="project-section">
            <div class="section-header">
              <h2>{{ candidature.projectName }}</h2>
              <span class="domain-badge">{{ candidature.domain }}</span>
            </div>
            <div class="info-grid">
              <div class="info-block">
                <div class="info-label">Description</div>
                <div class="info-value">{{ candidature.projectDescription }}</div>
              </div>
              <div class="info-block">
                <div class="info-label">Problème identifié</div>
                <div class="info-value">{{ candidature.problemStatement }}</div>
              </div>
              <div class="info-block">
                <div class="info-label">Solution</div>
                <div class="info-value">{{ candidature.solutionDescription }}</div>
              </div>
            </div>

            <div class="meta-grid">
              <div class="meta-item">
                <span class="meta-label">Stade</span><br>
                <span class="meta-value">{{ candidature.currentStage }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Équipe</span><br>
                <span class="meta-value">{{ candidature.teamSize }} membre(s)</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Tech Stack</span><br>
                <span class="meta-value">{{ candidature.techStack }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Marché cible</span><br>
                <span class="meta-value">{{ candidature.targetMarket }}</span>
              </div>
              <div class="meta-item">
                <span class="meta-label">Soumis le</span><br>
                <span class="meta-value">{{ candidature.submittedAt | date:'dd/MM/yyyy HH:mm' }}</span>
              </div>
            </div>
          </div>

          <!-- Jury Section -->
          <div class="jury-section" *ngIf="candidature.juryAssignments && candidature.juryAssignments.length > 0">
            <h3>Jurés assignés ({{ candidature.juryAssignments.length }})</h3>
            <div class="jury-list">
              <div class="jury-item" *ngFor="let jury of candidature.juryAssignments">
                <div class="jury-avatar">{{ jury.juryName[0] }}</div>
                <div>
                  <div class="jury-name">{{ jury.juryName }}</div>
                  <div class="jury-email">{{ jury.juryEmail }}</div>
                </div>
              </div>
            </div>
          </div>

          <!-- Evaluations -->
          <div class="evals-section" *ngIf="candidature.evaluations && candidature.evaluations.length > 0">
            <h3>Évaluations reçues ({{ candidature.evaluations.length }})</h3>
            <div class="eval-card" *ngFor="let eval of candidature.evaluations">
              <div class="eval-header">
                <div class="eval-jury">{{ eval.juryName }}</div>
                <div class="eval-score">Score: <strong>{{ eval.weightedScore | number:'1.1-1' }}/10</strong></div>
              </div>
              <div class="score-bars">
                <div class="score-row">
                  <span class="score-label">Innovation (30%)</span>
                  <div class="score-bar-wrap">
                    <div class="score-bar-fill innovation" [style.width.%]="eval.innovationScore * 10"></div>
                  </div>
                  <span class="score-num">{{ eval.innovationScore }}/10</span>
                </div>
                <div class="score-row">
                  <span class="score-label">Faisabilité (25%)</span>
                  <div class="score-bar-wrap">
                    <div class="score-bar-fill feasibility" [style.width.%]="eval.feasibilityScore * 10"></div>
                  </div>
                  <span class="score-num">{{ eval.feasibilityScore }}/10</span>
                </div>
                <div class="score-row">
                  <span class="score-label">Impact marché (25%)</span>
                  <div class="score-bar-wrap">
                    <div class="score-bar-fill market" [style.width.%]="eval.marketImpactScore * 10"></div>
                  </div>
                  <span class="score-num">{{ eval.marketImpactScore }}/10</span>
                </div>
                <div class="score-row">
                  <span class="score-label">Qualité équipe (20%)</span>
                  <div class="score-bar-wrap">
                    <div class="score-bar-fill team" [style.width.%]="eval.teamQualityScore * 10"></div>
                  </div>
                  <span class="score-num">{{ eval.teamQualityScore }}/10</span>
                </div>
              </div>
              <div class="eval-comment" *ngIf="eval.comment">
                <span class="comment-label">Commentaire :</span> {{ eval.comment }}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  `,
  styles: [`
    .page-header-section { background:linear-gradient(135deg,#4f46e5 0%,#312e81 100%);color:#fff;padding:52px 0;position:relative;overflow:hidden; }
    .page-header-section::after { content:'';position:absolute;inset:0;background:url("data:image/svg+xml,%3Csvg width='60' height='60' viewBox='0 0 60 60' xmlns='http://www.w3.org/2000/svg'%3E%3Cg fill='none' fill-rule='evenodd'%3E%3Cg fill='%23ffffff' fill-opacity='0.04'%3E%3Cpath d='M36 34v-4h-2v4h-4v2h4v4h2v-4h4v-2h-4zm0-30V0h-2v4h-4v2h4v4h2V6h4V4h-4zM6 34v-4H4v4H0v2h4v4h2v-4h4v-2H6zM6 4V0H4v4H0v2h4v4h2V6h4V4H6z'/%3E%3C/g%3E%3C/g%3E%3C/svg%3E");pointer-events:none; }
    .page-header-section h1 { font-size:2.1rem;font-weight:800;margin-bottom:6px;letter-spacing:-0.025em; }
    .page-header-section p { color:rgba(255,255,255,0.75); }
    .container { max-width:900px;margin:0 auto;padding:0 24px; }
    .spinner-overlay { display:flex;align-items:center;justify-content:center;padding:80px; }
    .spinner { width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .empty-state { text-align:center;padding:80px 20px;background:#fff;border-radius:20px;border:1px dashed #e2e8f0; }
    .empty-icon { font-size:4rem;margin-bottom:16px; }
    .empty-state h2 { font-size:1.4rem;color:#0f172a;margin-bottom:8px;font-weight:800; }
    .empty-state p { color:#64748b; }
    .candidature-card { background:#fff;border-radius:20px;box-shadow:0 4px 20px rgba(0,0,0,0.06);border:1px solid #e2e8f0;overflow:hidden;margin-bottom:24px; }
    /* Status Banner */
    .status-banner { display:flex;align-items:center;gap:20px;padding:24px 28px; }
    .status-pending { background:linear-gradient(135deg,#eff6ff 0%,#dbeafe 100%); }
    .status-under_evaluation { background:linear-gradient(135deg,#fffbeb 0%,#fef3c7 100%); }
    .status-accepted { background:linear-gradient(135deg,#f0fdf4 0%,#dcfce7 100%); }
    .status-rejected { background:linear-gradient(135deg,#fef2f2 0%,#fee2e2 100%); }
    .banner-icon { font-size:2.5rem; }
    .banner-content { flex:1; }
    .banner-title { font-size:1.05rem;font-weight:800;color:#0f172a; }
    .banner-sub { font-size:0.875rem;color:#475569;margin-top:2px; }
    .badge { display:inline-flex;align-items:center;padding:4px 12px;border-radius:20px;font-size:0.72rem;font-weight:700; }
    .badge-pending { background:#eff6ff;color:#2563eb; }
    .badge-under_evaluation { background:#fffbeb;color:#d97706; }
    .badge-accepted { background:#f0fdf4;color:#16a34a; }
    .badge-rejected { background:#fef2f2;color:#dc2626; }
    .rejection-box { margin:0 28px 20px;background:#fef2f2;color:#991b1b;border-radius:10px;padding:14px;font-size:0.9rem;border:1px solid #fecaca; }
    /* Score */
    .score-section { padding:20px 28px;border-bottom:1px solid #f1f5f9; }
    .score-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:10px; }
    .score-header h3 { font-weight:600;color:#64748b;font-size:0.875rem;text-transform:uppercase;letter-spacing:0.05em; }
    .score-value { font-size:1.6rem;font-weight:800;background:linear-gradient(135deg,#6366f1,#8b5cf6);-webkit-background-clip:text;-webkit-text-fill-color:transparent; }
    .score-bar { height:8px;background:#e2e8f0;border-radius:4px;overflow:hidden; }
    .score-fill { height:100%;background:linear-gradient(to right,#6366f1,#8b5cf6);border-radius:4px;transition:width 0.8s cubic-bezier(0.4,0,0.2,1); }
    /* Project */
    .project-section { padding:24px 28px;border-bottom:1px solid #f1f5f9; }
    .section-header { display:flex;align-items:center;gap:12px;margin-bottom:20px; }
    .section-header h2 { font-size:1.25rem;font-weight:800;color:#0f172a; }
    .domain-badge { background:#f5f3ff;color:#6d28d9;padding:4px 12px;border-radius:20px;font-size:0.72rem;font-weight:700;border:1px solid #ede9fe; }
    .info-grid { display:flex;flex-direction:column;gap:12px;margin-bottom:20px; }
    .info-block { background:#f8fafc;border-radius:10px;padding:14px;border:1px solid #f1f5f9; }
    .info-label { font-size:0.7rem;font-weight:700;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:5px; }
    .info-value { font-size:0.9rem;color:#1e293b;line-height:1.65; }
    .meta-grid { display:grid;grid-template-columns:repeat(3,1fr);gap:10px; }
    .meta-item { background:#f8fafc;border-radius:10px;padding:12px;border:1px solid #f1f5f9; }
    .meta-label { font-size:0.68rem;color:#94a3b8;text-transform:uppercase;letter-spacing:0.06em;margin-bottom:4px;font-weight:700; }
    .meta-value { font-size:0.875rem;font-weight:700;color:#0f172a; }
    /* Jury */
    .jury-section { padding:24px 28px;border-bottom:1px solid #f1f5f9; }
    .jury-section h3 { font-size:0.95rem;font-weight:800;color:#0f172a;margin-bottom:14px;text-transform:uppercase;letter-spacing:0.05em; }
    .jury-list { display:flex;flex-direction:column;gap:10px; }
    .jury-item { display:flex;align-items:center;gap:12px;background:#f8fafc;border-radius:10px;padding:12px;border:1px solid #f1f5f9; }
    .jury-avatar { width:36px;height:36px;border-radius:50%;background:linear-gradient(135deg,#6366f1,#8b5cf6);color:#fff;display:flex;align-items:center;justify-content:center;font-weight:800;font-size:0.875rem;flex-shrink:0; }
    .jury-name { font-weight:700;font-size:0.9rem;color:#0f172a; }
    .jury-email { font-size:0.78rem;color:#64748b; }
    /* Evaluations */
    .evals-section { padding:24px 28px; }
    .evals-section h3 { font-size:0.95rem;font-weight:800;color:#0f172a;margin-bottom:16px;text-transform:uppercase;letter-spacing:0.05em; }
    .eval-card { background:#f8fafc;border-radius:12px;padding:18px;margin-bottom:14px;border:1px solid #e2e8f0; }
    .eval-header { display:flex;justify-content:space-between;align-items:center;margin-bottom:14px; }
    .eval-jury { font-weight:700;color:#0f172a;font-size:0.9rem; }
    .eval-score { font-size:0.9rem;color:#64748b; }
    .eval-score strong { color:#6366f1;font-weight:800; }
    .score-bars { display:flex;flex-direction:column;gap:10px; }
    .score-row { display:grid;grid-template-columns:160px 1fr 50px;align-items:center;gap:10px; }
    .score-label { font-size:0.78rem;color:#475569;font-weight:500; }
    .score-bar-wrap { height:7px;background:#e2e8f0;border-radius:4px;overflow:hidden; }
    .score-bar-fill { height:100%;border-radius:4px; }
    .innovation { background:#3b82f6; }
    .feasibility { background:#10b981; }
    .market { background:#f59e0b; }
    .team { background:#8b5cf6; }
    .score-num { font-size:0.78rem;font-weight:700;color:#0f172a;text-align:right; }
    .eval-comment { margin-top:12px;padding:10px 14px;background:#fff;border-radius:8px;font-size:0.875rem;color:#475569;border-left:3px solid #6366f1; }
    .comment-label { font-weight:700;color:#6366f1; }
    .btn { display:inline-flex;align-items:center;justify-content:center;padding:11px 22px;border:none;border-radius:10px;font-family:inherit;font-size:0.9rem;font-weight:700;cursor:pointer;text-decoration:none;transition:all 0.2s;letter-spacing:0.01em; }
    .btn-primary { background:linear-gradient(135deg,#6366f1,#4f46e5);color:#fff;box-shadow:0 4px 12px rgba(99,102,241,0.35); }
    .btn-primary:hover { background:linear-gradient(135deg,#4f46e5,#4338ca);color:#fff;transform:translateY(-1px);box-shadow:0 6px 18px rgba(99,102,241,0.45); }
    @media (max-width:600px) { .meta-grid { grid-template-columns:1fr 1fr; } .score-row { grid-template-columns:120px 1fr 40px; } }
  `]
})
export class MyApplicationComponent implements OnInit {
  candidatures: Candidature[] = [];
  loading = true;

  constructor(private candidatureService: CandidatureService) {}

  ngOnInit(): void {
    this.candidatureService.getMyCandidatures().subscribe({
      next: (data) => { this.candidatures = data; this.loading = false; },
      error: () => { this.loading = false; }
    });
  }

  getStatusTitle(status: string): string {
    const titles: Record<string, string> = {
      PENDING: 'En attente d\'évaluation',
      UNDER_EVALUATION: 'En cours d\'évaluation',
      ACCEPTED: 'Candidature acceptée !',
      REJECTED: 'Candidature rejetée'
    };
    return titles[status] ?? status;
  }

  getStatusDescription(status: string): string {
    const desc: Record<string, string> = {
      PENDING: 'Votre dossier a été reçu et sera bientôt examiné par notre équipe.',
      UNDER_EVALUATION: 'Votre dossier est en cours d\'évaluation par notre jury d\'experts.',
      ACCEPTED: 'Félicitations ! Votre projet a été sélectionné pour le programme d\'incubation.',
      REJECTED: 'Après examen, votre candidature n\'a pas été retenue pour cette session.'
    };
    return desc[status] ?? '';
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', ACCEPTED: 'Acceptée', REJECTED: 'Rejetée'
    };
    return labels[status] ?? status;
  }

  getBadgeClass(status: string): string {
    return 'badge-' + status.toLowerCase();
  }
}
