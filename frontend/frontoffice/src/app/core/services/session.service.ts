import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Session } from '../models/session.model';

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
}
