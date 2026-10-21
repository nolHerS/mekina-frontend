import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api.config';
import { DisponibilidadApiService } from './disponibilidad-api.service';
import { DisponibilidadQuery } from './models/disponibilidad-query.model';
import { DisponibilidadResponse } from './models/disponibilidad-response.model';

describe('DisponibilidadApiService', () => {
  const query: DisponibilidadQuery = {
    profesionalId: '00000000-0000-0000-0000-000000000001',
    desde: '2026-10-20',
    hasta: '2026-10-22',
    servicioIds: ['00000000-0000-0000-0000-000000000010'],
  };

  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('requests the documented endpoint with the required query parameters', () => {
    TestBed.inject(DisponibilidadApiService).getDisponibilidad(query).subscribe();

    const request = TestBed.inject(HttpTestingController).expectOne(
      `${API_BASE_URL}/api/disponibilidad?profesionalId=${query.profesionalId}&desde=${query.desde}&hasta=${query.hasta}&servicioId=${query.servicioIds[0]}`,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('profesionalId')).toBe(query.profesionalId);
    expect(request.request.params.get('desde')).toBe(query.desde);
    expect(request.request.params.get('hasta')).toBe(query.hasta);
    expect(request.request.params.getAll('servicioId')).toEqual(query.servicioIds);
    request.flush({
      profesionalId: query.profesionalId,
      zonaHoraria: 'Europe/Madrid',
      duracionTotalMinutos: 30,
      desde: query.desde,
      hasta: query.hasta,
      dias: [],
    } satisfies DisponibilidadResponse);
  });

  it('sends multiple servicioId parameters instead of joining them', () => {
    const serviceIds = [
      '00000000-0000-0000-0000-000000000010',
      '00000000-0000-0000-0000-000000000011',
    ];

    TestBed.inject(DisponibilidadApiService)
      .getDisponibilidad({ ...query, servicioIds: serviceIds })
      .subscribe();

    const request = TestBed.inject(HttpTestingController).expectOne(
      (candidate) => candidate.url === `${API_BASE_URL}/api/disponibilidad`,
    );

    expect(request.request.params.getAll('servicioId')).toEqual(serviceIds);
    expect(request.request.params.get('servicioId')).not.toContain(',');
    request.flush({
      profesionalId: query.profesionalId,
      zonaHoraria: 'Europe/Madrid',
      duracionTotalMinutos: 60,
      desde: query.desde,
      hasta: query.hasta,
      dias: [],
    } satisfies DisponibilidadResponse);
  });

  it('returns the typed availability response', () => {
    const expected: DisponibilidadResponse = {
      profesionalId: query.profesionalId,
      zonaHoraria: 'Europe/Madrid',
      duracionTotalMinutos: 30,
      desde: query.desde,
      hasta: query.hasta,
      dias: [
        {
          fecha: query.desde,
          inicios: ['2026-10-20T10:00:00+02:00'],
        },
      ],
    };
    let response: DisponibilidadResponse | undefined;

    TestBed.inject(DisponibilidadApiService)
      .getDisponibilidad(query)
      .subscribe((availability) => (response = availability));

    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === `${API_BASE_URL}/api/disponibilidad`)
      .flush(expected);

    expect(response).toEqual(expected);
    expect(response?.dias[0].inicios[0]).toBe('2026-10-20T10:00:00+02:00');
  });

  it('propagates an HTTP error', () => {
    let responseError: HttpErrorResponse | undefined;

    TestBed.inject(DisponibilidadApiService)
      .getDisponibilidad(query)
      .subscribe({
        error: (error: HttpErrorResponse) => (responseError = error),
      });

    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === `${API_BASE_URL}/api/disponibilidad`)
      .flush(
        { error: 'Unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(responseError?.status).toBe(503);
  });

  it('rejects missing, duplicate, or more than ten service identifiers', () => {
    const service = TestBed.inject(DisponibilidadApiService);

    expect(() =>
      service.getDisponibilidad({ ...query, servicioIds: [] }),
    ).toThrowError(RangeError);
    expect(() =>
      service.getDisponibilidad({
        ...query,
        servicioIds: [query.servicioIds[0], query.servicioIds[0]],
      }),
    ).toThrowError(RangeError);
    expect(() =>
      service.getDisponibilidad({
        ...query,
        servicioIds: Array.from({ length: 11 }, (_, index) => `${index}`),
      }),
    ).toThrowError(RangeError);
  });
});
