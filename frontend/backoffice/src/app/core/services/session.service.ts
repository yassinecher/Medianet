import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Session, SessionStats, CreateSessionRequest, UpdateSessionRequest } from '../models/session.model';

@Injectable({ providedIn: 'root' })
export class SessionService {
  private readonly API = 'http://localhost:8080/api/sessions';

  constructor(private http: HttpClient) {}

  getSessions(status?: string): Observable<Session[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    return this.http.get<Session[]>(this.API, { params });
  }

  getSession(id: number): Observable<Session> {
    return this.http.get<Session>(`${this.API}/${id}`);
  }

  createSession(data: CreateSessionRequest): Observable<Session> {
    return this.http.post<Session>(this.API, data);
  }

  updateSession(id: number, data: UpdateSessionRequest): Observable<Session> {
    return this.http.put<Session>(`${this.API}/${id}`, data);
  }

  changeStatus(id: number, status: string): Observable<Session> {
    return this.http.patch<Session>(`${this.API}/${id}/status`, { status });
  }

  getStats(): Observable<SessionStats> {
    return this.http.get<SessionStats>(`${this.API}/stats`);
  }
}
