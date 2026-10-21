import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { DisponibilidadQuery } from './models/disponibilidad-query.model';
import { DisponibilidadResponse } from './models/disponibilidad-response.model';

const MAX_SERVICIOS = 10;

@Injectable({ providedIn: 'root' })
export class DisponibilidadApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_BASE_URL}/api/disponibilidad`;

  getDisponibilidad(
    query: DisponibilidadQuery,
  ): Observable<DisponibilidadResponse> {
    const { profesionalId, desde, hasta, servicioIds } = query;

    if (servicioIds.length === 0) {
      throw new RangeError('Se requiere al menos un servicio.');
    }

    if (servicioIds.length > MAX_SERVICIOS) {
      throw new RangeError(`No se permiten más de ${MAX_SERVICIOS} servicios.`);
    }

    if (new Set(servicioIds).size !== servicioIds.length) {
      throw new RangeError('No se permiten identificadores de servicio duplicados.');
    }

    let params = new HttpParams()
      .set('profesionalId', profesionalId)
      .set('desde', desde)
      .set('hasta', hasta);

    for (const servicioId of servicioIds) {
      params = params.append('servicioId', servicioId);
    }

    return this.http.get<DisponibilidadResponse>(this.endpoint, { params });
  }
}
