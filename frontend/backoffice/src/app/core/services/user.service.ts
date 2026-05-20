import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import {
  User, PermissionCatalog, RoleCatalog,
  AdminProfile, MentorProfile, PorteurProfile, JuryProfile
} from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class UserService {
  private readonly API = 'http://localhost:8080/api/auth';

  constructor(private http: HttpClient) {}

  // ── User queries ──────────────────────────────────────────────────────────

  getUsers(): Observable<User[]> {
    return this.http.get<User[]>(`${this.API}/users`);
  }

  getUsersByRole(role: string): Observable<User[]> {
    return this.http.get<User[]>(`${this.API}/users/role/${role}`);
  }

  getUserById(id: number): Observable<User> {
    return this.http.get<User>(`${this.API}/users/${id}`);
  }

  toggleActive(id: number): Observable<User> {
    return this.http.patch<User>(`${this.API}/users/${id}/toggle-active`, {});
  }

  // ── Multi-role management ─────────────────────────────────────────────────

  getRoleCatalog(): Observable<RoleCatalog> {
    return this.http.get<RoleCatalog>(`${this.API}/roles`);
  }

  syncRoles(id: number, roles: string[]): Observable<User> {
    return this.http.put<User>(`${this.API}/users/${id}/roles`, { roles });
  }

  assignRoles(id: number, roles: string[]): Observable<User> {
    return this.http.post<User>(`${this.API}/users/${id}/roles/assign`, { roles });
  }

  removeRoles(id: number, roles: string[]): Observable<User> {
    return this.http.post<User>(`${this.API}/users/${id}/roles/remove`, { roles });
  }

  // ── Permission management ─────────────────────────────────────────────────

  getPermissionCatalog(): Observable<PermissionCatalog> {
    return this.http.get<PermissionCatalog>(`${this.API}/permissions`);
  }

  grantPermissions(id: number, permissions: string[]): Observable<User> {
    return this.http.post<User>(`${this.API}/users/${id}/permissions/grant`, { permissions });
  }

  revokePermissions(id: number, permissions: string[]): Observable<User> {
    return this.http.post<User>(`${this.API}/users/${id}/permissions/revoke`, { permissions });
  }

  syncPermissions(id: number, permissions: string[]): Observable<User> {
    return this.http.put<User>(`${this.API}/users/${id}/permissions`, { permissions });
  }

  // ── Role-specific profile updates ─────────────────────────────────────────

  updateAdminProfile(userId: number, data: Partial<AdminProfile>): Observable<AdminProfile> {
    return this.http.put<AdminProfile>(`${this.API}/users/${userId}/profile/admin`, data);
  }

  updateMentorProfile(userId: number, data: Partial<MentorProfile>): Observable<MentorProfile> {
    return this.http.put<MentorProfile>(`${this.API}/users/${userId}/profile/mentor`, data);
  }

  updatePorteurProfile(userId: number, data: Partial<PorteurProfile>): Observable<PorteurProfile> {
    return this.http.put<PorteurProfile>(`${this.API}/users/${userId}/profile/porteur`, data);
  }

  updateJuryProfile(userId: number, data: Partial<JuryProfile>): Observable<JuryProfile> {
    return this.http.put<JuryProfile>(`${this.API}/users/${userId}/profile/jury`, data);
  }
}
