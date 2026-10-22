import { HttpClient, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api/api.config';
import { DisponibilidadApiService } from '../api/disponibilidad-api.service';
import { ProfesionalesApiService } from '../api/profesionales-api.service';
import { ServiciosApiService } from '../api/servicios-api.service';
import { apiAuthInterceptor } from './api-auth.interceptor';

describe('apiAuthInterceptor', () => {
  const csrfEndpoint = `${API_BASE_URL}/api/auth/csrf`;

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

  it('sends credentials on existing services, professionals, and availability requests', () => {
    TestBed.inject(ServiciosApiService).getServicios().subscribe();
    TestBed.inject(ProfesionalesApiService).getProfesionalesPublicos().subscribe();
    TestBed.inject(DisponibilidadApiService)
      .getDisponibilidad({
        profesionalId: '00000000-0000-0000-0000-000000000001',
        desde: '2026-10-21',
        hasta: '2026-10-21',
        servicioIds: ['00000000-0000-0000-0000-000000000010'],
      })
      .subscribe();

    const http = TestBed.inject(HttpTestingController);
    const requests = http.match((request) => request.url.startsWith(`${API_BASE_URL}/api/`));

    expect(requests).toHaveLength(3);
    for (const request of requests) {
      expect(request.request.withCredentials).toBe(true);
      request.flush([]);
    }
  });

  it('adds CSRF to POST, PATCH, and DELETE after fetching a token once', () => {
    const http = TestBed.inject(HttpClient);
    const httpTesting = TestBed.inject(HttpTestingController);
    const requests = [
      () => http.post<void>(`${API_BASE_URL}/api/test`, {}),
      () => http.patch<void>(`${API_BASE_URL}/api/test`, {}),
      () => http.delete<void>(`${API_BASE_URL}/api/test`),
    ];

    for (const [index, sendRequest] of requests.entries()) {
      sendRequest().subscribe();

      if (index === 0) {
        const csrfRequest = httpTesting.expectOne(csrfEndpoint);
        expect(csrfRequest.request.method).toBe('GET');
        expect(csrfRequest.request.withCredentials).toBe(true);
        expect(csrfRequest.request.headers.has('X-CSRF-TOKEN')).toBe(false);
        csrfRequest.flush({ token: 'csrf-token' });
      }

      const request = httpTesting.expectOne(`${API_BASE_URL}/api/test`);
      expect(request.request.withCredentials).toBe(true);
      expect(request.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
      request.flush(null);
    }
  });

  it('does not add a CSRF header to the CSRF GET itself', () => {
    TestBed.inject(HttpClient).get(csrfEndpoint).subscribe();

    const request = TestBed.inject(HttpTestingController).expectOne(csrfEndpoint);
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    expect(request.request.headers.has('X-CSRF-TOKEN')).toBe(false);
    request.flush({ token: 'csrf-token' });
  });

  it('never sends credentials to an origin other than the backend', () => {
    TestBed.inject(HttpClient)
      .get('https://third-party.example/resource', { withCredentials: true })
      .subscribe();

    const request = TestBed.inject(HttpTestingController).expectOne(
      'https://third-party.example/resource',
    );
    expect(request.request.withCredentials).toBe(false);
    expect(request.request.headers.has('X-CSRF-TOKEN')).toBe(false);
    request.flush({});
    TestBed.inject(HttpTestingController).expectNone(csrfEndpoint);
  });
});
