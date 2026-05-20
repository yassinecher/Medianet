import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { UserService } from '../../core/services/user.service';
import { User, PermissionCatalog } from '../../core/models/user.model';

@Component({
  selector: 'app-users',
  standalone: true,
  imports: [CommonModule, FormsModule],
  template: `
    <div class="page">

      <!-- Page header -->
      <div class="page-header">
        <div>
          <h1 class="page-title">Gestion des utilisateurs</h1>
          <p class="page-subtitle">{{ users.length }} utilisateur(s) enregistré(s)</p>
        </div>
      </div>

      <!-- Toolbar -->
      <div class="toolbar">
        <div class="search-wrap">
          <svg class="search-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
            <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
          </svg>
          <input class="search-input" type="text" placeholder="Rechercher..." [(ngModel)]="search" (ngModelChange)="applyFilter()">
        </div>
        <div class="filter-tabs">
          <button *ngFor="let tab of tabs" class="tab-pill" [class.active]="activeTab === tab.value" (click)="setTab(tab.value)">
            {{ tab.label }}<span class="pill-count">{{ getCount(tab.value) }}</span>
          </button>
        </div>
      </div>

      <!-- Table card -->
      <div class="card">
        <div class="loading-state" *ngIf="loading">
          <div class="spinner"></div><span>Chargement...</span>
        </div>

        <div class="empty-state" *ngIf="!loading && filtered.length === 0">
          <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5" width="40" height="40">
            <path d="M17 21v-2a4 4 0 0 0-4-4H5a4 4 0 0 0-4 4v2"/><circle cx="9" cy="7" r="4"/>
            <path d="M23 21v-2a4 4 0 0 0-3-3.87M16 3.13a4 4 0 0 1 0 7.75"/>
          </svg>
          <p>Aucun utilisateur trouvé</p>
        </div>

        <div class="table-wrap" *ngIf="!loading && filtered.length > 0">
          <table class="data-table">
            <thead>
              <tr>
                <th>Utilisateur</th>
                <th>Email</th>
                <th>Rôles</th>
                <th>Permissions directes</th>
                <th>Statut</th>
                <th>Inscrit le</th>
                <th style="text-align:right">Actions</th>
              </tr>
            </thead>
            <tbody>
              <tr *ngFor="let u of filtered" [class.row-inactive]="!u.active">

                <!-- Avatar + name -->
                <td>
                  <div class="user-cell">
                    <div class="avatar" [style.background]="avatarColor(u)">{{ getInitials(u) }}</div>
                    <div>
                      <div class="user-name">{{ u.firstName }} {{ u.lastName }}</div>
                      <div class="user-id">#{{ u.id }}</div>
                    </div>
                  </div>
                </td>

                <!-- Email -->
                <td class="email-cell">{{ u.email }}</td>

                <!-- Roles column -->
                <td>
                  <div class="roles-cell" *ngIf="editingUser !== u.id || editMode !== 'roles'">
                    <span *ngFor="let r of u.roles" [class]="'role-badge role-' + r.toLowerCase()">{{ roleLabel(r) }}</span>
                    <span *ngIf="!u.roles?.length" class="no-role">—</span>
                    <button class="icon-btn" (click)="openEdit(u, 'roles')" title="Modifier les rôles">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                        <path d="M11 4H4a2 2 0 0 0-2 2v14a2 2 0 0 0 2 2h14a2 2 0 0 0 2-2v-7"/>
                        <path d="M18.5 2.5a2.121 2.121 0 0 1 3 3L12 15l-4 1 1-4 9.5-9.5z"/>
                      </svg>
                    </button>
                  </div>
                  <!-- Role edit inline -->
                  <div class="inline-edit" *ngIf="editingUser === u.id && editMode === 'roles'">
                    <div class="checkbox-group">
                      <label *ngFor="let r of allRoles" class="cb-label">
                        <input type="checkbox" [checked]="draftRoles.has(r.value)" (change)="toggleDraftRole(r.value)">
                        <span [class]="'role-badge role-' + r.value.toLowerCase()">{{ r.label }}</span>
                      </label>
                    </div>
                    <div class="edit-actions">
                      <button class="btn-save" (click)="saveRoles(u)" [disabled]="saving">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
                        Sauvegarder
                      </button>
                      <button class="btn-cancel" (click)="closeEdit()">Annuler</button>
                    </div>
                  </div>
                </td>

                <!-- Permissions column -->
                <td>
                  <div class="perms-cell" *ngIf="editingUser !== u.id || editMode !== 'perms'">
                    <div class="perm-tags" *ngIf="u.directPermissions?.length">
                      <span class="perm-tag" *ngFor="let p of u.directPermissions">{{ permLabel(p) }}</span>
                    </div>
                    <span class="no-role" *ngIf="!u.directPermissions?.length">Aucune</span>
                    <button class="icon-btn" (click)="openEdit(u, 'perms')" title="Gérer les permissions">
                      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                        <rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/>
                      </svg>
                    </button>
                  </div>
                  <!-- Permission edit inline -->
                  <div class="inline-edit wide" *ngIf="editingUser === u.id && editMode === 'perms'">
                    <div class="perm-groups">
                      <div *ngFor="let group of permGroups" class="perm-group">
                        <div class="perm-group-label">{{ group.label }}</div>
                        <label *ngFor="let p of group.items" class="cb-label cb-perm">
                          <input type="checkbox" [checked]="draftPerms.has(p.slug)" (change)="toggleDraftPerm(p.slug)">
                          <span class="perm-slug">{{ p.slug }}</span>
                          <span class="perm-desc">{{ p.desc }}</span>
                        </label>
                      </div>
                    </div>
                    <div class="edit-actions">
                      <button class="btn-save" (click)="savePermissions(u)" [disabled]="saving">
                        <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5" width="12" height="12"><polyline points="20 6 9 17 4 12"/></svg>
                        Sauvegarder
                      </button>
                      <button class="btn-cancel" (click)="closeEdit()">Annuler</button>
                    </div>
                  </div>
                </td>

                <!-- Status -->
                <td>
                  <span class="status-badge" [class.status-active]="u.active" [class.status-inactive]="!u.active">
                    <span class="status-dot"></span>{{ u.active ? 'Actif' : 'Suspendu' }}
                  </span>
                </td>

                <!-- Date -->
                <td class="date-cell">{{ u.createdAt | date:'dd/MM/yyyy' }}</td>

                <!-- Actions -->
                <td class="actions-cell">
                  <button class="action-btn" [class.btn-danger]="u.active" [class.btn-success]="!u.active"
                          (click)="toggleActive(u)" [disabled]="togglingId === u.id">
                    <svg *ngIf="u.active" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                      <path d="M18.364 18.364A9 9 0 0 0 5.636 5.636m12.728 12.728A9 9 0 0 1 5.636 5.636m12.728 12.728L5.636 5.636"/>
                    </svg>
                    <svg *ngIf="!u.active" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2" width="13" height="13">
                      <path d="M9 12l2 2 4-4m6 2a9 9 0 1 1-18 0 9 9 0 0 1 18 0z"/>
                    </svg>
                    {{ u.active ? 'Suspendre' : 'Restaurer' }}
                  </button>
                </td>
              </tr>
            </tbody>
          </table>
        </div>
      </div>

      <!-- Toast -->
      <div class="toast-success" *ngIf="successMsg">{{ successMsg }}</div>
      <div class="toast-error"   *ngIf="errorMsg">{{ errorMsg }}</div>
    </div>
  `,
  styles: [`
    /* ── Layout ─────────────────────────────────────────────────────────── */
    .page-header { display:flex; justify-content:space-between; align-items:flex-start; margin-bottom:1.5rem; }
    .page-title  { font-size:1.5rem; font-weight:700; color:#0f172a; margin:0; letter-spacing:-0.025em; }
    .page-subtitle { color:#64748b; margin:.25rem 0 0; font-size:.875rem; }

    /* ── Toolbar ─────────────────────────────────────────────────────────── */
    .toolbar { display:flex; gap:1rem; align-items:center; flex-wrap:wrap; margin-bottom:1rem; }
    .search-wrap { position:relative; flex:1; min-width:200px; max-width:320px; }
    .search-icon { position:absolute; left:10px; top:50%; transform:translateY(-50%); width:16px; height:16px; color:#94a3b8; pointer-events:none; }
    .search-input { width:100%; padding:.5rem .75rem .5rem 2.25rem; border:1px solid #e2e8f0; border-radius:8px; font-size:.875rem; outline:none; background:#fff; box-sizing:border-box; }
    .search-input:focus { border-color:#3b82f6; box-shadow:0 0 0 3px rgba(59,130,246,.1); }
    .filter-tabs { display:flex; gap:.375rem; flex-wrap:wrap; }
    .tab-pill { padding:.375rem .875rem; border-radius:9999px; border:1px solid #e2e8f0; background:#fff; cursor:pointer; font-size:.8rem; font-weight:500; color:#64748b; display:flex; align-items:center; gap:.375rem; transition:all .15s; }
    .tab-pill:hover { border-color:#94a3b8; color:#0f172a; }
    .tab-pill.active { background:#0f172a; border-color:#0f172a; color:#fff; }
    .pill-count { background:rgba(0,0,0,.08); border-radius:9999px; padding:0 .4rem; font-size:.7rem; }
    .tab-pill.active .pill-count { background:rgba(255,255,255,.2); }

    /* ── Card / Table ─────────────────────────────────────────────────────── */
    .card { background:#fff; border:1px solid #e2e8f0; border-radius:12px; overflow:hidden; box-shadow:0 1px 3px rgba(0,0,0,.04); }
    .loading-state { display:flex; align-items:center; justify-content:center; gap:.75rem; padding:3rem; color:#64748b; font-size:.9rem; }
    .spinner { width:20px; height:20px; border:2px solid #e2e8f0; border-top-color:#3b82f6; border-radius:50%; animation:spin .7s linear infinite; }
    @keyframes spin { to { transform:rotate(360deg); } }
    .empty-state { display:flex; flex-direction:column; align-items:center; justify-content:center; gap:.75rem; padding:4rem; color:#94a3b8; }
    .empty-state p { font-size:.9rem; margin:0; }
    .table-wrap { overflow-x:auto; }

    .data-table { width:100%; border-collapse:collapse; font-size:.875rem; }
    .data-table thead tr { background:#f8fafc; border-bottom:1px solid #e2e8f0; }
    .data-table th { padding:.75rem 1rem; text-align:left; font-size:.72rem; font-weight:600; color:#64748b; text-transform:uppercase; letter-spacing:.05em; white-space:nowrap; }
    .data-table td { padding:.875rem 1rem; border-bottom:1px solid #f1f5f9; vertical-align:top; }
    .data-table tbody tr:last-child td { border-bottom:none; }
    .data-table tbody tr:hover { background:#fafcff; }
    .row-inactive td { opacity:.5; }

    /* ── User cell ─────────────────────────────────────────────────────────── */
    .user-cell { display:flex; align-items:center; gap:.75rem; }
    .avatar { width:36px; height:36px; border-radius:9999px; display:flex; align-items:center; justify-content:center; font-size:.75rem; font-weight:700; color:#fff; flex-shrink:0; }
    .user-name { font-weight:600; color:#0f172a; font-size:.875rem; }
    .user-id   { font-size:.72rem; color:#94a3b8; }
    .email-cell { color:#64748b; font-size:.85rem; }
    .date-cell  { color:#94a3b8; font-size:.82rem; white-space:nowrap; }
    .actions-cell { text-align:right; white-space:nowrap; }

    /* ── Role badges ─────────────────────────────────────────────────────────── */
    .roles-cell { display:flex; align-items:center; gap:.3rem; flex-wrap:wrap; }
    .role-badge { display:inline-flex; align-items:center; padding:.18rem .6rem; border-radius:9999px; font-size:.7rem; font-weight:600; white-space:nowrap; }
    .role-admin   { background:#f3e8ff; color:#6b21a8; }
    .role-porteur { background:#dbeafe; color:#1d4ed8; }
    .role-jury    { background:#fef9c3; color:#854d0e; }
    .role-mentor  { background:#dcfce7; color:#166534; }
    .role-candidat{ background:#f1f5f9; color:#475569; }
    .no-role { font-size:.78rem; color:#94a3b8; }

    /* ── Permission tags ─────────────────────────────────────────────────────── */
    .perms-cell { display:flex; align-items:flex-start; gap:.3rem; flex-wrap:wrap; }
    .perm-tags  { display:flex; flex-wrap:wrap; gap:3px; }
    .perm-tag   { font-size:.66rem; background:#eff6ff; border:1px solid #bfdbfe; color:#1d4ed8; padding:1px 7px; border-radius:4px; white-space:nowrap; }

    /* ── Icon button ─────────────────────────────────────────────────────────── */
    .icon-btn { background:none; border:none; cursor:pointer; color:#94a3b8; padding:3px; display:flex; align-items:center; border-radius:5px; transition:all .15s; flex-shrink:0; }
    .icon-btn:hover { color:#3b82f6; background:#eff6ff; }

    /* ── Inline edit panel ─────────────────────────────────────────────────── */
    .inline-edit { background:#f8fafc; border:1px solid #e2e8f0; border-radius:10px; padding:.75rem; margin-top:.3rem; min-width:200px; }
    .inline-edit.wide { min-width:340px; }
    .checkbox-group { display:flex; flex-direction:column; gap:.35rem; margin-bottom:.6rem; }
    .cb-label { display:flex; align-items:center; gap:.5rem; cursor:pointer; font-size:.82rem; }
    .cb-label input[type=checkbox] { accent-color:#3b82f6; width:14px; height:14px; flex-shrink:0; }

    /* Permission groups inside edit panel */
    .perm-groups { display:flex; flex-direction:column; gap:.6rem; margin-bottom:.65rem; max-height:260px; overflow-y:auto; }
    .perm-group-label { font-size:.65rem; font-weight:700; color:#64748b; text-transform:uppercase; letter-spacing:.06em; margin-bottom:.25rem; }
    .cb-perm { align-items:flex-start; }
    .perm-slug { font-size:.72rem; font-weight:600; color:#1d4ed8; font-family:monospace; }
    .perm-desc { font-size:.72rem; color:#64748b; }

    .edit-actions { display:flex; gap:.4rem; align-items:center; }
    .btn-save   { display:inline-flex; align-items:center; gap:.3rem; background:#0f172a; color:#fff; border:none; border-radius:6px; padding:.35rem .75rem; font-size:.78rem; font-weight:600; cursor:pointer; transition:background .15s; }
    .btn-save:hover:not(:disabled) { background:#1e293b; }
    .btn-save:disabled { opacity:.5; cursor:not-allowed; }
    .btn-cancel { background:#f1f5f9; color:#475569; border:none; border-radius:6px; padding:.35rem .65rem; font-size:.78rem; font-weight:500; cursor:pointer; }
    .btn-cancel:hover { background:#e2e8f0; }

    /* ── Status ─────────────────────────────────────────────────────────────── */
    .status-badge    { display:inline-flex; align-items:center; gap:.35rem; padding:.2rem .65rem; border-radius:9999px; font-size:.75rem; font-weight:500; white-space:nowrap; }
    .status-active   { background:#f0fdf4; color:#166534; }
    .status-inactive { background:#fef2f2; color:#991b1b; }
    .status-dot { width:6px; height:6px; border-radius:50%; flex-shrink:0; background:currentColor; }

    /* ── Action buttons ─────────────────────────────────────────────────────── */
    .action-btn { display:inline-flex; align-items:center; gap:.3rem; padding:.35rem .75rem; border-radius:7px; font-size:.78rem; font-weight:500; cursor:pointer; border:1px solid transparent; transition:all .15s; }
    .action-btn:disabled { opacity:.5; cursor:not-allowed; }
    .btn-danger  { background:#fef2f2; color:#dc2626; border-color:#fecaca; }
    .btn-danger:hover:not(:disabled)  { background:#fee2e2; }
    .btn-success { background:#f0fdf4; color:#16a34a; border-color:#bbf7d0; }
    .btn-success:hover:not(:disabled) { background:#dcfce7; }

    /* ── Toasts ─────────────────────────────────────────────────────────────── */
    .toast-success, .toast-error { position:fixed; bottom:1.5rem; right:1.5rem; padding:.75rem 1.25rem; border-radius:8px; font-size:.875rem; box-shadow:0 4px 12px rgba(0,0,0,.15); animation:slide-in .2s ease; z-index:1000; }
    .toast-success { background:#0f172a; color:#fff; }
    .toast-error   { background:#dc2626; color:#fff; }
    @keyframes slide-in { from { transform:translateY(8px); opacity:0; } to { transform:translateY(0); opacity:1; } }
  `]
})
export class UsersComponent implements OnInit {

  users:    User[] = [];
  filtered: User[] = [];
  loading  = true;
  saving   = false;
  activeTab = 'ALL';
  search    = '';
  togglingId: number | null = null;
  successMsg = '';
  errorMsg   = '';

  // Inline-edit state
  editingUser: number | null = null;
  editMode: 'roles' | 'perms' | null = null;
  draftRoles = new Set<string>();
  draftPerms = new Set<string>();

  // Permission catalog loaded from API
  catalog: PermissionCatalog = {};

  tabs = [
    { label: 'Tous',      value: 'ALL'      },
    { label: 'Admins',    value: 'ADMIN'    },
    { label: 'Porteurs',  value: 'PORTEUR'  },
    { label: 'Jurés',     value: 'JURY'     },
    { label: 'Mentors',   value: 'MENTOR'   },
    { label: 'Candidats', value: 'CANDIDAT' }
  ];

  allRoles = [
    { value: 'ADMIN',    label: 'Admin'    },
    { value: 'PORTEUR',  label: 'Porteur'  },
    { value: 'JURY',     label: 'Jury'     },
    { value: 'MENTOR',   label: 'Mentor'   },
    { value: 'CANDIDAT', label: 'Candidat' }
  ];

  /** Grouped permissions for the edit panel */
  get permGroups() {
    const groups: { label: string; items: { slug: string; desc: string }[] }[] = [
      { label: 'Utilisateurs', items: [] },
      { label: 'Sessions',     items: [] },
      { label: 'Candidatures', items: [] },
      { label: 'Rapports',     items: [] },
    ];
    for (const [slug, desc] of Object.entries(this.catalog)) {
      const item = { slug, desc };
      if (slug.startsWith('users'))        groups[0].items.push(item);
      else if (slug.startsWith('sessions'))     groups[1].items.push(item);
      else if (slug.startsWith('candidatures')) groups[2].items.push(item);
      else if (slug.startsWith('reports'))      groups[3].items.push(item);
    }
    return groups.filter(g => g.items.length);
  }

  private colorPalette = ['#6366f1','#f97316','#0891b2','#7c3aed','#0d9488','#dc2626','#d97706'];
  private avatarColors: Record<number, string> = {};

  constructor(private userService: UserService) {}

  ngOnInit() {
    this.userService.getUsers().subscribe({
      next: u  => { this.users = u; this.applyFilter(); this.loading = false; },
      error: () => this.loading = false
    });
    this.userService.getPermissionCatalog().subscribe({
      next: c => this.catalog = c,
      error: () => {} // non-blocking
    });
  }

  // ── Filtering ────────────────────────────────────────────────────────────

  setTab(value: string) { this.activeTab = value; this.applyFilter(); }

  applyFilter() {
    let result = this.activeTab === 'ALL'
      ? this.users
      : this.users.filter(u => u.roles?.includes(this.activeTab));

    if (this.search.trim()) {
      const s = this.search.toLowerCase();
      result = result.filter(u =>
        u.firstName?.toLowerCase().includes(s) ||
        u.lastName?.toLowerCase().includes(s)  ||
        u.email?.toLowerCase().includes(s)
      );
    }
    this.filtered = result;
  }

  getCount(tab: string): number {
    return tab === 'ALL' ? this.users.length : this.users.filter(u => u.roles?.includes(tab)).length;
  }

  // ── Inline edit helpers ──────────────────────────────────────────────────

  openEdit(u: User, mode: 'roles' | 'perms') {
    this.editingUser = u.id;
    this.editMode    = mode;
    if (mode === 'roles') this.draftRoles = new Set(u.roles ?? []);
    if (mode === 'perms') this.draftPerms = new Set(u.directPermissions ?? []);
  }

  closeEdit() { this.editingUser = null; this.editMode = null; }

  toggleDraftRole(r: string) {
    if (this.draftRoles.has(r)) this.draftRoles.delete(r);
    else this.draftRoles.add(r);
  }

  toggleDraftPerm(p: string) {
    if (this.draftPerms.has(p)) this.draftPerms.delete(p);
    else this.draftPerms.add(p);
  }

  // ── Save roles ────────────────────────────────────────────────────────────

  saveRoles(u: User) {
    if (this.draftRoles.size === 0) {
      this.showError('Un utilisateur doit avoir au moins un rôle.');
      return;
    }
    this.saving = true;
    this.userService.syncRoles(u.id, Array.from(this.draftRoles)).subscribe({
      next: updated => {
        this.replaceUser(updated);
        this.closeEdit();
        this.saving = false;
        this.showSuccess('Rôles mis à jour');
      },
      error: err => { this.saving = false; this.showError(err?.error?.message ?? 'Erreur'); }
    });
  }

  // ── Save permissions ──────────────────────────────────────────────────────

  savePermissions(u: User) {
    this.saving = true;
    this.userService.syncPermissions(u.id, Array.from(this.draftPerms)).subscribe({
      next: updated => {
        this.replaceUser(updated);
        this.closeEdit();
        this.saving = false;
        this.showSuccess('Permissions mises à jour');
      },
      error: err => { this.saving = false; this.showError(err?.error?.message ?? 'Erreur'); }
    });
  }

  // ── Toggle active ─────────────────────────────────────────────────────────

  toggleActive(u: User) {
    this.togglingId = u.id;
    this.userService.toggleActive(u.id).subscribe({
      next: updated => {
        this.replaceUser(updated);
        this.togglingId = null;
        this.showSuccess(updated.active ? 'Compte restauré' : 'Compte suspendu');
      },
      error: () => { this.togglingId = null; }
    });
  }

  // ── Display helpers ───────────────────────────────────────────────────────

  roleLabel(r: string): string {
    return ({ ADMIN:'Admin', PORTEUR:'Porteur', JURY:'Jury', MENTOR:'Mentor', CANDIDAT:'Candidat' } as Record<string,string>)[r] || r;
  }

  permLabel(slug: string): string {
    return this.catalog[slug] ?? slug;
  }

  getInitials(u: User): string {
    return ((u.firstName?.[0] || '') + (u.lastName?.[0] || '')).toUpperCase() || '?';
  }

  avatarColor(u: User): string {
    if (!this.avatarColors[u.id]) {
      this.avatarColors[u.id] = this.colorPalette[u.id % this.colorPalette.length];
    }
    return this.avatarColors[u.id];
  }

  // ── Internals ─────────────────────────────────────────────────────────────

  private replaceUser(updated: User) {
    const idx = this.users.findIndex(x => x.id === updated.id);
    if (idx !== -1) this.users[idx] = updated;
    this.applyFilter();
  }

  private showSuccess(msg: string) {
    this.successMsg = msg; this.errorMsg = '';
    setTimeout(() => this.successMsg = '', 3000);
  }

  private showError(msg: string) {
    this.errorMsg = msg; this.successMsg = '';
    setTimeout(() => this.errorMsg = '', 4000);
  }
}
