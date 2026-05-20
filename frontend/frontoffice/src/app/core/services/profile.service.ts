import { Injectable } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable } from 'rxjs';

export interface UpdateProfileRequest {
  firstName: string;
  lastName: string;
  currentPassword?: string;
  newPassword?: string;
}

@Injectable({ providedIn: 'root' })
export class ProfileService {
  private readonly API = 'http://localhost:8080/api/auth';
  constructor(private http: HttpClient) {}
  updateProfile(req: UpdateProfileRequest): Observable<any> {
    return this.http.put(`${this.API}/profile`, req);
  }
}
