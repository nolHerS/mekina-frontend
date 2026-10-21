import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { ServicioResponse } from './models/servicio-response.model';

@Injectable({ providedIn: 'root' })
export class ServiciosApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_BASE_URL}/api/servicios`;

  getServicios(): Observable<ServicioResponse[]> {
    return this.http.get<ServicioResponse[]>(this.endpoint);
  }
}
