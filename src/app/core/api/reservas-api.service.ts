import { HttpClient, HttpResponse } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { CrearReservaRequest } from './models/crear-reserva-request.model';
import { ReservaResponse } from './models/reserva-response.model';

@Injectable({ providedIn: 'root' })
export class ReservasApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_BASE_URL}/api/reservas`;

  createReserva(
    request: CrearReservaRequest,
  ): Observable<HttpResponse<ReservaResponse>> {
    return this.http.post<ReservaResponse>(this.endpoint, request, {
      observe: 'response',
    });
  }
}
