import { Component } from '@angular/core';
import { RouterModule } from '@angular/router';

@Component({
  selector: 'app-footer',
  standalone: true,
  imports: [RouterModule],
  template: `
    <footer class="footer">
      <div class="footer-container">
        <div class="footer-brand">
          <span>🚀</span>
          <span class="brand-name">Medianet Incubateur</span>
        </div>
        <div class="footer-links">
          <a routerLink="/">Accueil</a>
          <a routerLink="/sessions">Sessions</a>
          <a routerLink="/register">Candidater</a>
        </div>
        <div class="footer-copy">
          © 2024 Medianet Incubateur. Tous droits réservés.
        </div>
      </div>
    </footer>
  `,
  styles: [`
    .footer {
      background: #1a2332;
      color: #94a3b8;
      padding: 32px 0 20px;
      margin-top: auto;
    }
    .footer-container {
      max-width: 1200px;
      margin: 0 auto;
      padding: 0 24px;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 16px;
      text-align: center;
    }
    .footer-brand {
      display: flex;
      align-items: center;
      gap: 8px;
      font-size: 1.1rem;
    }
    .brand-name { font-weight: 700; color: #fff; }
    .footer-links {
      display: flex;
      gap: 24px;
      flex-wrap: wrap;
      justify-content: center;
    }
    .footer-links a {
      color: #94a3b8;
      text-decoration: none;
      font-size: 0.875rem;
      transition: color 0.2s;
    }
    .footer-links a:hover { color: #fff; }
    .footer-copy {
      font-size: 0.8rem;
      color: #64748b;
      margin-top: 8px;
      padding-top: 16px;
      border-top: 1px solid #2d3f55;
      width: 100%;
    }
  `]
})
export class FooterComponent {}
