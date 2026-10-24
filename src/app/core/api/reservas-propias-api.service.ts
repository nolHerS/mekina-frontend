import { HttpClient, HttpParams } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import { API_BASE_URL } from './api.config';
import { ReservasPropiasResponse } from './models/reservas-propias-response.model';

const DEFAULT_PAGE = 0;
const DEFAULT_PAGE_SIZE = 20;
const MAX_PAGE_SIZE = 50;

@Injectable({ providedIn: 'root' })
export class ReservasPropiasApiService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_BASE_URL}/api/reservas/mias`;

  getMisReservas(
    pagina = DEFAULT_PAGE,
    limite = DEFAULT_PAGE_SIZE,
  ): Observable<ReservasPropiasResponse> {
    if (!Number.isInteger(pagina) || pagina < 0) {
      throw new RangeError('La página debe ser un entero mayor o igual que cero.');
    }

    if (!Number.isInteger(limite) || limite < 1 || limite > MAX_PAGE_SIZE) {
      throw new RangeError(`El tamaño de página debe estar entre 1 y ${MAX_PAGE_SIZE}.`);
    }

    const params = new HttpParams()
      .set('pagina', pagina)
      .set('limite', limite);

    return this.http.get<ReservasPropiasResponse>(this.endpoint, { params });
  }
}
