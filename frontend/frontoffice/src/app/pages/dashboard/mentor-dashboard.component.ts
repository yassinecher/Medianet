import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { CandidatureService } from '../../core/services/candidature.service';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { Candidature } from '../../core/models/candidature.model';
import { Session } from '../../core/models/session.model';

@Component({
  selector: 'app-mentor-dashboard',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <!-- ── Session Picker ──────────────────────────────────────────── -->
    <ng-container *ngIf="!selectedSession">
      <div class="picker-header">
        <div class="container">
          <div class="header-content">
            <div>
              <h1>Tableau de bord Mentor</h1>
              <p>Sélectionnez une session pour consulter les projets que vous accompagnez</p>
            </div>
            <div class="mentor-badge">
              <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" width="28" height="28">
                <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/>
                <circle cx="9" cy="7" r="4"/>
                <path d="M23 21v-2a4 4 0 0 0-3-3.87"/>
                <path d="M16 3.13a4 4 0 0 1 0 7.75"/>
              </svg>
              <span>Mentor</span>
            </div>
          </div>
        </div>
      </div>

      <div class="container body-pad">
        <div class="loading-row" *ngIf="loadingSessions">
          <div class="spinner"></div>
          <span>Chargement des sessions…</span>
        </div>

        <div class="empty-state" *ngIf="!loadingSessions && sessions.length === 0">
          <svg viewBox="0 0 48 48" fill="none" width="48" height="48">
            <circle cx="24" cy="24" r="20" fill="#f5f3ff"/>
            <path d="M16 30l8-8 4 4 8-8" stroke="#6366f1" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"/>
          </svg>
          <h3>Aucune session active</h3>
          <p>Il n'y a pas de sessions en cours pour le moment.</p>
        </div>

        <div class="sessions-grid" *ngIf="!loadingSessions && sessions.length > 0">
          <div class="session-card" *ngFor="let s of sessions" (click)="selectSession(s)">
            <div class="session-card-top">
              <div class="session-icon">
                <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="20" height="20">
                  <rect x="3" y="4" width="18" height="18" rx="2"/><path d="M16 2v4M8 2v4M3 10h18"/>
                </svg>
              </div>
              <div class="session-status" [class]="'sstatus-' + s.status.toLowerCase()">
                {{ sessionStatusLabel(s.status) }}
              </div>
            </div>
            <h3 class="session-title">{{ s.title }}</h3>
            <p class="session-desc">{{ (s.description || '') | slice:0:110 }}{{ (s.description?.length ?? 0) > 110 ? '…' : '' }}</p>
            <div class="session-dates">
              <span>
                <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M8 3.5a4.5 4.5 0 100 9 4.5 4.5 0 000-9zM2 8a6 6 0 1112 0A6 6 0 012 8zm5.25-2.75a.75.75 0 011.5 0v2.5l1.75.875a.75.75 0 01-.75 1.3l-2-1A.75.75 0 017.25 8V5.25z"/></svg>
                Fin : {{ s.endDate | date:'dd MMM yyyy' }}
              </span>
              <span>
                <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11"><path d="M1.75 2h12.5c.966 0 1.75.784 1.75 1.75v8.5A1.75 1.75 0 0114.25 14H1.75A1.75 1.75 0 010 12.25v-8.5C0 2.784.784 2 1.75 2zM1.5 5.927V12.25c0 .138.112.25.25.25h12.5a.25.25 0 00.25-.25V5.927L8.695 9.797a.75.75 0 01-.89 0L1.5 5.927z"/></svg>
                Dépôt : {{ s.submissionDeadline | date:'dd MMM yyyy' }}
              </span>
            </div>
            <button class="card-cta">
              Voir les projets
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
            </button>
          </div>
        </div>
      </div>
    </ng-container>

    <!-- ── Project Dashboard for selected session ───────────────────── -->
    <ng-container *ngIf="selectedSession">

      <div class="back-bar">
        <div class="container back-inner">
          <button class="back-btn" (click)="selectedSession = null; selectedProject = null">
            <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13"><path d="M13 8H3M7 4L3 8l4 4"/></svg>
            Changer de session
          </button>
          <div class="bc-trail">
            <span>Sessions</span>
            <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11" class="bc-sep"><path d="M6 3l4 5-4 5"/></svg>
            <span>{{ selectedSession.title }}</span>
            <ng-container *ngIf="selectedProject">
              <svg viewBox="0 0 16 16" fill="currentColor" width="11" height="11" class="bc-sep"><path d="M6 3l4 5-4 5"/></svg>
              <span class="bc-current">{{ selectedProject.projectName }}</span>
            </ng-container>
          </div>
        </div>
      </div>

      <!-- Session header -->
      <div class="dash-header">
        <div class="container">
          <div class="dash-header-inner">
            <div>
              <div class="session-status-chip" [class]="'sstatus-' + selectedSession.status.toLowerCase()">
                {{ sessionStatusLabel(selectedSession.status) }}
              </div>
              <h1>{{ selectedSession.title }}</h1>
              <p class="header-desc">{{ selectedSession.description }}</p>
            </div>
          </div>

          <!-- Stats bar -->
          <div class="stats-bar" *ngIf="!loadingProjects">
            <div class="stat-item">
              <span class="stat-num">{{ projects.length }}</span>
              <span class="stat-lbl">Projets</span>
            </div>
            <div class="stat-sep"></div>
            <div class="stat-item">
              <span class="stat-num">{{ projectsByStatus('PENDING') }}</span>
              <span class="stat-lbl">En attente</span>
            </div>
            <div class="stat-sep"></div>
            <div class="stat-item">
              <span class="stat-num">{{ projectsByStatus('UNDER_EVALUATION') }}</span>
              <span class="stat-lbl">En évaluation</span>
            </div>
            <div class="stat-sep"></div>
            <div class="stat-item">
              <span class="stat-num">{{ projectsByStatus('ACCEPTED') }}</span>
              <span class="stat-lbl">Acceptés</span>
            </div>
          </div>
        </div>
      </div>

      <div class="container body-pad">

        <!-- Projects list -->
        <ng-container *ngIf="!selectedProject">
          <div class="loading-row" *ngIf="loadingProjects">
            <div class="spinner"></div><span>Chargement des projets…</span>
          </div>

          <div class="empty-state" *ngIf="!loadingProjects && projects.length === 0">
            <svg viewBox="0 0 48 48" fill="none" width="40" height="40">
              <circle cx="24" cy="24" r="20" fill="#f1f5f9"/>
              <path d="M16 24h16M24 16v16" stroke="#94a3b8" stroke-width="2" stroke-linecap="round"/>
            </svg>
            <h3>Aucun projet dans cette session</h3>
            <p>Aucune candidature n'a encore été soumise pour cette session.</p>
          </div>

          <div class="projects-grid" *ngIf="!loadingProjects && projects.length > 0">
            <div class="project-row" *ngFor="let p of projects" (click)="selectProject(p)">
              <div class="project-row-left">
                <div class="project-avatar">{{ p.projectName[0] }}</div>
                <div>
                  <div class="project-row-title">{{ p.projectName }}</div>
                  <div class="project-row-meta">
                    <span class="pdomain">{{ p.domain }}</span>
                    <span class="pmeta-sep">·</span>
                    <span>{{ p.porteurName }}</span>
                    <span *ngIf="p.teamSize" class="pmeta-sep">·</span>
                    <span *ngIf="p.teamSize">{{ p.teamSize }} membre(s)</span>
                  </div>
                </div>
              </div>
              <div class="project-row-right">
                <div class="status-badge" [class]="'status-' + p.status.toLowerCase()">
                  {{ statusLabel(p.status) }}
                </div>
                <div class="project-score" *ngIf="p.totalScore != null">
                  {{ p.totalScore | number:'1.1-1' }}/10
                </div>
                <div class="project-score na" *ngIf="p.totalScore == null">—</div>
                <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="14" height="14" class="row-arrow"><path d="M3 8h10M9 4l4 4-4 4"/></svg>
              </div>
            </div>
          </div>
        </ng-container>

        <!-- Selected project detail -->
        <ng-container *ngIf="selectedProject">
          <div class="detail-back-row">
            <button class="back-btn-sm" (click)="selectedProject = null">
              <svg viewBox="0 0 16 16" fill="none" stroke="currentColor" stroke-width="2" width="12" height="12"><path d="M13 8H3M7 4L3 8l4 4"/></svg>
              Retour aux projets
            </button>
          </div>

          <div class="project-detail-card">
            <div class="detail-card-header">
              <div class="detail-avatar">{{ selectedProject.projectName[0] }}</div>
              <div>
                <h2>{{ selectedProject.projectName }}</h2>
                <div class="detail-meta">
                  <span class="pdomain">{{ selectedProject.domain }}</span>
                  <span>·</span>
                  <span>Porteur : {{ selectedProject.porteurName }}</span>
                  <span *ngIf="selectedProject.teamSize">· {{ selectedProject.teamSize }} membre(s)</span>
                </div>
              </div>
              <div class="status-badge lg" [class]="'status-' + selectedProject.status.toLowerCase()">
                {{ statusLabel(selectedProject.status) }}
              </div>
            </div>

            <div class="detail-sections">
              <div class="detail-block" *ngIf="selectedProject.projectDescription">
                <label>Description</label>
                <p>{{ selectedProject.projectDescription }}</p>
              </div>
              <div class="detail-block" *ngIf="selectedProject.problemStatement">
                <label>Problème identifié</label>
                <p>{{ selectedProject.problemStatement }}</p>
              </div>
              <div class="detail-block" *ngIf="selectedProject.solutionDescription">
                <label>Solution proposée</label>
                <p>{{ selectedProject.solutionDescription }}</p>
              </div>
              <div class="detail-2col">
                <div class="detail-block" *ngIf="selectedProject.targetMarket">
                  <label>Marché cible</label>
                  <p>{{ selectedProject.targetMarket }}</p>
                </div>
                <div class="detail-block" *ngIf="selectedProject.businessModel">
                  <label>Modèle économique</label>
                  <p>{{ selectedProject.businessModel }}</p>
                </div>
              </div>
              <div class="detail-2col">
                <div class="detail-block" *ngIf="selectedProject.techStack">
                  <label>Stack technologique</label>
                  <p>{{ selectedProject.techStack }}</p>
                </div>
                <div class="detail-block" *ngIf="selectedProject.teamBackground">
                  <label>Équipe</label>
                  <p>{{ selectedProject.teamBackground }}</p>
                </div>
              </div>
            </div>

            <!-- Score section -->
            <div class="detail-score-section" *ngIf="selectedProject.totalScore != null">
              <h3>Résultats d'évaluation</h3>
              <div class="score-row">
                <div class="big-score">{{ selectedProject.totalScore | number:'1.1-1' }}<small>/10</small></div>
                <div class="score-bars">
                  <div class="sbar-row" *ngFor="let cr of getCriteria(selectedProject)">
                    <span class="sbar-lbl">{{ cr.label }}</span>
                    <div class="sbar-track"><div class="sbar-fill" [style.width.%]="cr.value * 10"></div></div>
                    <span class="sbar-val">{{ cr.value | number:'1.1-1' }}</span>
                  </div>
                </div>
              </div>
            </div>

            <!-- Jury comments -->
            <div class="eval-list" *ngIf="selectedProject.evaluations?.length">
              <h3>Commentaires jury</h3>
              <div class="eval-comment-card" *ngFor="let ev of selectedProject.evaluations">
                <div class="ev-top">
                  <div class="jury-av">{{ ev.juryName[0] }}</div>
                  <div class="ev-info">
                    <strong>{{ ev.juryName }}</strong>
                    <span>{{ ev.evaluatedAt | date:'dd MMM yyyy' }}</span>
                  </div>
                  <div class="ev-score">{{ ev.weightedScore | number:'1.1-1' }}/10</div>
                </div>
                <p class="ev-comment" *ngIf="ev.comment">« {{ ev.comment }} »</p>
              </div>
            </div>
          </div>
        </ng-container>

      </div>
    </ng-container>
  `,
  styles: [`
    .container { max-width: 1100px; margin: 0 auto; padding: 0 24px; }
    .body-pad { padding-top: 28px; padding-bottom: 60px; }

    /* Spinner */
    .loading-row { display: flex; align-items: center; gap: 12px; padding: 40px 0; color: #94a3b8; font-size: 0.9rem; }
    .spinner { width: 26px; height: 26px; border: 2.5px solid #ede9fe; border-top-color: #6366f1; border-radius: 50%; animation: spin 0.8s linear infinite; }
    @keyframes spin { to { transform: rotate(360deg); } }

    /* Empty */
    .empty-state { display: flex; flex-direction: column; align-items: center; gap: 12px; padding: 60px 20px; text-align: center; }
    .empty-state h3 { font-size: 1.1rem; font-weight: 700; color: #1e293b; margin: 0; }
    .empty-state p { color: #64748b; font-size: 0.9rem; margin: 0; max-width: 360px; }

    /* Picker header */
    .picker-header { background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%); padding: 40px 0; }
    .header-content { display: flex; align-items: center; justify-content: space-between; gap: 16px; }
    .picker-header h1 { font-size: 1.8rem; font-weight: 800; color: #fff; margin: 0 0 6px; }
    .picker-header p { color: rgba(255,255,255,0.75); margin: 0; font-size: 0.95rem; }
    .mentor-badge {
      display: flex; flex-direction: column; align-items: center; gap: 6px;
      background: rgba(255,255,255,0.15); border-radius: 14px; padding: 14px 20px;
      border: 1px solid rgba(255,255,255,0.2); color: #fff; backdrop-filter: blur(8px);
    }
    .mentor-badge span { font-size: 0.75rem; font-weight: 700; letter-spacing: 0.08em; }

    /* Sessions grid */
    .sessions-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(320px, 1fr)); gap: 18px; }
    .session-card {
      background: #fff; border-radius: 14px; padding: 22px;
      border: 1.5px solid #e2e8f0; cursor: pointer;
      transition: all 0.22s cubic-bezier(0.4,0,0.2,1);
      box-shadow: 0 1px 4px rgba(0,0,0,0.05);
      display: flex; flex-direction: column; gap: 10px;
    }
    .session-card:hover { border-color: #6366f1; box-shadow: 0 8px 28px rgba(99,102,241,0.14); transform: translateY(-3px); }
    .session-card-top { display: flex; align-items: center; justify-content: space-between; }
    .session-icon {
      width: 40px; height: 40px; border-radius: 10px;
      background: #f5f3ff; color: #6366f1;
      display: flex; align-items: center; justify-content: center;
    }
    .session-title { font-size: 1rem; font-weight: 700; color: #0f172a; margin: 0; }
    .session-desc { font-size: 0.83rem; color: #475569; line-height: 1.55; margin: 0; }
    .session-dates { display: flex; flex-wrap: wrap; gap: 10px; font-size: 0.77rem; color: #64748b; padding-top: 6px; border-top: 1px solid #f1f5f9; }
    .session-dates span { display: flex; align-items: center; gap: 4px; }
    .card-cta {
      display: flex; align-items: center; justify-content: center; gap: 6px;
      padding: 9px; background: #f5f3ff; color: #6366f1;
      border: 1.5px solid #ede9fe; border-radius: 10px;
      font-size: 0.86rem; font-weight: 700; cursor: pointer; transition: all 0.18s; font-family: inherit;
    }
    .card-cta:hover { background: #6366f1; color: #fff; border-color: #6366f1; }

    /* Status chips */
    .session-status, .sstatus-chip {
      font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 20px;
      white-space: nowrap; text-transform: uppercase; letter-spacing: 0.04em;
    }
    .sstatus-open        { background: #d1fae5; color: #065f46; }
    .sstatus-evaluation  { background: #dbeafe; color: #1e40af; }
    .sstatus-closed      { background: #f1f5f9; color: #475569; }
    .sstatus-cancelled   { background: #fee2e2; color: #991b1b; }

    .status-badge { font-size: 0.72rem; font-weight: 700; padding: 4px 10px; border-radius: 20px; white-space: nowrap; text-transform: uppercase; letter-spacing: 0.04em; }
    .status-badge.lg { font-size: 0.8rem; padding: 6px 14px; }
    .status-pending           { background: #fef3c7; color: #92400e; }
    .status-under_evaluation  { background: #dbeafe; color: #1e40af; }
    .status-accepted          { background: #d1fae5; color: #065f46; }
    .status-rejected          { background: #fee2e2; color: #991b1b; }

    /* Back bar */
    .back-bar { background: #fff; border-bottom: 1px solid #e2e8f0; padding: 10px 0; }
    .back-inner { display: flex; flex-direction: column; gap: 4px; }
    .back-btn { display: inline-flex; align-items: center; gap: 6px; background: none; border: none; cursor: pointer; color: #6366f1; font-size: 0.85rem; font-weight: 700; padding: 6px 10px; border-radius: 8px; font-family: inherit; transition: background 0.15s; }
    .back-btn:hover { background: #f5f3ff; }
    .bc-trail { display: flex; align-items: center; gap: 6px; font-size: 0.78rem; color: #94a3b8; padding-left: 4px; }
    .bc-sep { opacity: 0.5; }
    .bc-current { color: #1e293b; font-weight: 600; }

    /* Dash header */
    .dash-header { background: linear-gradient(135deg, #4f46e5 0%, #312e81 100%); padding: 32px 0 0; }
    .dash-header-inner { padding-bottom: 24px; }
    .session-status-chip { display: inline-block; font-size: 0.72rem; font-weight: 700; padding: 3px 10px; border-radius: 20px; margin-bottom: 10px; text-transform: uppercase; letter-spacing: 0.04em; }
    .dash-header h1 { font-size: 1.6rem; font-weight: 800; color: #fff; margin: 0 0 6px; }
    .header-desc { color: rgba(255,255,255,0.7); font-size: 0.9rem; margin: 0; max-width: 600px; }
    .stats-bar { display: flex; align-items: center; gap: 0; background: rgba(0,0,0,0.15); border-radius: 10px 10px 0 0; padding: 14px 24px; backdrop-filter: blur(4px); }
    .stat-item { display: flex; flex-direction: column; align-items: center; gap: 2px; padding: 0 20px; }
    .stat-num { font-size: 1.4rem; font-weight: 800; color: #fff; line-height: 1; }
    .stat-lbl { font-size: 0.72rem; color: rgba(255,255,255,0.65); white-space: nowrap; }
    .stat-sep { width: 1px; height: 30px; background: rgba(255,255,255,0.2); }

    /* Projects list */
    .projects-grid { display: flex; flex-direction: column; gap: 8px; }
    .project-row {
      background: #fff; border-radius: 12px; padding: 16px 20px;
      border: 1px solid #e2e8f0; cursor: pointer;
      display: flex; align-items: center; justify-content: space-between; gap: 16px;
      transition: all 0.18s;
    }
    .project-row:hover { border-color: #6366f1; box-shadow: 0 4px 16px rgba(99,102,241,0.1); }
    .project-row-left { display: flex; align-items: center; gap: 14px; min-width: 0; }
    .project-avatar {
      width: 42px; height: 42px; border-radius: 10px; flex-shrink: 0;
      background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff;
      font-size: 1.1rem; font-weight: 800;
      display: flex; align-items: center; justify-content: center;
    }
    .project-row-title { font-size: 0.95rem; font-weight: 700; color: #0f172a; }
    .project-row-meta { font-size: 0.78rem; color: #64748b; display: flex; flex-wrap: wrap; gap: 4px; margin-top: 2px; }
    .pdomain { background: #f5f3ff; color: #6d28d9; border: 1px solid #ede9fe; padding: 1px 8px; border-radius: 20px; font-size: 0.7rem; font-weight: 600; }
    .pmeta-sep { color: #cbd5e1; }
    .project-row-right { display: flex; align-items: center; gap: 12px; flex-shrink: 0; }
    .project-score { font-size: 0.9rem; font-weight: 800; color: #6366f1; }
    .project-score.na { color: #94a3b8; font-weight: 500; }
    .row-arrow { color: #94a3b8; }

    /* Project detail card */
    .detail-back-row { margin-bottom: 16px; }
    .back-btn-sm { display: inline-flex; align-items: center; gap: 5px; background: #f5f3ff; border: 1px solid #ede9fe; color: #6366f1; font-size: 0.82rem; font-weight: 700; padding: 6px 12px; border-radius: 8px; cursor: pointer; font-family: inherit; transition: all 0.15s; }
    .back-btn-sm:hover { background: #ede9fe; }

    .project-detail-card { background: #fff; border-radius: 16px; border: 1px solid #e2e8f0; box-shadow: 0 1px 6px rgba(0,0,0,0.06); overflow: hidden; }
    .detail-card-header { display: flex; align-items: flex-start; gap: 14px; padding: 24px; border-bottom: 1px solid #f1f5f9; flex-wrap: wrap; }
    .detail-avatar { width: 50px; height: 50px; border-radius: 12px; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-size: 1.3rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .detail-card-header h2 { font-size: 1.2rem; font-weight: 800; color: #0f172a; margin: 0 0 6px; }
    .detail-meta { display: flex; align-items: center; flex-wrap: wrap; gap: 6px; font-size: 0.82rem; color: #64748b; }
    .detail-meta .status-badge { margin-left: auto; }

    .detail-sections { padding: 20px 24px; display: flex; flex-direction: column; gap: 16px; }
    .detail-block label { display: block; font-size: 0.7rem; font-weight: 700; text-transform: uppercase; letter-spacing: 0.08em; color: #6366f1; margin-bottom: 4px; }
    .detail-block p { font-size: 0.875rem; color: #334155; line-height: 1.6; margin: 0; }
    .detail-2col { display: grid; grid-template-columns: 1fr 1fr; gap: 16px; }
    @media (max-width: 580px) { .detail-2col { grid-template-columns: 1fr; } }

    .detail-score-section { padding: 20px 24px; border-top: 1px solid #f1f5f9; }
    .detail-score-section h3 { font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0 0 14px; }
    .score-row { display: flex; align-items: flex-start; gap: 24px; flex-wrap: wrap; }
    .big-score { font-size: 2.4rem; font-weight: 800; color: #6366f1; line-height: 1; flex-shrink: 0; }
    .big-score small { font-size: 1rem; color: #94a3b8; font-weight: 500; }
    .score-bars { flex: 1; min-width: 220px; display: flex; flex-direction: column; gap: 8px; }
    .sbar-row { display: flex; align-items: center; gap: 8px; }
    .sbar-lbl { font-size: 0.78rem; color: #475569; width: 90px; flex-shrink: 0; }
    .sbar-track { flex: 1; height: 6px; background: #f1f5f9; border-radius: 99px; overflow: hidden; }
    .sbar-fill { height: 100%; background: linear-gradient(90deg, #6366f1, #8b5cf6); border-radius: 99px; }
    .sbar-val { font-size: 0.78rem; font-weight: 700; color: #0f172a; width: 28px; text-align: right; }

    .eval-list { padding: 20px 24px; border-top: 1px solid #f1f5f9; }
    .eval-list h3 { font-size: 0.95rem; font-weight: 700; color: #0f172a; margin: 0 0 14px; }
    .eval-comment-card { background: #f8fafc; border-radius: 10px; padding: 14px; margin-bottom: 10px; }
    .ev-top { display: flex; align-items: center; gap: 10px; margin-bottom: 8px; }
    .jury-av { width: 32px; height: 32px; border-radius: 50%; background: linear-gradient(135deg, #6366f1, #8b5cf6); color: #fff; font-size: 0.8rem; font-weight: 800; display: flex; align-items: center; justify-content: center; flex-shrink: 0; }
    .ev-info { flex: 1; }
    .ev-info strong { display: block; font-size: 0.87rem; color: #0f172a; }
    .ev-info span { font-size: 0.75rem; color: #94a3b8; }
    .ev-score { font-size: 0.95rem; font-weight: 800; color: #6366f1; background: #ede9fe; padding: 3px 10px; border-radius: 16px; }
    .ev-comment { font-size: 0.83rem; color: #475569; line-height: 1.55; margin: 0; font-style: italic; }
  `]
})
export class MentorDashboardComponent implements OnInit {
  sessions: Session[] = [];
  selectedSession: Session | null = null;
  selectedProject: Candidature | null = null;
  projects: Candidature[] = [];
  loadingSessions = true;
  loadingProjects = false;

  constructor(
    private sessionService: SessionService,
    private candidatureService: CandidatureService,
    private authService: AuthService
  ) {}

  ngOnInit(): void {
    this.sessionService.getSessions().subscribe({
      next: (data) => {
        this.sessions = data.filter(s => s.status === 'OPEN' || s.status === 'EVALUATION');
        this.loadingSessions = false;
      },
      error: () => { this.loadingSessions = false; }
    });
  }

  selectSession(s: Session): void {
    this.selectedSession = s;
    this.selectedProject = null;
    this.projects = [];
    this.loadingProjects = true;
    this.candidatureService.getCandidaturesBySession(s.id).subscribe({
      next: (data) => { this.projects = data; this.loadingProjects = false; },
      error: () => { this.loadingProjects = false; }
    });
  }

  selectProject(p: Candidature): void { this.selectedProject = p; }

  projectsByStatus(status: string): number {
    return this.projects.filter(p => p.status === status).length;
  }

  getCriteria(c: Candidature): { label: string; value: number }[] {
    if (!c.evaluations?.length) return [];
    const n = c.evaluations.length;
    return [
      { label: 'Innovation',   value: c.evaluations.reduce((s, e) => s + e.innovationScore,   0) / n },
      { label: 'Faisabilité',  value: c.evaluations.reduce((s, e) => s + e.feasibilityScore,  0) / n },
      { label: 'Impact marché',value: c.evaluations.reduce((s, e) => s + e.marketImpactScore, 0) / n },
      { label: 'Équipe',       value: c.evaluations.reduce((s, e) => s + e.teamQualityScore,  0) / n },
    ];
  }

  sessionStatusLabel(s: string): string {
    const m: Record<string, string> = { OPEN: 'Ouverte', EVALUATION: 'En évaluation', CLOSED: 'Fermée', CANCELLED: 'Annulée' };
    return m[s] ?? s;
  }

  statusLabel(status: string): string {
    const m: Record<string, string> = { PENDING: 'En attente', UNDER_EVALUATION: 'En évaluation', ACCEPTED: 'Accepté', REJECTED: 'Refusé' };
    return m[status] ?? status;
  }
}
