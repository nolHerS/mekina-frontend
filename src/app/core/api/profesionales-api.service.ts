import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { ProfesionalPublicoResponse } from './models/profesional-publico-response.model';

@Injectable({ providedIn: 'root' })
export class ProfesionalesApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_BASE_URL}/api/profesionales/publicos`;

  getProfesionalesPublicos(): Observable<ProfesionalPublicoResponse[]> {
    return this.http.get<ProfesionalPublicoResponse[]>(this.endpoint);
  }
}
