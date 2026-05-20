import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CandidatureService } from '../../core/services/candidature.service';
import { AuthService } from '../../core/services/auth.service';
import { Candidature } from '../../core/models/candidature.model';

@Component({
  selector: 'app-porteur-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <!-- ── Loading ──────────────────────────────────────────────────────── -->
    <div class="loading-state" *ngIf="loading">
      <div class="spinner"></div>
      <p>Chargement de vos projets…</p>
    </div>

    <!-- ── No projects ──────────────────────────────────────────────────── -->
    <div class="empty-state" *ngIf="!loading && candidatures.length === 0">
      <div class="empty-icon">
        <svg viewBox="0 0 64 64" fill="none" xmlns="http://www.w3.org/2000/svg" width="64" height="64">
          <rect x="8" y="12" width="48" height="40" rx="6" fill="#ede9fe"/>
          <rect x="16" y="22" width="20" height="3" rx="1.5" fill="#a5b4fc"/>
          <rect x="16" y="30" width="32" height="3" rx="1.5" fill="#c4b5fd"/>
          <rect x="16" y="38" width="24" height="3" rx="1.5" fill="#c4b5fd"/>
          <circle cx="48" cy="44" r="10" fill="#6366f1"/>
          <path d="M44 44h8M48 40v8" stroke="white" stroke-width="2" stroke-linecap="round"/>
        </svg>
      </div>
      <h3>Aucun projet soumis</h3>
      <p>Vous n'avez pas encore déposé de candidature. Explorez les sessions ouvertes pour soumettre votre premier projet.</p>
      <a routerLink="/sessions" class="btn btn-primary">
        <svg viewBox="0 0 20 20" fill="currentColor" width="16" height="16"><path d="M9 2a7 7 0 100 14A7 7 0 009 2zm0 12.5A5.5 5.5 0 119 3.5a5.5 5.5 0 010 11zm.75-8.25a.75.75 0 00-1.5 0v2.5H5.75a.75.75 0 000 1.5h2.5v2.5a.75.75 0 001.5 0v-2.5h2.5a.75.75 0 000-1.5h-2.5v-2.5z"/></svg>
        Voir les sessions
      </a>
    </div>

    <!-- ── Project Picker ────────────────────────────────────────────────── -->
    <ng-container *ngIf="!loading && candidatures.length > 0 && !selected">
      <div class="picker-header">
        <div class="picker-header-inner">
          <div class="picker-title-group">
            <h1>Mes Projets</h1>
            <p>Sélectionnez un projet pour consulter son tableau de bord</p>
          </div>
          <div class="picker-count">
            <span>{{ candidatures.length }}</span>
            <small>projet{{ candidatures.length > 1 ? 's' : '' }}</small>
          </div>
        </div>
      </div>

      <div class="picker-grid">
        <div class="project-card" *ngFor="let c of candidatures" (click)="select(c)">
          <div class="project-card-top">
            <div class="project-avatar">{{ c.projectName[0] }}</div>
            <div class="status-badge" [class]="'status-' + c.status.toLowerCase()">
              {{ statusLabel(c.status) }}
            </div>
          </div>
          <h3 class="project-card-title">{{ c.projectName }}</h3>
          <span class="project-domain">{{ c.domain }}</span>
          <p class="project-desc">{{ (c.projectDescription || '') | slice:0:100 }}{{ (c.projectDescription?.length ?? 0) > 100 ? '…' : '' }}</p>
          <div class="project-meta">
            <span>
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8 1a5 5 0 100 10A5 5 0 008 1zM2.5 8a5.5 5.5 0 1111 0 5.5 5.5 0 01-11 0z"/><path d="M8 5v3l2 1"/></svg>
              {{ c.submittedAt | date:'dd MMM yyyy' }}
            </span>
            <span *ngIf="c.totalScore != null">
              <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12"><path d="M8 .25a.75.75 0 01.673.418l1.882 3.815 4.21.612a.75.75 0 01.416 1.279l-3.046 2.97.719 4.192a.75.75 0 01-1.088.791L8 12.347l-3.766 1.98a.75.75 0 01-1.088-.79l.72-4.194L.818 6.374a.75.75 0 01.416-1.28l4.21-.611L7.327.668A.75.75 0 018 .25z"/></svg>
              Score : {{ c.totalScore | number:'1.1-1' }}/10
            </span>
            <span *ngIf="c.totalScore == null" class="no-score">Pas encore évalué</span>
          </div>
          <button class="card-cta">
            Voir le tableau de bord
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
          </button>
        </div>
      </div>
    </ng-container>

    <!-- ── Project Dashboard ─────────────────────────────────────────────── -->
    <ng-container *ngIf="!loading && selected">

      <!-- Breadcrumb back -->
      <div class="back-bar" *ngIf="candidatures.length > 1">
        <button class="back-btn" (click)="selected = null">
          <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14"><path d="M13 8H3M7 4L3 8l4 4"/></svg>
          Changer de projet
        </button>
        <div class="breadcrumb-trail">
          <span>Mes Projets</span>
          <svg viewBox="0 0 16 16" fill="currentColor" width="12" height="12" class="bc-sep"><path d="M6 3l4 5-4 5"/></svg>
          <span class="bc-current">{{ selected.projectName }}</span>
        </div>
      </div>

      <!-- Project Header -->
      <div class="dash-header">
        <div class="dash-header-inner">
          <div class="dash-header-left">
            <div class="dash-avatar">{{ selected.projectName[0] }}</div>
            <div>
              <h1 class="dash-title">{{ selected.projectName }}</h1>
              <div class="dash-meta">
                <span class="domain-chip">{{ selected.domain }}</span>
                <span class="meta-dot">·</span>
                <span>Soumis le {{ selected.submittedAt | date:'dd MMMM yyyy' }}</span>
                <span *ngIf="selected.teamSize" class="meta-dot">·</span>
                <span *ngIf="selected.teamSize">{{ selected.teamSize }} membre{{ selected.teamSize > 1 ? 's' : '' }}</span>
              </div>
            </div>
          </div>
          <div class="status-badge lg" [class]="'status-' + selected.status.toLowerCase()">
            {{ statusLabel(selected.status) }}
          </div>
        </div>

        <!-- Status pipeline -->
        <div class="pipeline">
          <div class="pipeline-step" [class.done]="isPipelineDone('PENDING')" [class.active]="selected.status === 'PENDING'">
            <div class="step-circle">
              <svg *ngIf="isPipelineDone('PENDING')" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
              <span *ngIf="!isPipelineDone('PENDING')">1</span>
            </div>
            <span class="step-label">Soumis</span>
          </div>
          <div class="pipeline-line" [class.done]="isPipelineDone('PENDING')"></div>

          <div class="pipeline-step" [class.done]="isPipelineDone('UNDER_EVALUATION')" [class.active]="selected.status === 'UNDER_EVALUATION'">
            <div class="step-circle">
              <svg *ngIf="isPipelineDone('UNDER_EVALUATION')" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
              <span *ngIf="!isPipelineDone('UNDER_EVALUATION')">2</span>
            </div>
            <span class="step-label">En évaluation</span>
          </div>
          <div class="pipeline-line" [class.done]="isPipelineDone('UNDER_EVALUATION')"></div>

          <div class="pipeline-step"
               [class.done]="selected.status === 'ACCEPTED'"
               [class.rejected]="selected.status === 'REJECTED'"
               [class.active]="selected.status === 'ACCEPTED' || selected.status === 'REJECTED'">
            <div class="step-circle">
              <svg *ngIf="selected.status === 'ACCEPTED'" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M13.78 4.22a.75.75 0 010 1.06l-7.25 7.25a.75.75 0 01-1.06 0L2.22 9.28a.75.75 0 011.06-1.06L6 10.94l6.72-6.72a.75.75 0 011.06 0z"/></svg>
              <svg *ngIf="selected.status === 'REJECTED'" viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M3.72 3.72a.75.75 0 011.06 0L8 6.94l3.22-3.22a.75.75 0 111.06 1.06L9.06 8l3.22 3.22a.75.75 0 11-1.06 1.06L8 9.06l-3.22 3.22a.75.75 0 01-1.06-1.06L6.94 8 3.72 4.78a.75.75 0 010-1.06z"/></svg>
              <span *ngIf="selected.status !== 'ACCEPTED' && selected.status !== 'REJECTED'">3</span>
            </div>
            <span class="step-label">Décision</span>
          </div>
        </div>

        <!-- Rejection reason -->
        <div class="rejection-notice" *ngIf="selected.status === 'REJECTED' && selected.rejectionReason">
          <svg viewBox="0 0 16 16" fill="currentColor" width="16" height="16"><path d="M8 1a7 7 0 100 14A7 7 0 008 1zM6.75 5.25a.75.75 0 011.5 0v4a.75.75 0 01-1.5 0v-4zm.75 6.5a.875.875 0 110-1.75.875.875 0 010 1.75z"/></svg>
          Motif de refus : {{ selected.rejectionReason }}
        </div>
      </div>

      <!-- Score + Details grid -->
      <div class="dash-body">

        <!-- Score card -->
        <div class="score-card" *ngIf="selected.totalScore != null">
          <div class="score-card-header">
            <h2>Score Global</h2>
            <div class="score-value">{{ selected.totalScore | number:'1.1-1' }}<small>/10</small></div>
          </div>
          <div class="score-gauge-track">
            <div class="score-gauge-fill" [style.width.%]="(selected.totalScore / 10) * 100" [class]="scoreClass(selected.totalScore)"></div>
          </div>
          <div class="score-grade" [class]="scoreClass(selected.totalScore)">{{ scoreGrade(selected.totalScore) }}</div>

          <!-- Criteria breakdown (average from evaluations) -->
          <ng-container *ngIf="avgCriteria as avg">
            <div class="criteria-list">
              <div class="criterion-row">
                <span class="crit-label">Innovation</span>
                <div class="crit-bar-track"><div class="crit-bar-fill" [style.width.%]="avg.innovation * 10"></div></div>
                <span class="crit-val">{{ avg.innovation | number:'1.1-1' }}</span>
              </div>
              <div class="criterion-row">
                <span class="crit-label">Faisabilité</span>
                <div class="crit-bar-track"><div class="crit-bar-fill" [style.width.%]="avg.feasibility * 10"></div></div>
                <span class="crit-val">{{ avg.feasibility | number:'1.1-1' }}</span>
              </div>
              <div class="criterion-row">
                <span class="crit-label">Impact marché</span>
                <div class="crit-bar-track"><div class="crit-bar-fill" [style.width.%]="avg.marketImpact * 10"></div></div>
                <span class="crit-val">{{ avg.marketImpact | number:'1.1-1' }}</span>
              </div>
              <div class="criterion-row">
                <span class="crit-label">Équipe</span>
                <div class="crit-bar-track"><div class="crit-bar-fill" [style.width.%]="avg.teamQuality * 10"></div></div>
                <span class="crit-val">{{ avg.teamQuality | number:'1.1-1' }}</span>
              </div>
            </div>
          </ng-container>
        </div>

        <div class="score-card pending-score" *ngIf="selected.totalScore == null">
          <div class="pending-icon">
            <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
              <circle cx="24" cy="24" r="20" fill="#f5f3ff"/>
              <path d="M24 14v10l6 3" stroke="#6366f1" stroke-width="2.5" stroke-linecap="round"/>
            </svg>
          </div>
          <h3>Évaluation en cours</h3>
          <p>{{ evalCount }} jury(s) ont évalué votre projet sur {{ totalJury }} assigné(s).</p>
          <div class="eval-progress-track">
            <div class="eval-progress-fill" [style.width.%]="totalJury > 0 ? (evalCount / totalJury) * 100 : 0"></div>
          </div>
          <small>{{ evalCount }}/{{ totalJury }} évaluations complétées</small>
        </div>

        <!-- Project details -->
        <div class="details-card">
          <h2>Détails du projet</h2>
          <div class="detail-item" *ngIf="selected.projectDescription">
            <label>Description</label>
            <p>{{ selected.projectDescription }}</p>
          </div>
          <div class="detail-item" *ngIf="selected.problemStatement">
            <label>Problème identifié</label>
            <p>{{ selected.problemStatement }}</p>
          </div>
          <div class="detail-item" *ngIf="selected.solutionDescription">
            <label>Solution proposée</label>
            <p>{{ selected.solutionDescription }}</p>
          </div>
          <div class="detail-row">
            <div class="detail-item" *ngIf="selected.targetMarket">
              <label>Marché cible</label>
              <p>{{ selected.targetMarket }}</p>
            </div>
            <div class="detail-item" *ngIf="selected.businessModel">
              <label>Modèle économique</label>
              <p>{{ selected.businessModel }}</p>
            </div>
          </div>
          <div class="detail-row">
            <div class="detail-item" *ngIf="selected.techStack">
              <label>Stack technologique</label>
              <p>{{ selected.techStack }}</p>
            </div>
            <div class="detail-item" *ngIf="selected.teamBackground">
              <label>Équipe</label>
              <p>{{ selected.teamBackground }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- Jury Evaluations -->
      <div class="evals-section" *ngIf="selected.evaluations?.length">
        <h2 class="section-title">
          Évaluations jury
          <span class="eval-count-badge">{{ selected.evaluations.length }}</span>
        </h2>
        <div class="evals-grid">
          <div class="eval-card" *ngFor="let ev of selected.evaluations">
            <div class="eval-card-top">
              <div class="jury-avatar">{{ ev.juryName[0] }}</div>
              <div>
                <div class="jury-name">{{ ev.juryName }}</div>
                <div class="eval-date">{{ ev.evaluatedAt | date:'dd MMM yyyy, HH:mm' }}</div>
              </div>
              <div class="eval-score-badge">{{ ev.weightedScore | number:'1.1-1' }}/10</div>
            </div>
            <div class="eval-criteria-mini">
              <div class="mini-crit">
                <span>Innovation</span><strong>{{ ev.innovationScore }}/10</strong>
              </div>
              <div class="mini-crit">
                <span>Faisabilité</span><strong>{{ ev.feasibilityScore }}/10</strong>
              </div>
              <div class="mini-crit">
                <span>Marché</span><strong>{{ ev.marketImpactScore }}/10</strong>
              </div>
              <div class="mini-crit">
                <span>Équipe</span><strong>{{ ev.teamQualityScore }}/10</strong>
              </div>
            </div>
            <div class="eval-comment" *ngIf="ev.comment">
              <svg viewBox="0 0 16 16" fill="currentColor" width="14" height="14"><path d="M2 2.5A2.5 2.5 0 014.5 0h8.75a.75.75 0 01.75.75v12.5a.75.75 0 01-.75.75h-2.5a.75.75 0 010-1.5H14V1.5H4.5a1 1 0 00-1 1v11.5c0 .55.45 1 1 1H8v1.5H4.5A2.5 2.5 0 012 14V2.5z"/></svg>
              <p>{{ ev.comment }}</p>
            </div>
          </div>
        </div>
      </div>

      <!-- No evaluations yet -->
      <div class="evals-empty" *ngIf="!selected.evaluations?.length">
        <svg viewBox="0 0 48 48" fill="none" width="36" height="36">
          <circle cx="24" cy="24" r="20" fill="#f1f5f9"/>
          <path d="M16 28l8-8 4 4 8-8" stroke="#94a3b8" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
        </svg>
        <p>Aucune évaluation reçue pour l'instant.</p>
      </div>

    </ng-container>
  `,
  styles: [`
    /* ── Loading / Empty ──────────────────────────────────────────── */
    .loading-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px 20px; gap: 16px;
    }
    .spinner {
      width: 40px; height: 40px; border: 3px solid #ede9fe;
      border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite;
    }
    @keyframes spin { to { transform: rotate(360deg); } }
    .loading-state p { color: #94a3b8; font-size: 0.9rem; }

    .empty-state {
      display: flex; flex-direction: column; align-items: center; justify-content: center;
      padding: 80px 20px; gap: 16px; text-align: center;
    }
    .empty-icon { margin-bottom: 8px; }
    .empty-state h3 { font-size: 1.3rem; font-weight: 700; color: #1e293b; margin: 0; }
    .empty-state p { color: #64748b; font-size: 0.95rem; max-width: 420px; margin: 0; line-height: 1.6; }

    /* ── Picker ───────────────────────────────────────────────────── */
    .picker-header {
      background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%);
      padding: 40px 0 32px;
    }
    .picker-header-inner {
      max-width: 1100px; margin: 0 auto; padding: 0 24px;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
    }
    .picker-title-group h1 { font-size: 1.8rem; font-weight: 800; color: #fff; margin: 0 0 6px; }
    .picker-title-group p { color: rgba(255,255,255,0.75); margin: 0; font-size: 0.95rem; }
    .picker-count {
      background: rgba(255,255,255,0.15); border-radius: 12px;
      padding: 12px 20px; text-align: center; backdrop-filter: blur(8px);
      border: 1px solid rgba(255,255,255,0.2);
    }
    .picker-count span { display: block; font-size: 2rem; font-weight: 800; color: #fff; line-height: 1; }
    .picker-count small { color: rgba(255,255,255,0.7); font-size: 0.75rem; }

    .picker-grid {
      max-width: 1100px; margin: 0 auto; padding: 32px 24px 60px;
      display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 20px;
    }

    .project-card {
      background: #fff; border-radius: 16px; padding: 24px;
      border: 1.5px solid #e2e8f0; cursor: pointer;
      transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      display: flex; flex-direction: column; gap: 10px;
    }
    .project-card:hover {
      border-color: #6366f1;
      box-shadow: 0 8px 28px rgba(99,102,241,0.15);
      transform: translateY(-3px);
    }
    .project-card-top { display: flex; align-items: center; justify-content: space-between; }
    .project-avatar {
      width: 44px; height: 44px; border-radius: 12px;
      background: linear-gradient(135deg, #6366f1, #8b5cf6);
      color: #fff; font-size: 1.2rem; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      box-shadow: 0 4px 12px rgba(99,102,241,0.3);
    }
    .project-card-title { font-size: 1.05rem; font-weight: 700; color: #0f172a; margin: 0; }
    .project-domain {
      font-size: 0.75rem; background: #f5f3ff; color: #6d28d9;
      border: 1px solid #ede9fe; padding: 2px 10px; border-radius: 20px;
      width: fit-content;
    }
    .project-desc { font-size: 0.85rem; color: #475569; line-height: 1.55; margin: 0; }
    .project-meta {
      display: flex; flex-wrap: wrap; gap: 10px;
      font-size: 0.78rem; color: #64748b;
      padding-top: 6px; border-top: 1px solid #f1f5f9;
    }
    .project-meta span { display: flex; align-items: center; gap: 4px; }
    .no-score { color: #94a3b8; font-style: italic; }
    .card-cta {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      margin-top: 6px; padding: 10px;
      background: #f5f3ff; color: #6366f1;
      border: 1.5px solid #ede9fe; border-radius: 10px;
      font-size: 0.87rem; font-weight: 700; cursor: pointer;
      transition: all 0.18s;
    }
    .card-cta:hover { background: #6366f1; color: #fff; border-color: #6366f1; }

    /* ── Status badges ────────────────────────────────────────────── */
    .status-badge {
      font-size: 0.72rem; font-weight: 700; padding: 4px 10px;
      border-radius: 20px; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .status-badge.lg { font-size: 0.8rem; padding: 6px 14px; }
    .status-pending        { background: #fef3c7; color: #92400e; }
    .status-under_evaluation { background: #dbeafe; color: #1e40af; }
    .status-accepted       { background: #d1fae5; color: #065f46; }
    .status-rejected       { background: #fee2e2; color: #991b1b; }

    /* ── Dashboard layout ─────────────────────────────────────────── */
    .back-bar {
      background: #fff; border-bottom: 1px solid #e2e8f0;
      padding: 12px 0;
    }
    .back-bar > * { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .back-btn {
      display: inline-flex; align-items: center; gap: 6px;
      background: none; border: none; cursor: pointer;
      color: #6366f1; font-size: 0.85rem; font-weight: 700;
      padding: 6px 12px; border-radius: 8px; font-family: inherit;
      transition: background 0.15s;
    }
    .back-btn:hover { background: #f5f3ff; }
    .breadcrumb-trail {
      display: flex; align-items: center; gap: 6px;
      font-size: 0.8rem; color: #94a3b8; margin-top: 4px;
      max-width: 1100px; margin-left: auto; margin-right: auto; padding: 0 24px;
    }
    .bc-sep { opacity: 0.5; }
    .bc-current { color: #1e293b; font-weight: 600; }

    .dash-header {
      background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%);
      padding: 36px 0 0;
    }
    .dash-header-inner {
      max-width: 1100px; margin: 0 auto; padding: 0 24px 28px;
      display: flex; align-items: flex-start; justify-content: space-between; gap: 16px;
      flex-wrap: wrap;
    }
    .dash-header-left { display: flex; align-items: flex-start; gap: 16px; }
    .dash-avatar {
      width: 56px; height: 56px; border-radius: 14px;
      background: rgba(255,255,255,0.2); color: #fff;
      font-size: 1.5rem; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
      border: 2px solid rgba(255,255,255,0.3);
      backdrop-filter: blur(8px);
    }
    .dash-title { font-size: 1.6rem; font-weight: 800; color: #fff; margin: 0 0 8px; }
    .dash-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 0.85rem; color: rgba(255,255,255,0.75); }
    .domain-chip { background: rgba(255,255,255,0.2); color: #fff; padding: 2px 10px; border-radius: 20px; font-size: 0.75rem; font-weight: 600; }
    .meta-dot { color: rgba(255,255,255,0.4); }

    /* Pipeline */
    .pipeline {
      max-width: 1100px; margin: 0 auto; padding: 0 24px;
      display: flex; align-items: center;
      background: rgba(0,0,0,0.15); border-radius: 12px 12px 0 0;
      padding: 20px 32px; margin-top: 8px; backdrop-filter: blur(4px);
    }
    .pipeline-step { display: flex; flex-direction: column; align-items: center; gap: 6px; flex-shrink: 0; }
    .step-circle {
      width: 34px; height: 34px; border-radius: 50%;
      border: 2px solid rgba(255,255,255,0.35);
      background: rgba(255,255,255,0.1);
      display: flex; align-items: center; justify-content: center;
      color: rgba(255,255,255,0.6); font-size: 0.85rem; font-weight: 700;
      transition: all 0.3s;
    }
    .pipeline-step.done .step-circle {
      background: #10b981; border-color: #10b981; color: #fff;
    }
    .pipeline-step.active .step-circle {
      background: rgba(255,255,255,0.95); border-color: #fff;
      color: #4f46e5; box-shadow: 0 0 0 4px rgba(255,255,255,0.2);
    }
    .pipeline-step.rejected .step-circle {
      background: #ef4444; border-color: #ef4444; color: #fff;
    }
    .step-label { font-size: 0.75rem; color: rgba(255,255,255,0.7); font-weight: 600; white-space: nowrap; }
    .pipeline-step.done .step-label,
    .pipeline-step.active .step-label { color: #fff; }
    .pipeline-line {
      flex: 1; height: 2px; background: rgba(255,255,255,0.2); margin: 0 8px; margin-bottom: 22px;
      transition: background 0.3s;
    }
    .pipeline-line.done { background: #10b981; }

    .rejection-notice {
      max-width: 1100px; margin: 0 auto; padding: 12px 24px;
      display: flex; align-items: flex-start; gap: 8px;
      background: rgba(239,68,68,0.2); color: #fecaca;
      font-size: 0.875rem;
    }

    /* ── Body ─────────────────────────────────────────────────────── */
    .dash-body {
      max-width: 1100px; margin: 0 auto; padding: 28px 24px;
      display: grid; grid-template-columns: 340px 1fr; gap: 20px;
    }
    @media (max-width: 820px) { .dash-body { grid-template-columns: 1fr; } }

    .score-card {
      background: #fff; border-radius: 16px; padding: 24px;
      border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .score-card-header { display: flex; align-items: center; justify-content: space-between; margin-bottom: 16px; }
    .score-card-header h2 { font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0; }
    .score-value { font-size: 2.2rem; font-weight: 800; color: #6366f1; line-height: 1; }
    .score-value small { font-size: 1rem; color: #94a3b8; font-weight: 500; }
    .score-gauge-track { height: 10px; background: #f1f5f9; border-radius: 99px; overflow: hidden; margin-bottom: 6px; }
    .score-gauge-fill { height: 100%; border-radius: 99px; transition: width 0.6s ease; }
    .score-gauge-fill.score-high    { background: linear-gradient(90deg, #10b981, #34d399); }
    .score-gauge-fill.score-medium  { background: linear-gradient(90deg, #f59e0b, #fbbf24); }
    .score-gauge-fill.score-low     { background: linear-gradient(90deg, #ef4444, #f87171); }
    .score-grade { font-size: 0.78rem; font-weight: 700; text-align: right; margin-bottom: 20px; }
    .score-grade.score-high   { color: #059669; }
    .score-grade.score-medium { color: #d97706; }
    .score-grade.score-low    { color: #dc2626; }

    .criteria-list { display: flex; flex-direction: column; gap: 12px; }
    .criterion-row { display: flex; align-items: center; gap: 8px; }
    .crit-label { font-size: 0.8rem; color: #475569; width: 90px; flex-shrink: 0; }
    .crit-bar-track { flex: 1; height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
    .crit-bar-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 99px; transition: width 0.5s ease; }
    .crit-val { font-size: 0.8rem; font-weight: 700; color: #0f172a; width: 28px; text-align: right; flex-shrink: 0; }

    .pending-score { display: flex; flex-direction: column; align-items: center; text-align: center; gap: 12px; }
    .pending-icon { margin-bottom: 4px; }
    .pending-score h3 { font-size: 1rem; font-weight: 700; color: #1e293b; margin: 0; }
    .pending-score p { font-size: 0.85rem; color: #64748b; margin: 0; }
    .eval-progress-track { width: 100%; height: 8px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
    .eval-progress-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 99px; transition: width 0.5s; }
    .pending-score small { font-size: 0.75rem; color: #94a3b8; }

    .details-card {
      background: #fff; border-radius: 16px; padding: 24px;
      border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.05);
    }
    .details-card h2 { font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0 0 18px; }
    .detail-item { margin-bottom: 16px; }
    .detail-item label { display: block; font-size: 0.72rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6366f1; margin-bottom: 4px; }
    .detail-item p { font-size: 0.87rem; color: #334155; line-height: 1.6; margin: 0; }
    .detail-row { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 580px) { .detail-row { grid-template-columns: 1fr; } }

    /* ── Evaluations ──────────────────────────────────────────────── */
    .evals-section {
      max-width: 1100px; margin: 0 auto 60px; padding: 0 24px;
    }
    .section-title {
      font-size: 1.1rem; font-weight: 700; color: #0f172a; margin: 0 0 16px;
      display: flex; align-items: center; gap: 10px;
    }
    .eval-count-badge {
      background: #f5f3ff; color: #6366f1; border: 1px solid #ede9fe;
      font-size: 0.8rem; font-weight: 700; padding: 2px 10px; border-radius: 20px;
    }
    .evals-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(340px, 1fr)); gap: 16px; }
    .eval-card { background: #fff; border-radius: 14px; padding: 20px; border: 1px solid #e2e8f0; box-shadow: 0 1px 4px rgba(0,0,0,0.05); }
    .eval-card-top { display: flex; align-items: center; gap: 12px; margin-bottom: 14px; }
    .jury-avatar {
      width: 38px; height: 38px; border-radius: 50%;
      background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
      font-size: 0.9rem; font-weight: 800;
      display: flex; align-items: center; justify-content: center; flex-shrink: 0;
    }
    .jury-name { font-size: 0.9rem; font-weight: 700; color: #0f172a; }
    .eval-date { font-size: 0.75rem; color: #94a3b8; }
    .eval-score-badge {
      margin-left: auto; font-size: 0.95rem; font-weight: 800; color: #6366f1;
      background: #f5f3ff; padding: 4px 12px; border-radius: 20px;
    }
    .eval-criteria-mini { display: grid; grid-template-columns: 1fr 1fr; gap: 6px; margin-bottom: 12px; }
    .mini-crit { background: #f8fafc; border-radius: 8px; padding: 6px 10px; display: flex; justify-content: space-between; }
    .mini-crit span { font-size: 0.72rem; color: #64748b; }
    .mini-crit strong { font-size: 0.78rem; color: #0f172a; }
    .eval-comment { display: flex; gap: 8px; padding-top: 10px; border-top: 1px solid #f1f5f9; color: #6366f1; }
    .eval-comment p { font-size: 0.83rem; color: #475569; line-height: 1.55; margin: 0; font-style: italic; }

    .evals-empty {
      max-width: 1100px; margin: 0 auto 60px; padding: 0 24px;
      display: flex; align-items: center; gap: 10px;
      background: #f8fafc; border-radius: 12px; padding: 20px 24px;
      color: #94a3b8; font-size: 0.875rem;
    }

    /* ── Shared button ────────────────────────────────────────────── */
    .btn {
      display: inline-flex; align-items: center; gap: 8px;
      padding: 11px 22px; border-radius: 10px;
      font-family: inherit; font-size: 0.9rem; font-weight: 700;
      text-decoration: none; border: none; cursor: pointer; transition: all 0.2s;
    }
    .btn-primary {
      background: linear-gradient(135deg, #6366f1, #4f46e5); color: #fff;
      box-shadow: 0 4px 14px rgba(99,102,241,0.35);
    }
    .btn-primary:hover { transform: translateY(-2px); box-shadow: 0 6px 20px rgba(99,102,241,0.45); }
  `]
})
export class PorteurDashboardComponent implements OnInit {
  candidatures: Candidature[] = [];
  selected: Candidature | null = null;
  loading = true;

  constructor(
    private candidatureService: CandidatureService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.candidatureService.getMyCandidatures().subscribe({
      next: (data) => {
        this.candidatures = data;
        if (data.length === 1) this.selected = data[0];
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  select(c: Candidature): void { this.selected = c; }

  statusLabel(status: string): string {
    const map: Record<string, string> = {
      PENDING: 'En attente',
      UNDER_EVALUATION: 'En évaluation',
      ACCEPTED: 'Accepté',
      REJECTED: 'Refusé'
    };
    return map[status] ?? status;
  }

  isPipelineDone(stage: string): boolean {
    const order = ['PENDING', 'UNDER_EVALUATION', 'ACCEPTED'];
    const current = this.selected?.status ?? '';
    return order.indexOf(current) > order.indexOf(stage);
  }

  scoreClass(score: number): string {
    if (score >= 7) return 'score-high';
    if (score >= 5) return 'score-medium';
    return 'score-low';
  }

  scoreGrade(score: number): string {
    if (score >= 8) return 'Excellent';
    if (score >= 7) return 'Très bien';
    if (score >= 5) return 'Bien';
    if (score >= 3) return 'Insuffisant';
    return 'Faible';
  }

  get avgCriteria(): { innovation: number; feasibility: number; marketImpact: number; teamQuality: number } | null {
    const evals = this.selected?.evaluations;
    if (!evals?.length) return null;
    const n = evals.length;
    return {
      innovation:   evals.reduce((s, e) => s + e.innovationScore,   0) / n,
      feasibility:  evals.reduce((s, e) => s + e.feasibilityScore,  0) / n,
      marketImpact: evals.reduce((s, e) => s + e.marketImpactScore, 0) / n,
      teamQuality:  evals.reduce((s, e) => s + e.teamQualityScore,  0) / n,
    };
  }

  get evalCount(): number { return this.selected?.evaluations?.length ?? 0; }
  get totalJury(): number { return this.selected?.juryAssignments?.length ?? 0; }
}
