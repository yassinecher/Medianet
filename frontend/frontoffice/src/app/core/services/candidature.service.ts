import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';
import { Candidature } from '../models/candidature.model';

export interface EvaluationRequest {
  juryEmail: string;
  juryName: string;
  innovationScore: number;
  feasibilityScore: number;
  marketImpactScore: number;
  teamQualityScore: number;
  comment: string;
}

@Injectable({ providedIn: 'root' })
export class CandidatureService {
  private readonly API = 'http://localhost:8080/api/candidatures';

  constructor(private http: HttpClient) {}

  submitCandidature(data: any): Observable<Candidature> {
    return this.http.post<Candidature>(this.API, data);
  }

  getMyCandidatures(): Observable<Candidature[]> {
    return this.http.get<Candidature[]>(`${this.API}/my`);
  }

  getMyJuryAssignments(): Observable<Candidature[]> {
    return this.http.get<Candidature[]>(`${this.API}/my-jury-assignments`);
  }

  getCandidatureById(id: number): Observable<Candidature> {
    return this.http.get<Candidature>(`${this.API}/${id}`);
  }

  evaluate(id: number, req: EvaluationRequest): Observable<Candidature> {
    return this.http.post<Candidature>(`${this.API}/${id}/evaluate`, req);
  }

  getCandidaturesBySession(sessionId: number): Observable<Candidature[]> {
    return this.http.get<Candidature[]>(`${this.API}/session/${sessionId}`);
  }
}
