import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { BehaviorSubject, Observable, tap, switchMap, throwError } from 'rxjs';
import { Router } from '@angular/router';
import { AuthResponse } from '../models/user.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly API = 'http://localhost:8080/api/auth';
  private readonly TOKEN_KEY = 'medianet_admin_token';
  private readonly USER_KEY = 'medianet_admin_user';

  currentUser$ = new BehaviorSubject<AuthResponse | null>(this.loadUser());

  constructor(private http: HttpClient, private router: Router) {}

  private loadUser(): AuthResponse | null {
    try {
      const data = localStorage.getItem(this.USER_KEY);
      return data ? JSON.parse(data) : null;
    } catch {
      return null;
    }
  }

  login(email: string, password: string): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.API}/login`, { email, password }).pipe(
      switchMap(res => {
        const isAdmin = res.roles?.includes('ADMIN') || res.role === 'ADMIN';
        if (!isAdmin) {
          return throwError(() => ({ error: { error: 'Accès refusé. Rôle administrateur requis.' } }));
        }
        this.saveSession(res);
        return [res];
      })
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
    this.router.navigate(['/login']);
  }

  isLoggedIn(): boolean {
    return !!this.getToken();
  }

  getToken(): string | null {
    return localStorage.getItem(this.TOKEN_KEY);
  }

  getCurrentUser(): AuthResponse | null {
    return this.currentUser$.getValue();
  }

  isAdmin(): boolean {
    const u = this.getCurrentUser();
    return u?.roles?.includes('ADMIN') || u?.role === 'ADMIN' || false;
  }

  hasRole(role: string): boolean {
    const u = this.getCurrentUser();
    if (!u) return false;
    return u.roles?.includes(role) || u.role === role;
  }
}
