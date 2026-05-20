import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap } from 'rxjs';
import { Router } from '@angular/router';
import { AuthResponse } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API       = 'http://localhost:8080/api/auth';
  private readonly TOKEN_KEY = 'medianet_token';
  private readonly USER_KEY  = 'medianet_user';

  currentUser$ = new BehaviorSubject<AuthResponse | null>(this.loadUser());

  constructor(private http: HttpClient, private router: Router) {}

  private loadUser(): AuthResponse | null {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch { return null; }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, { email, password }).pipe(
      tap(res => this.saveSession(res))
    );
  }

  register(data: { firstName: string; lastName: string; email: string; password: string; role?: string; roles?: string[] }): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/register`, data).pipe(
      tap(res => this.saveSession(res))
    );
  }

  private saveSession(res: AuthResponse): void {
    localStorage.setItem(this.TOKEN_KEY, res.token);
    localStorage.setItem(this.USER_KEY, JSON.stringify(res));
    this.currentUser$.next(res);
  }

  logout(): void {
    localStorage.removeItem(this.TOKEN_KEY);
    localStorage.removeItem(this.USER_KEY);
    this.currentUser$.next(null);
    this.router.navigate(['/']);
  }

  isLoggedIn(): boolean { return !!this.getToken(); }

  getToken(): string | null { return localStorage.getItem(this.TOKEN_KEY); }

  getCurrentUser(): AuthResponse | null { return this.currentUser$.getValue(); }

  // ── Role helpers (multi-role aware) ──────────────────────────────────────

  hasRole(role: string): boolean {
    const u = this.getCurrentUser();
    if (!u) return false;
    if (u.roles?.length) return u.roles.includes(role);
    return u.role === role; // fallback for old tokens
  }

  hasAnyRole(...roles: string[]): boolean {
    return roles.some(r => this.hasRole(r));
  }

  hasPermission(perm: string): boolean {
    const u = this.getCurrentUser();
    return u?.permissions?.includes(perm) ?? false;
  }

  isPorteur(): boolean { return this.hasRole('PORTEUR'); }
  isAdmin():   boolean { return this.hasRole('ADMIN');   }
  isJury():    boolean { return this.hasRole('JURY');    }
  isMentor():  boolean { return this.hasRole('MENTOR');  }
}
