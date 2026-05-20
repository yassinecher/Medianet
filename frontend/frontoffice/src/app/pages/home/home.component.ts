import { Component, OnInit, HostListener } from '@angular/core';
import { CommonModule } from '@angular/common';
import { RouterModule } from '@angular/router';
import { SessionService } from '../../core/services/session.service';
import { AuthService } from '../../core/services/auth.service';
import { Session } from '../../core/models/session.model';

@Component({
  selector: 'app-home',
  standalone: true,
  imports: [CommonModule, RouterModule],
  template: `
    <!-- ══════════════════════════════════ HERO ══════════════════════════════════ -->
    <section class="hero">
      <!-- Background grid -->
      <div class="hero-grid-bg"></div>
      <!-- Glow orbs -->
      <div class="orb orb-1"></div>
      <div class="orb orb-2"></div>
      <div class="orb orb-3"></div>

      <div class="hero-inner container">
        <!-- Left text -->
        <div class="hero-text" [class.visible]="heroVisible">
          <div class="hero-eyebrow">
            <span class="eyebrow-dot"></span>
            Programme d'incubation 2025
          </div>

          <h1 class="hero-h1">
            Votre idée mérite<br>
            d'être une
            <span class="gradient-text"> vraie startup</span>
          </h1>

          <p class="hero-desc">
            Medianet Incubateur sélectionne les projets à fort potentiel et les accompagne
            avec un suivi personnalisé, des experts métier et un réseau d'investisseurs.
          </p>

          <div class="hero-ctas">
            <a routerLink="/sessions" class="btn btn-accent btn-xl hero-cta-primary">
              <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polygon points="5 3 19 12 5 21 5 3"/></svg>
              Voir les sessions
            </a>
            <a routerLink="/register" class="btn btn-outline-white btn-xl">
              Créer un compte gratuit
            </a>
          </div>

          <div class="hero-trust">
            <div class="trust-avatars">
              <div class="ta ta-1">A</div>
              <div class="ta ta-2">M</div>
              <div class="ta ta-3">S</div>
              <div class="ta ta-4">K</div>
            </div>
            <span class="trust-text"><strong>+120 porteurs</strong> ont déjà candidaté</span>
          </div>
        </div>

        <!-- Right visual -->
        <div class="hero-visual" [class.visible]="heroVisible">
          <div class="hv-card hv-main">
            <div class="hv-card-header">
              <div class="hvc-dot green"></div>
              <div class="hvc-dot yellow"></div>
              <div class="hvc-dot red"></div>
              <span class="hvc-label">Candidature active</span>
            </div>
            <div class="hv-project">
              <div class="hv-project-icon">🌱</div>
              <div>
                <div class="hv-project-name">EcoFinance Platform</div>
                <div class="hv-project-sub">Session Printemps 2025</div>
              </div>
              <span class="hv-status-chip">En évaluation</span>
            </div>
            <div class="hv-scores">
              <div class="hv-score-row">
                <span>Innovation</span>
                <div class="hv-bar-wrap"><div class="hv-bar" style="width:88%;background:#6366f1"></div></div>
                <span class="hv-score-num">8.8</span>
              </div>
              <div class="hv-score-row">
                <span>Faisabilité</span>
                <div class="hv-bar-wrap"><div class="hv-bar" style="width:76%;background:#10b981"></div></div>
                <span class="hv-score-num">7.6</span>
              </div>
              <div class="hv-score-row">
                <span>Impact marché</span>
                <div class="hv-bar-wrap"><div class="hv-bar" style="width:92%;background:#f97316"></div></div>
                <span class="hv-score-num">9.2</span>
              </div>
            </div>
          </div>

          <!-- Floating chips -->
          <div class="hv-chip chip-1">
            <span>🏆</span> Sélectionné
          </div>
          <div class="hv-chip chip-2">
            <span>⚡</span> 48h de réponse
          </div>
          <div class="hv-chip chip-3">
            <span>🎯</span> 85% de succès
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════ STATS ══════════════════════════════════ -->
    <section class="stats-band">
      <div class="container">
        <div class="stats-inner">
          <div class="stat-block" *ngFor="let s of stats">
            <div class="stat-num">{{ s.value }}</div>
            <div class="stat-label">{{ s.label }}</div>
          </div>
          <div class="stat-divider" *ngFor="let _ of [1,2,3]"></div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════ SESSIONS ══════════════════════════════ -->
    <section class="sessions-section">
      <div class="container">
        <div class="sec-head">
          <div class="sec-kicker">Sessions actives</div>
          <h2 class="sec-title">Candidatez dès maintenant</h2>
          <p class="sec-sub">Rejoignez une session ouverte et soumettez votre projet innovant.</p>
        </div>

        <div *ngIf="loading" class="spinner-overlay"><div class="spinner"></div></div>

        <div *ngIf="!loading && sessions.length === 0" class="empty-box">
          <div class="empty-icon-wrap">📭</div>
          <h3>Aucune session ouverte pour l'instant</h3>
          <p>Revenez bientôt — de nouvelles sessions arrivent régulièrement.</p>
          <a routerLink="/sessions" class="btn btn-outline" style="margin-top:16px;">
            Voir toutes les sessions
          </a>
        </div>

        <div class="sess-grid" *ngIf="!loading && sessions.length > 0">
          <a class="sess-card" *ngFor="let s of sessions; let i = index"
             [routerLink]="['/sessions', s.id]"
             [style.animation-delay]="(i * 0.1) + 's'">
            <div class="sess-card-top">
              <span class="sc-badge">Ouverte</span>
              <span class="sc-days" *ngIf="getDaysLeft(s.submissionDeadline) > 0">
                {{ getDaysLeft(s.submissionDeadline) }}j restants
              </span>
              <span class="sc-days urgent" *ngIf="getDaysLeft(s.submissionDeadline) === 0">
                Délai expiré
              </span>
            </div>

            <div class="sc-icon-wrap">
              <span class="sc-icon">{{ sessionIcon(i) }}</span>
            </div>

            <h3 class="sc-title">{{ s.title }}</h3>
            <p class="sc-desc">{{ (s.description | slice:0:110) + (s.description.length > 110 ? '…' : '') }}</p>

            <div class="sc-meta">
              <div class="sc-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
                {{ s.submissionDeadline | date:'dd MMM yyyy' }}
              </div>
              <div class="sc-meta-item">
                <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/><path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/></svg>
                Max {{ s.maxProjects }} projets
              </div>
            </div>

            <div class="sc-cta">
              Voir les détails
              <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
            </div>
          </a>

          <!-- "All sessions" card -->
          <a class="sess-card sess-card-all" routerLink="/sessions">
            <div class="sca-inner">
              <div class="sca-icon">→</div>
              <h3>Toutes les sessions</h3>
              <p>Explorez l'historique complet et les sessions à venir</p>
            </div>
          </a>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════ HOW IT WORKS ══════════════════════════ -->
    <section class="how-section">
      <div class="container">
        <div class="sec-head">
          <div class="sec-kicker">Processus</div>
          <h2 class="sec-title">Comment ça marche ?</h2>
          <p class="sec-sub">De l'idée au Demo Day en 4 étapes claires et transparentes.</p>
        </div>

        <div class="how-grid">
          <div class="how-step" *ngFor="let step of steps; let i = index">
            <div class="how-num">{{ (i + 1).toString().padStart(2,'0') }}</div>
            <div class="how-icon-wrap" [style.background]="step.bg">
              {{ step.icon }}
            </div>
            <h3 class="how-title">{{ step.title }}</h3>
            <p class="how-desc">{{ step.desc }}</p>
            <div class="how-connector" *ngIf="i < steps.length - 1"></div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════ FEATURES ══════════════════════════════ -->
    <section class="features-section">
      <div class="container">
        <div class="features-grid">
          <div class="features-text">
            <div class="sec-kicker">Pourquoi nous choisir</div>
            <h2 class="sec-title left">Un programme conçu pour votre succès</h2>
            <p class="sec-sub left">
              Nous ne sélectionnons pas seulement des projets — nous construisons des startups.
              Notre approche combine expertise, réseau et ressources opérationnelles.
            </p>
            <div class="feature-list">
              <div class="feature-item" *ngFor="let f of features">
                <div class="fi-icon" [style.background]="f.bg">{{ f.icon }}</div>
                <div>
                  <div class="fi-title">{{ f.title }}</div>
                  <div class="fi-desc">{{ f.desc }}</div>
                </div>
              </div>
            </div>
          </div>

          <div class="features-visual">
            <div class="fv-card fv-top">
              <div class="fv-circle fv-c1"></div>
              <div class="fv-circle fv-c2"></div>
              <div class="fv-ring"></div>
              <div class="fv-inner">
                <div class="fv-big-num">85%</div>
                <div class="fv-big-label">Taux de succès</div>
              </div>
            </div>
            <div class="fv-row">
              <div class="fv-mini-card">
                <div class="fvmc-icon">🌍</div>
                <div class="fvmc-num">12</div>
                <div class="fvmc-label">Pays</div>
              </div>
              <div class="fv-mini-card">
                <div class="fvmc-icon">👥</div>
                <div class="fvmc-num">30+</div>
                <div class="fvmc-label">Mentors</div>
              </div>
              <div class="fv-mini-card">
                <div class="fvmc-icon">💸</div>
                <div class="fvmc-num">15M</div>
                <div class="fvmc-label">DT levés</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════ TESTIMONIALS ══════════════════════════ -->
    <section class="testimonials-section">
      <div class="container">
        <div class="sec-head">
          <div class="sec-kicker">Témoignages</div>
          <h2 class="sec-title">Ce qu'ils disent de nous</h2>
        </div>
        <div class="testimonials-grid">
          <div class="testi-card" *ngFor="let t of testimonials">
            <div class="testi-stars">
              <span *ngFor="let _ of [1,2,3,4,5]">★</span>
            </div>
            <p class="testi-quote">« {{ t.quote }} »</p>
            <div class="testi-author">
              <div class="testi-avatar" [style.background]="t.color">{{ t.initials }}</div>
              <div>
                <div class="testi-name">{{ t.name }}</div>
                <div class="testi-role">{{ t.role }}</div>
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>

    <!-- ══════════════════════════════════ CTA ════════════════════════════════════ -->
    <section class="cta-section">
      <div class="container">
        <div class="cta-card">
          <div class="cta-glow"></div>
          <div class="cta-content">
            <div class="sec-kicker white-kicker">Prêt à démarrer ?</div>
            <h2 class="cta-h2">Lancez votre startup avec Medianet</h2>
            <p class="cta-sub">
              Rejoignez les entrepreneurs qui ont fait confiance à notre programme
              pour transformer leurs idées en entreprises viables.
            </p>
            <div class="cta-btns">
              <a routerLink="/register" class="btn btn-white btn-xl">
                Créer mon compte
                <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M5 12h14M12 5l7 7-7 7"/></svg>
              </a>
              <a routerLink="/sessions" class="btn btn-outline-white btn-xl">Voir les sessions</a>
            </div>
          </div>
        </div>
      </div>
    </section>
  `,
  styles: [`
    /* ── Global helpers ──────────────────────────────────────────────────── */
    .container { max-width:1200px; margin:0 auto; padding:0 24px; }
    .sec-head   { text-align:center; margin-bottom:56px; }
    .sec-kicker {
      display:inline-block; font-size:.72rem; font-weight:700;
      letter-spacing:.12em; text-transform:uppercase;
      color:#6366f1; background:#eef2ff; padding:4px 14px;
      border-radius:9999px; margin-bottom:14px;
    }
    .sec-title {
      font-size:2.1rem; font-weight:800; color:#0f172a;
      line-height:1.2; margin-bottom:12px; letter-spacing:-.02em;
    }
    .sec-title.left { text-align:left; }
    .sec-sub { color:#64748b; font-size:1.05rem; max-width:540px; margin:0 auto; line-height:1.7; }
    .sec-sub.left { text-align:left; margin:0; }

    /* ── Hero ─────────────────────────────────────────────────────────────── */
    .hero {
      position:relative; overflow:hidden;
      background:#0f172a;
      min-height:100vh; display:flex; align-items:center;
      padding:100px 0 80px;
    }
    .hero-grid-bg {
      position:absolute; inset:0;
      background-image:
        linear-gradient(rgba(99,102,241,.07) 1px, transparent 1px),
        linear-gradient(90deg, rgba(99,102,241,.07) 1px, transparent 1px);
      background-size:48px 48px;
      pointer-events:none;
    }
    .orb {
      position:absolute; border-radius:50%;
      pointer-events:none; filter:blur(80px);
    }
    .orb-1 { width:600px; height:600px; background:rgba(99,102,241,.18); top:-200px; right:-100px; }
    .orb-2 { width:400px; height:400px; background:rgba(249,115,22,.12); bottom:-100px; left:-80px; }
    .orb-3 { width:300px; height:300px; background:rgba(16,185,129,.10); top:30%; left:30%; }

    .hero-inner {
      position:relative; z-index:2;
      display:grid; grid-template-columns:1fr 480px;
      gap:64px; align-items:center;
    }
    .hero-text { opacity:0; transform:translateY(24px); transition:all .7s ease; }
    .hero-text.visible { opacity:1; transform:translateY(0); }
    .hero-visual { opacity:0; transform:translateY(24px) scale(.97); transition:all .7s ease .2s; }
    .hero-visual.visible { opacity:1; transform:translateY(0) scale(1); }

    .hero-eyebrow {
      display:inline-flex; align-items:center; gap:8px;
      font-size:.78rem; font-weight:600; letter-spacing:.08em;
      text-transform:uppercase; color:#a5b4fc;
      background:rgba(99,102,241,.12); border:1px solid rgba(99,102,241,.2);
      padding:5px 14px; border-radius:9999px; margin-bottom:24px;
    }
    .eyebrow-dot {
      width:6px; height:6px; border-radius:50%; background:#6366f1;
      box-shadow:0 0 8px #6366f1; animation:pulse 2s infinite;
    }
    @keyframes pulse { 0%,100%{opacity:1} 50%{opacity:.4} }

    .hero-h1 {
      font-size:3.8rem; font-weight:800; line-height:1.1;
      color:#f8fafc; letter-spacing:-.03em; margin-bottom:22px;
    }
    .gradient-text {
      background:linear-gradient(135deg, #818cf8 0%, #f97316 100%);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      background-clip:text;
    }
    .hero-desc {
      font-size:1.1rem; color:#94a3b8; line-height:1.8;
      max-width:500px; margin-bottom:36px;
    }
    .hero-ctas { display:flex; gap:14px; flex-wrap:wrap; margin-bottom:36px; }
    .hero-cta-primary { box-shadow:0 8px 32px rgba(249,115,22,.4) !important; }

    .hero-trust { display:flex; align-items:center; gap:12px; }
    .trust-avatars { display:flex; }
    .ta {
      width:32px; height:32px; border-radius:50%;
      border:2px solid #0f172a; display:flex; align-items:center;
      justify-content:center; font-size:.7rem; font-weight:700;
      color:#fff; margin-left:-8px; transition:transform .2s;
    }
    .ta:first-child { margin-left:0; }
    .ta-1{background:#6366f1} .ta-2{background:#10b981} .ta-3{background:#f97316} .ta-4{background:#8b5cf6}
    .trust-text { font-size:.83rem; color:#64748b; }
    .trust-text strong { color:#94a3b8; }

    /* Hero visual card */
    .hv-card {
      background:rgba(255,255,255,.06); backdrop-filter:blur(16px);
      border:1px solid rgba(255,255,255,.10); border-radius:20px; padding:24px;
    }
    .hv-main { box-shadow:0 24px 64px rgba(0,0,0,.4); }
    .hv-card-header {
      display:flex; align-items:center; gap:6px; margin-bottom:20px;
    }
    .hvc-dot {
      width:10px; height:10px; border-radius:50%;
    }
    .hvc-dot.green  { background:#10b981; }
    .hvc-dot.yellow { background:#f59e0b; }
    .hvc-dot.red    { background:#ef4444; }
    .hvc-label { font-size:.72rem; font-weight:600; color:#94a3b8; margin-left:6px; letter-spacing:.06em; text-transform:uppercase; }
    .hv-project {
      display:flex; align-items:center; gap:12px;
      background:rgba(255,255,255,.05); border-radius:12px; padding:14px 16px;
      margin-bottom:20px;
    }
    .hv-project-icon { font-size:1.6rem; flex-shrink:0; }
    .hv-project-name { font-weight:700; color:#f1f5f9; font-size:.9rem; }
    .hv-project-sub  { font-size:.75rem; color:#64748b; margin-top:2px; }
    .hv-status-chip {
      margin-left:auto; background:#fef3c7; color:#b45309;
      font-size:.68rem; font-weight:700; padding:3px 10px;
      border-radius:9999px; white-space:nowrap;
    }
    .hv-scores { display:flex; flex-direction:column; gap:12px; }
    .hv-score-row {
      display:grid; grid-template-columns:90px 1fr 36px;
      align-items:center; gap:10px;
    }
    .hv-score-row > span:first-child { font-size:.75rem; color:#94a3b8; }
    .hv-bar-wrap { height:6px; background:rgba(255,255,255,.08); border-radius:3px; overflow:hidden; }
    .hv-bar { height:100%; border-radius:3px; transition:width .8s ease; }
    .hv-score-num { font-size:.75rem; font-weight:700; color:#f1f5f9; text-align:right; }

    /* Floating chips */
    .hv-chip {
      position:absolute;
      background:rgba(255,255,255,.95); backdrop-filter:blur(8px);
      border:1px solid rgba(255,255,255,.6);
      border-radius:12px; padding:8px 14px;
      font-size:.78rem; font-weight:700; color:#0f172a;
      display:flex; align-items:center; gap:6px;
      box-shadow:0 8px 24px rgba(0,0,0,.15);
      animation:float 4s ease-in-out infinite;
    }
    .chip-1 { bottom:120px; right:-20px; animation-delay:0s; }
    .chip-2 { top:80px;    right:30px;  animation-delay:1.3s; }
    .chip-3 { bottom:60px; left:-30px;  animation-delay:2.6s; }
    .hero-visual { position:relative; }
    @keyframes float { 0%,100%{transform:translateY(0)} 50%{transform:translateY(-8px)} }

    /* ── Stats band ────────────────────────────────────────────────────────── */
    .stats-band { background:#fff; border-bottom:1px solid #e2e8f0; }
    .stats-inner {
      display:grid; grid-template-columns:repeat(4,1fr);
      position:relative;
    }
    .stat-block {
      padding:32px 24px; text-align:center;
      border-right:1px solid #e2e8f0;
    }
    .stat-block:last-child { border-right:none; }
    .stat-num {
      font-size:2.4rem; font-weight:800; color:#0f172a;
      letter-spacing:-.03em; line-height:1;
      background:linear-gradient(135deg,#6366f1,#f97316);
      -webkit-background-clip:text; -webkit-text-fill-color:transparent;
      background-clip:text;
    }
    .stat-label { font-size:.82rem; color:#64748b; margin-top:6px; font-weight:500; }
    .stat-divider { display:none; }

    /* ── Sessions ─────────────────────────────────────────────────────────── */
    .sessions-section { padding:96px 0; background:#f8fafc; }
    .empty-box {
      text-align:center; background:#fff; border-radius:20px;
      padding:64px 40px; border:1px solid #e2e8f0; max-width:480px; margin:0 auto;
    }
    .empty-icon-wrap { font-size:3rem; margin-bottom:16px; }
    .empty-box h3 { font-size:1.1rem; font-weight:700; color:#1e293b; margin-bottom:8px; }
    .empty-box p  { color:#64748b; font-size:.9rem; }

    .sess-grid {
      display:grid; grid-template-columns:repeat(3,1fr); gap:24px;
    }
    .sess-card {
      background:#fff; border-radius:20px; padding:28px;
      border:1px solid #e2e8f0; display:flex; flex-direction:column; gap:14px;
      transition:all .25s ease; text-decoration:none; color:inherit;
      box-shadow:0 1px 4px rgba(0,0,0,.04);
      animation:fadeUp .5s ease both;
    }
    @keyframes fadeUp { from{opacity:0;transform:translateY(16px)} to{opacity:1;transform:none} }
    .sess-card:hover {
      transform:translateY(-4px);
      box-shadow:0 16px 40px rgba(99,102,241,.12), 0 4px 12px rgba(0,0,0,.06);
      border-color:#c7d2fe;
    }
    .sess-card-top { display:flex; align-items:center; justify-content:space-between; }
    .sc-badge {
      background:#eff6ff; color:#2563eb;
      font-size:.68rem; font-weight:700; letter-spacing:.06em;
      text-transform:uppercase; padding:3px 10px; border-radius:9999px;
    }
    .sc-days {
      background:#fffbeb; color:#b45309;
      font-size:.72rem; font-weight:600; padding:3px 10px; border-radius:9999px;
    }
    .sc-days.urgent { background:#fef2f2; color:#dc2626; }
    .sc-icon-wrap { width:48px; height:48px; background:#f8fafc; border-radius:12px; display:flex; align-items:center; justify-content:center; font-size:1.5rem; border:1px solid #e2e8f0; }
    .sc-title { font-size:1rem; font-weight:700; color:#0f172a; line-height:1.4; }
    .sc-desc  { font-size:.85rem; color:#64748b; line-height:1.6; flex:1; }
    .sc-meta  { display:flex; flex-direction:column; gap:6px; }
    .sc-meta-item { display:flex; align-items:center; gap:7px; font-size:.8rem; color:#94a3b8; }
    .sc-cta {
      display:flex; align-items:center; gap:6px;
      color:#6366f1; font-size:.85rem; font-weight:700;
      margin-top:4px; transition:gap .2s;
    }
    .sess-card:hover .sc-cta { gap:10px; }

    .sess-card-all {
      background:linear-gradient(135deg, #eef2ff 0%, #f5f3ff 100%);
      border:1.5px dashed #c7d2fe; justify-content:center; align-items:center;
      min-height:200px;
    }
    .sess-card-all:hover { border-color:#6366f1; background:linear-gradient(135deg,#e0e7ff,#ede9fe); }
    .sca-inner { text-align:center; }
    .sca-icon {
      width:56px; height:56px; background:#6366f1; color:#fff; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:1.4rem; margin:0 auto 12px; box-shadow:0 4px 16px rgba(99,102,241,.3);
    }
    .sca-inner h3 { font-size:1rem; font-weight:700; color:#4338ca; margin-bottom:6px; }
    .sca-inner p  { font-size:.83rem; color:#6366f1; }

    /* ── How it works ─────────────────────────────────────────────────────── */
    .how-section { padding:96px 0; background:#fff; }
    .how-grid {
      display:grid; grid-template-columns:repeat(4,1fr);
      gap:0; position:relative;
    }
    .how-step {
      padding:32px 24px; text-align:center;
      background:#fff; border:1px solid #e2e8f0; position:relative;
      transition:all .2s;
    }
    .how-step:first-child { border-radius:16px 0 0 16px; }
    .how-step:last-child  { border-radius:0 16px 16px 0; }
    .how-step:hover { background:#fafaff; border-color:#c7d2fe; z-index:1; box-shadow:0 4px 24px rgba(99,102,241,.1); }
    .how-num {
      font-size:.68rem; font-weight:800; letter-spacing:.1em;
      color:#a5b4fc; margin-bottom:16px; display:block;
    }
    .how-icon-wrap {
      width:60px; height:60px; border-radius:16px;
      display:flex; align-items:center; justify-content:center;
      font-size:1.6rem; margin:0 auto 18px;
    }
    .how-title { font-size:1rem; font-weight:700; color:#0f172a; margin-bottom:10px; }
    .how-desc  { font-size:.83rem; color:#64748b; line-height:1.7; }
    .how-connector {
      display:none;
      position:absolute; right:-16px; top:50%; transform:translateY(-50%);
      width:32px; height:2px; background:linear-gradient(to right,#e2e8f0,#c7d2fe);
      z-index:2;
    }

    /* ── Features ─────────────────────────────────────────────────────────── */
    .features-section { padding:96px 0; background:#f8fafc; }
    .features-grid {
      display:grid; grid-template-columns:1fr 1fr;
      gap:72px; align-items:center;
    }
    .feature-list { display:flex; flex-direction:column; gap:20px; margin-top:32px; }
    .feature-item { display:flex; align-items:flex-start; gap:16px; }
    .fi-icon {
      width:44px; height:44px; border-radius:12px;
      display:flex; align-items:center; justify-content:center;
      font-size:1.2rem; flex-shrink:0;
    }
    .fi-title { font-weight:700; color:#0f172a; font-size:.95rem; margin-bottom:3px; }
    .fi-desc  { font-size:.83rem; color:#64748b; line-height:1.6; }

    .features-visual { display:flex; flex-direction:column; gap:20px; }
    .fv-card {
      background:#fff; border-radius:24px; padding:36px;
      border:1px solid #e2e8f0; box-shadow:0 4px 24px rgba(0,0,0,.06);
      position:relative; overflow:hidden; text-align:center;
    }
    .fv-circle {
      position:absolute; border-radius:50%;
      background:linear-gradient(135deg,#eef2ff,#ede9fe);
    }
    .fv-c1 { width:200px; height:200px; top:-80px; right:-60px; }
    .fv-c2 { width:140px; height:140px; bottom:-40px; left:-40px; }
    .fv-ring {
      width:120px; height:120px; border-radius:50%;
      border:3px solid #e0e7ff; margin:0 auto 16px; position:relative; z-index:1;
      display:flex; align-items:center; justify-content:center;
      background:white;
    }
    .fv-inner { position:relative; z-index:2; }
    .fv-big-num   { font-size:3rem; font-weight:800; color:#4f46e5; letter-spacing:-.04em; }
    .fv-big-label { font-size:.85rem; color:#64748b; margin-top:4px; }
    .fv-row { display:grid; grid-template-columns:repeat(3,1fr); gap:12px; }
    .fv-mini-card {
      background:#fff; border-radius:16px; padding:20px 12px;
      border:1px solid #e2e8f0; text-align:center;
      box-shadow:0 2px 8px rgba(0,0,0,.04);
    }
    .fvmc-icon { font-size:1.4rem; margin-bottom:6px; }
    .fvmc-num   { font-size:1.4rem; font-weight:800; color:#0f172a; letter-spacing:-.02em; }
    .fvmc-label { font-size:.72rem; color:#64748b; font-weight:500; }

    /* ── Testimonials ─────────────────────────────────────────────────────── */
    .testimonials-section { padding:96px 0; background:#fff; }
    .testimonials-grid { display:grid; grid-template-columns:repeat(3,1fr); gap:24px; }
    .testi-card {
      background:#f8fafc; border-radius:20px; padding:28px;
      border:1px solid #e2e8f0; transition:all .2s;
    }
    .testi-card:hover { transform:translateY(-3px); box-shadow:0 8px 28px rgba(0,0,0,.07); background:#fff; }
    .testi-stars { color:#f59e0b; font-size:1rem; letter-spacing:2px; margin-bottom:14px; }
    .testi-quote { font-size:.9rem; color:#334155; line-height:1.7; margin-bottom:20px; font-style:italic; }
    .testi-author { display:flex; align-items:center; gap:12px; }
    .testi-avatar {
      width:42px; height:42px; border-radius:50%;
      display:flex; align-items:center; justify-content:center;
      font-size:.85rem; font-weight:800; color:#fff; flex-shrink:0;
    }
    .testi-name { font-weight:700; font-size:.9rem; color:#0f172a; }
    .testi-role { font-size:.75rem; color:#64748b; }

    /* ── CTA ──────────────────────────────────────────────────────────────── */
    .cta-section { padding:96px 0; background:#f8fafc; }
    .cta-card {
      background:linear-gradient(135deg, #4f46e5 0%, #7c3aed 50%, #c026d3 100%);
      border-radius:28px; padding:80px 60px; text-align:center;
      position:relative; overflow:hidden;
      box-shadow:0 20px 60px rgba(79,70,229,.35);
    }
    .cta-glow {
      position:absolute; width:400px; height:400px; border-radius:50%;
      background:rgba(255,255,255,.06); top:-100px; right:-100px;
      pointer-events:none;
    }
    .cta-content { position:relative; z-index:1; }
    .white-kicker {
      background:rgba(255,255,255,.15); color:rgba(255,255,255,.9);
      border:1px solid rgba(255,255,255,.2);
    }
    .cta-h2 {
      font-size:2.6rem; font-weight:800; color:#fff;
      letter-spacing:-.02em; margin-bottom:16px; line-height:1.2;
    }
    .cta-sub {
      color:rgba(255,255,255,.8); font-size:1.05rem;
      max-width:520px; margin:0 auto 36px; line-height:1.7;
    }
    .cta-btns { display:flex; gap:16px; justify-content:center; flex-wrap:wrap; }

    /* ── Responsive ───────────────────────────────────────────────────────── */
    @media (max-width:1100px) {
      .hero-inner    { grid-template-columns:1fr; gap:48px; }
      .hv-chip       { display:none; }
      .hero-h1       { font-size:3rem; }
    }
    @media (max-width:900px) {
      .hero          { padding:80px 0 60px; min-height:auto; }
      .hero-h1       { font-size:2.4rem; }
      .hero-desc     { font-size:.95rem; }
      .hero-visual   { display:none; }
      .stats-inner   { grid-template-columns:repeat(2,1fr); }
      .stat-block    { border-right:none; border-bottom:1px solid #e2e8f0; }
      .sess-grid     { grid-template-columns:1fr; }
      .how-grid      { grid-template-columns:1fr 1fr; gap:16px; }
      .how-step:first-child { border-radius:16px 0 0 0; }
      .how-step:last-child  { border-radius:0 0 16px 0; }
      .features-grid        { grid-template-columns:1fr; gap:40px; }
      .testimonials-grid    { grid-template-columns:1fr; }
      .cta-card   { padding:48px 24px; border-radius:20px; }
      .cta-h2     { font-size:1.8rem; }
      .sec-title  { font-size:1.7rem; }
    }
    @media (max-width:600px) {
      .how-grid { grid-template-columns:1fr; }
      .how-step { border-radius:0 !important; }
      .how-step:first-child { border-radius:16px 16px 0 0 !important; }
      .how-step:last-child  { border-radius:0 0 16px 16px !important; }
      .hero-ctas { flex-direction:column; }
      .btn-xl { width:100%; }
      .stats-inner { grid-template-columns:1fr 1fr; }
      .fv-row { grid-template-columns:1fr; }
    }
  `]
})
export class HomeComponent implements OnInit {
  sessions: Session[] = [];
  loading = true;
  heroVisible = false;

  stats = [
    { value: '50+',  label: 'Startups incubées' },
    { value: '15M+', label: 'DT levés' },
    { value: '30+',  label: 'Experts mentors' },
    { value: '85%',  label: 'Taux de succès' },
  ];

  steps = [
    { icon: '📝', title: 'Candidature', bg: '#eef2ff',
      desc: 'Remplissez votre dossier en ligne en 4 étapes guidées avec tous les détails de votre projet.' },
    { icon: '⚖️', title: 'Évaluation', bg: '#fffbeb',
      desc: 'Un jury d\'experts note votre projet sur 4 critères : innovation, faisabilité, marché et équipe.' },
    { icon: '🌱', title: 'Incubation', bg: '#f0fdf4',
      desc: 'Programme intensif de 6 mois avec mentorat, ateliers et accès à nos ressources.' },
    { icon: '🎤', title: 'Demo Day', bg: '#fdf4ff',
      desc: 'Pitchez devant des investisseurs tunisiens et internationaux lors de notre grand événement annuel.' },
  ];

  features = [
    { icon: '🎯', bg: '#eef2ff',
      title: 'Sélection rigoureuse',
      desc: 'Processus transparent avec critères clairs — chaque candidature reçoit un retour détaillé.' },
    { icon: '👥', bg: '#f0fdf4',
      title: 'Réseau d\'experts',
      desc: '30+ mentors actifs dans la Tech, Finance, Marketing et Droit pour vous accompagner.' },
    { icon: '💰', bg: '#fffbeb',
      title: 'Accès au financement',
      desc: 'Connexion directe avec des business angels et fonds d\'investissement partenaires.' },
    { icon: '🚀', bg: '#fdf4ff',
      title: 'Croissance accélérée',
      desc: 'KPIs suivis, ajustements stratégiques hebdomadaires et support opérationnel continu.' },
  ];

  testimonials = [
    { quote: 'Le programme Medianet nous a permis de structurer notre idée et de rencontrer les bons investisseurs. En 6 mois nous avons levé 400k DT.',
      name: 'Anis Trabelsi', role: 'CEO, EcoFinance', initials: 'AT', color: '#6366f1' },
    { quote: 'L\'accompagnement est vraiment personnalisé. Les mentors connaissent les réalités du marché tunisien et donnent des conseils concrets.',
      name: 'Mariem Ben Salah', role: 'Fondatrice, AgriSmart', initials: 'MB', color: '#10b981' },
    { quote: 'J\'ai candidaté sans beaucoup d\'espoir — le processus en ligne est très simple. Aujourd\'hui notre startup est officiellement lancée.',
      name: 'Sami Khediri', role: 'CTO, HealthTrack', initials: 'SK', color: '#f97316' },
  ];

  constructor(
    private sessionService: SessionService,
    public authService: AuthService
  ) {}

  ngOnInit(): void {
    // Trigger hero entrance animation
    setTimeout(() => this.heroVisible = true, 100);

    this.sessionService.getSessions('OPEN').subscribe({
      next: (sessions) => {
        this.sessions = sessions.slice(0, 3);
        this.loading = false;
      },
      error: () => { this.loading = false; }
    });
  }

  getDaysLeft(deadline: string): number {
    const d = new Date(deadline).getTime() - Date.now();
    return Math.max(0, Math.ceil(d / 86400000));
  }

  sessionIcon(index: number): string {
    return ['🌱', '⚡', '🎯', '🚀', '💡', '🔬'][index % 6];
  }
}
