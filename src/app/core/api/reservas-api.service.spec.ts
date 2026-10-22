import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api.config';
import { ReservasApiService } from './reservas-api.service';
import { apiAuthInterceptor } from '../auth/api-auth.interceptor';
import { ReservaResponse } from './models/reserva-response.model';

describe('ReservasApiService', () => {
  const endpoint = `${API_BASE_URL}/api/reservas`;

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

  it('posts the typed request with credentials and CSRF and returns the 201 response', () => {
    const response: ReservaResponse = {
      id: '00000000-0000-0000-0000-000000000200',
      profesionalId: '00000000-0000-0000-0000-000000000100',
      estado: 'CONFIRMED',
      empiezaEn: '2026-10-22T10:00:00+02:00',
      terminaEn: '2026-10-22T11:00:00+02:00',
      duracionTotalMinutos: 60,
      precioTotal: 30,
    };
    let result: ReservaResponse | null | undefined;
    let status: number | undefined;

    TestBed.inject(ReservasApiService)
      .createReserva({
        profesionalId: response.profesionalId,
        servicioIds: [
          '00000000-0000-0000-0000-000000000010',
          '00000000-0000-0000-0000-000000000011',
        ],
        empiezaEn: '2026-10-22T10:00:00+02:00',
        aceptaCondiciones: true,
      })
      .subscribe((httpResponse) => {
        result = httpResponse.body;
        status = httpResponse.status;
      });

    const http = TestBed.inject(HttpTestingController);
    const csrfRequest = http.expectOne(`${API_BASE_URL}/api/auth/csrf`);
    expect(csrfRequest.request.method).toBe('GET');
    expect(csrfRequest.request.withCredentials).toBe(true);
    csrfRequest.flush({ token: 'csrf-token' });

    const request = http.expectOne(endpoint);
    expect(request.request.method).toBe('POST');
    expect(request.request.body).toEqual({
      profesionalId: response.profesionalId,
      servicioIds: [
        '00000000-0000-0000-0000-000000000010',
        '00000000-0000-0000-0000-000000000011',
      ],
      empiezaEn: '2026-10-22T10:00:00+02:00',
      aceptaCondiciones: true,
    });
    expect(request.request.body.precioTotal).toBeUndefined();
    expect(request.request.body.duracionTotalMinutos).toBeUndefined();
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    request.flush(response, { status: 201, statusText: 'Created' });

    expect(status).toBe(201);
    expect(result).toEqual(response);
  });

  it('propagates an HTTP conflict without retrying the reservation POST', () => {
    let receivedStatus: number | undefined;
    TestBed.inject(ReservasApiService)
      .createReserva({
        profesionalId: '00000000-0000-0000-0000-000000000100',
        servicioIds: ['00000000-0000-0000-0000-000000000010'],
        empiezaEn: '2026-10-22T10:00:00+02:00',
        aceptaCondiciones: true,
      })
      .subscribe({
        error: (error: { status: number }) => (receivedStatus = error.status),
      });

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_BASE_URL}/api/auth/csrf`).flush({ token: 'csrf-token' });
    const request = http.expectOne(endpoint);
    request.flush(
      { error: 'La reserva ya no está disponible' },
      { status: 409, statusText: 'Conflict' },
    );

    expect(receivedStatus).toBe(409);
    http.expectNone(endpoint);
  });
});
