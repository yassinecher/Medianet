import { Component, OnInit } from '@angular/core';
import { CommonModule, DatePipe } from '@angular/common';
import { RouterModule, ActivatedRoute, Router } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { CandidatureService } from '../../core/services/candidature.service';
import { AuthService } from '../../core/services/auth.service';
import { Session } from '../../core/models/session.model';
import { Candidature } from '../../core/models/candidature.model';

@Component({
  selector: 'app-session-detail',
  standalone: true,
  imports: [CommonModule, RouterModule],
  templateUrl: `./session-detail.component.html`,
  styles: [`
    .spinner-overlay { display:flex;align-items:center;justify-content:center; }
    .spinner { width:40px;height:40px;border:3px solid #e2e8f0;border-top-color:#6366f1;border-radius:50%;animation:spin 0.8s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .container { max-width:1200px;margin:0 auto;padding:0 24px; }

    /* Header */
    .session-header { background:linear-gradient(135deg,#4f46e5 0%,#312e81 100%);color:#fff;padding:40px 0; }
    .session-header.header-cancelled { background:linear-gradient(135deg,#6b7280 0%,#4b5563 100%); }
    .header-top { display:flex;align-items:center;justify-content:space-between;margin-bottom:16px; }
    .back-link { color:rgba(255,255,255,0.8);font-size:0.875rem;text-decoration:none;transition:color 0.2s; }
    .back-link:hover { color:#fff; }
    .badge { display:inline-flex;align-items:center;padding:4px 12px;border-radius:20px;font-size:0.75rem;font-weight:600; }
    .badge-open       { background:rgba(219,234,254,0.2);color:#bfdbfe;border:1px solid rgba(191,219,254,0.3); }
    .badge-evaluation { background:rgba(254,243,199,0.2);color:#fde68a;border:1px solid rgba(253,230,138,0.3); }
    .badge-closed     { background:rgba(209,250,229,0.2);color:#a7f3d0;border:1px solid rgba(167,243,208,0.3); }
    .badge-cancelled  { background:rgba(254,226,226,0.2);color:#fca5a5;border:1px solid rgba(252,165,165,0.3); }
    .session-header h1 { font-size:2rem;font-weight:700;margin-bottom:10px; }
    .session-subtitle { color:rgba(255,255,255,0.8);font-size:1rem;line-height:1.6; }

    /* Cancelled banner */
    .cancelled-banner { background:#fef2f2;border-bottom:1px solid #fecaca; }
    .cancelled-inner { display:flex;align-items:center;gap:16px;padding:16px 0;flex-wrap:wrap; }
    .cancelled-icon { font-size:1.5rem;flex-shrink:0; }
    .cancelled-inner > div { flex:1; }
    .cancelled-inner strong { color:#991b1b;font-size:.95rem; }
    .cancelled-inner p { color:#b91c1c;font-size:.85rem;margin:2px 0 0; }
    .btn-outline-white { background:transparent;color:#991b1b;border:1.5px solid #fca5a5;white-space:nowrap;padding:7px 16px;border-radius:7px;font-size:.85rem;font-weight:500;text-decoration:none;transition:all .2s;display:inline-flex;align-items:center; }
    .btn-outline-white:hover { background:#fee2e2; }

    /* Layout */
    .detail-layout { display:grid;grid-template-columns:1fr 320px;gap:28px;align-items:start; }
    .detail-main { display:flex;flex-direction:column;gap:20px; }

    /* Countdown */
    .countdown-card { background:linear-gradient(135deg,#1B4F8A 0%,#2563a8 100%);color:#fff;border-radius:12px;padding:24px;display:flex;align-items:center;gap:20px; }
    .countdown-icon { font-size:2.5rem; }
    .countdown-label { font-size:0.875rem;color:rgba(255,255,255,0.8);margin-bottom:6px; }
    .countdown-value { font-size:2rem;font-weight:700;line-height:1; }
    .countdown-value.urgent { color:#fde68a; }
    .countdown-date { font-size:0.8rem;color:rgba(255,255,255,0.7);margin-top:4px; }

    /* Already applied card */
    .applied-card { background:#fff;border:1.5px solid #86efac;border-radius:14px;overflow:hidden;box-shadow:0 2px 12px rgba(0,0,0,0.07); }
    .applied-header { display:flex;align-items:center;gap:16px;background:linear-gradient(135deg,#d1fae5 0%,#a7f3d0 100%);padding:20px 24px;flex-wrap:wrap; }
    .applied-icon { font-size:2rem;flex-shrink:0; }
    .applied-header > div { flex:1; }
    .applied-header h2 { font-size:1.05rem;font-weight:700;color:#065f46;margin:0 0 2px; }
    .applied-header p { font-size:0.8rem;color:#047857;margin:0; }
    .cand-status-badge { display:inline-flex;align-items:center;padding:4px 12px;border-radius:9999px;font-size:.72rem;font-weight:700;white-space:nowrap; }
    .cs-pending          { background:#dbeafe;color:#1d4ed8; }
    .cs-under_evaluation { background:#fef3c7;color:#b45309; }
    .cs-accepted         { background:#d1fae5;color:#065f46; }
    .cs-rejected         { background:#fee2e2;color:#991b1b; }

    .score-row-block { display:flex;align-items:center;justify-content:space-between;padding:12px 24px;background:#f0fdf4;border-bottom:1px solid #bbf7d0; }
    .score-label-txt { font-size:.85rem;color:#047857;font-weight:500; }
    .score-pill { background:#065f46;color:#fff;padding:4px 14px;border-radius:9999px;font-size:.95rem;font-weight:700; }
    .rejection-note { margin:0;background:#fee2e2;color:#991b1b;padding:12px 24px;font-size:.875rem;border-bottom:1px solid #fecaca; }

    .applied-body { padding:20px 24px;display:flex;flex-direction:column;gap:20px; }
    .data-section h3 { font-size:.78rem;font-weight:700;color:#6b7280;text-transform:uppercase;letter-spacing:.06em;margin:0 0 12px; }
    .data-grid { display:grid;grid-template-columns:repeat(2,1fr);gap:10px; }
    .data-item { background:#f9fafb;border-radius:8px;padding:10px 12px;border:1px solid #e5e7eb; }
    .data-label { font-size:.7rem;color:#9ca3af;text-transform:uppercase;letter-spacing:.04em;margin-bottom:3px; }
    .data-val { font-size:.875rem;font-weight:600;color:#111827; }
    .data-text-block { background:#f9fafb;border-radius:8px;padding:12px 14px;border:1px solid #e5e7eb;margin-bottom:8px; }
    .data-text-block p { font-size:.875rem;color:#374151;line-height:1.6;margin:4px 0 0; }
    .applied-footer { padding:16px 24px;border-top:1px solid #e5e7eb;display:flex;justify-content:flex-end; }

    /* Detail card */
    .detail-card { background:#fff;border-radius:12px;padding:24px;box-shadow:0 1px 4px rgba(0,0,0,0.07);border:1px solid #E2E8F0; }
    .card-title { font-size:1.1rem;font-weight:700;color:#1A202C;margin-bottom:16px; }
    .about-text { color:#4A5568;line-height:1.8;font-size:0.95rem; }
    .criteria-grid { display:grid;grid-template-columns:repeat(4,1fr);gap:12px; }
    .criteria-item { text-align:center;background:#F5F7FA;border-radius:8px;padding:16px 8px; }
    .criteria-score { font-size:1.5rem;font-weight:800;color:#1B4F8A; }
    .criteria-label { font-size:0.75rem;color:#718096;margin-top:4px;line-height:1.4; }

    /* Sidebar */
    .detail-sidebar { display:flex;flex-direction:column;gap:16px; }
    .sidebar-card { background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,0.07);border:1px solid #E2E8F0; }
    .sidebar-card h3 { font-size:1rem;font-weight:700;color:#1A202C;margin-bottom:16px; }
    .info-list { display:flex;flex-direction:column;gap:14px; }
    .info-item { display:flex;gap:12px;align-items:flex-start; }
    .info-icon { font-size:1rem;margin-top:2px; }
    .info-label { font-size:0.75rem;color:#718096;margin-bottom:2px; }
    .info-value { font-size:0.9rem;font-weight:600;color:#2D3748; }
    .info-value.deadline { color:#E85D26; }

    .cta-card { background:#fff;border-radius:12px;padding:20px;box-shadow:0 1px 4px rgba(0,0,0,0.07);border:1px solid #E2E8F0;text-align:center; }
    .cta-card h3 { font-size:1rem;font-weight:700;color:#1A202C;margin-bottom:8px; }
    .cta-card p { font-size:0.875rem;color:#718096; }

    .sidebar-applied { background:#f0fdf4;border:1.5px solid #86efac;border-radius:12px;padding:16px;display:flex;align-items:center;gap:12px; }
    .sa-icon { font-size:1.5rem;flex-shrink:0; }
    .sa-text { display:flex;flex-direction:column;gap:2px; }
    .sa-text strong { font-size:.875rem;color:#065f46; }
    .sa-text span { font-size:.78rem;color:#047857; }

    .closed-notice { background:#F5F7FA;border-radius:12px;padding:20px;text-align:center;color:#718096;font-size:0.875rem;border:1px solid #E2E8F0; }
    .info-note { background:#fef3c7;color:#92400e;border-radius:8px;padding:12px;font-size:0.85rem;text-align:center; }

    /* Buttons */
    .btn { display:inline-flex;align-items:center;justify-content:center;padding:10px 20px;border:none;border-radius:8px;font-family:inherit;font-size:0.9rem;font-weight:500;cursor:pointer;text-decoration:none;transition:all 0.2s; }
    .btn-primary { background:#1B4F8A;color:#fff; }
    .btn-primary:hover { background:#143d6b;color:#fff; }
    .btn-outline { background:transparent;color:#1B4F8A;border:2px solid #1B4F8A; }
    .btn-outline:hover { background:#1B4F8A;color:#fff; }
    .btn-accent { background:#E85D26;color:#fff; }
    .btn-accent:hover { background:#c44d1e;color:#fff; }

    @media (max-width:900px) {
      .detail-layout { grid-template-columns:1fr; }
      .criteria-grid { grid-template-columns:repeat(2,1fr); }
      .data-grid { grid-template-columns:1fr; }
    }
  `]
})
export class SessionDetailComponent implements OnInit {
  session: Session | null = null;
  myCandidature: Candidature | null = null;
  loading = true;

  constructor(
    private route: ActivatedRoute,
    private sessionService: SessionService,
    private candidatureService: CandidatureService,
    private authService: AuthService,
    private router: Router
  ) { }

  ngOnInit(): void {
    const id = Number(this.route.snapshot.paramMap.get('id'));

    this.sessionService.getSession(id).subscribe({
      next: (session) => {

        this.session = session;
        // 🧠 CHECK IF EXPIRED
        const today = new Date();
        const endDate = new Date(session.endDate);

        if (endDate < today) {
          this.session.status = 'CLOSED'; // or 'EXPIRED'
        }

        // If porteur is logged in, check whether they already applied to this session
        if (this.isPorteur()) {
          this.candidatureService.getMyCandidatures().subscribe({
            next: (list) => {
              this.myCandidature = list.find(c => c.sessionId === id) ?? null;
              this.loading = false;
            },
            error: () => { this.loading = false; }
          });
        } else {
          this.loading = false;
        }
      },
      error: () => { this.loading = false; }
    });
  }
  getProjectStatus(project: any): string {
    const today = new Date();
    const endDate = new Date(project.endDate);

    if (endDate < today) {
      return 'CLOSED';
    }

    return project.status;
  }
  getDaysLeft(): number {
    if (!this.session) return 0;
    const d = new Date(this.session.submissionDeadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(d / 86400000));
  }

  getStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      OPEN: 'Ouverte', EVALUATION: 'En évaluation', CLOSED: 'Fermée', CANCELLED: 'Annulée'
    };
    return labels[status] ?? status;
  }

  getCandidatureStatusLabel(status: string): string {
    const labels: Record<string, string> = {
      PENDING: 'En attente',
      UNDER_EVALUATION: 'En évaluation',
      ACCEPTED: 'Acceptée',
      REJECTED: 'Rejetée'
    };
    return labels[status] ?? status;
  }

  isLoggedIn(): boolean { return this.authService.isLoggedIn(); }
  isPorteur(): boolean { return this.authService.isPorteur(); }
}
