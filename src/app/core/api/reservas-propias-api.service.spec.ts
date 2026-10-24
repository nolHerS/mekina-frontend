import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { HttpErrorResponse } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api.config';
import { ReservasPropiasApiService } from './reservas-propias-api.service';
import { ReservasPropiasResponse } from './models/reservas-propias-response.model';
import { apiAuthInterceptor } from '../auth/api-auth.interceptor';

describe('ReservasPropiasApiService', () => {
  const endpoint = `${API_BASE_URL}/api/reservas/mias`;

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideHttpClient(withInterceptors([apiAuthInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('requests the documented endpoint with default pagination and credentials', () => {
    TestBed.inject(ReservasPropiasApiService).getMisReservas().subscribe();

    const request = TestBed.inject(HttpTestingController).expectOne(
      (candidate) => candidate.url === endpoint,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('pagina')).toBe('0');
    expect(request.request.params.get('limite')).toBe('20');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('X-CSRF-TOKEN')).toBe(false);
    request.flush({
      reservas: [],
      pagina: 0,
      limite: 20,
      total: 0,
    } satisfies ReservasPropiasResponse);
  });

  it('sends explicit pagination parameters and returns the typed response', () => {
    const expected: ReservasPropiasResponse = {
      reservas: [
        {
          id: '00000000-0000-0000-0000-000000000200',
          empiezaEn: '2026-10-20T10:00:00+02:00',
          terminaEn: '2026-10-20T11:00:00+02:00',
          zonaHoraria: 'Europe/Madrid',
          estado: 'CONFIRMED',
          precioTotal: 30,
          duracionTotalMinutos: 60,
          servicios: [
            { nombre: 'Corte', precio: 18.5, duracionMinutos: 30 },
          ],
        },
      ],
      pagina: 2,
      limite: 5,
      total: 11,
    };
    let actual: ReservasPropiasResponse | undefined;

    TestBed.inject(ReservasPropiasApiService)
      .getMisReservas(2, 5)
      .subscribe((response) => (actual = response));
    const request = TestBed.inject(HttpTestingController).expectOne(
      (candidate) => candidate.url === endpoint,
    );

    expect(request.request.params.get('pagina')).toBe('2');
    expect(request.request.params.get('limite')).toBe('5');
    request.flush(expected);
    expect(actual).toEqual(expected);
  });

  it('propagates HTTP errors', () => {
    let responseError: HttpErrorResponse | undefined;
    TestBed.inject(ReservasPropiasApiService)
      .getMisReservas()
      .subscribe({ error: (error: HttpErrorResponse) => (responseError = error) });

    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === endpoint)
      .flush({ error: 'Unavailable' }, { status: 503, statusText: 'Unavailable' });

    expect(responseError?.status).toBe(503);
  });

  it('rejects invalid page and page-size values before making a request', () => {
    const service = TestBed.inject(ReservasPropiasApiService);

    expect(() => service.getMisReservas(-1)).toThrowError(RangeError);
    expect(() => service.getMisReservas(0, 0)).toThrowError(RangeError);
    expect(() => service.getMisReservas(0, 51)).toThrowError(RangeError);
    expect(() => service.getMisReservas(1.5)).toThrowError(RangeError);
    TestBed.inject(HttpTestingController).expectNone(endpoint);
  });
});
