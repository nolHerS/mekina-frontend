import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api.config';
import { ServicioResponse } from './models/servicio-response.model';
import { ServiciosApiService } from './servicios-api.service';

describe('ServiciosApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('requests the public service catalog and returns the response', () => {
    const expected: ServicioResponse[] = [
      {
        id: '00000000-0000-0000-0000-000000000010',
        nombre: 'Corte',
        descripcion: null,
        precio: 18.5,
        duracionMinutos: 30,
        activo: true,
        creadoEn: '2026-10-20T10:00:00+02:00',
        actualizadoEn: '2026-10-20T10:00:00+02:00',
      },
    ];
    let response: ServicioResponse[] | undefined;

    TestBed.inject(ServiciosApiService)
      .getServicios()
      .subscribe((services) => (response = services));

    const request = TestBed.inject(HttpTestingController).expectOne(
      `${API_BASE_URL}/api/servicios`,
    );
    expect(request.request.method).toBe('GET');

    request.flush(expected);

    expect(response).toEqual(expected);
  });

  it('propagates an HTTP error from the service catalog', () => {
    let responseError: HttpErrorResponse | undefined;

    TestBed.inject(ServiciosApiService)
      .getServicios()
      .subscribe({
        error: (error: HttpErrorResponse) => (responseError = error),
      });

    const request = TestBed.inject(HttpTestingController).expectOne(
      `${API_BASE_URL}/api/servicios`,
    );
    request.flush(
      { error: 'Unavailable' },
      { status: 503, statusText: 'Service Unavailable' },
    );

    expect(responseError?.status).toBe(503);
  });
});
