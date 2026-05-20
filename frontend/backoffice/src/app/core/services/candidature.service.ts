import { Injectable } from '@angular/core';
import { HttpClient, HttpParams } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Candidature, CandidatureStats, EvaluationRequest } from '../models/candidature.model';

@Injectable({ providedIn: 'root' })
export class CandidatureService {
  private readonly API = 'http://localhost:8080/api/candidatures';

  constructor(private http: HttpClient) {}

  getCandidatures(status?: string, sessionId?: number): Observable<Candidature[]> {
    let params = new HttpParams();
    if (status) params = params.set('status', status);
    if (sessionId) params = params.set('sessionId', sessionId.toString());
    return this.http.get<Candidature[]>(this.API, { params });
  }

  getCandidatureById(id: number): Observable<Candidature> {
    return this.http.get<Candidature>(`${this.API}/${id}`);
  }

  assignJury(id: number, data: { juryAssignments: { juryId: number; juryEmail: string; juryName: string }[] }): Observable<any> {
    return this.http.post<any>(`${this.API}/${id}/assign-jury`, data);
  }

  evaluateCandidature(id: number, data: EvaluationRequest): Observable<any> {
    return this.http.post<any>(`${this.API}/${id}/evaluate`, data);
  }

  acceptCandidature(id: number): Observable<any> {
    return this.http.patch<any>(`${this.API}/${id}/accept`, {});
  }

  rejectCandidature(id: number, reason: string): Observable<any> {
    return this.http.patch<any>(`${this.API}/${id}/reject`, { reason });
  }

  getStats(): Observable<CandidatureStats> {
    return this.http.get<CandidatureStats>(`${this.API}/stats`);
  }
}
