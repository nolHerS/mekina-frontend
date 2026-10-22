import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api/api.config';
import { apiAuthInterceptor } from './api-auth.interceptor';
import { CsrfTokenService } from './csrf-token.service';

describe('CsrfTokenService', () => {
  const endpoint = `${API_BASE_URL}/api/auth/csrf`;

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

  it('loads and caches the CSRF token in memory', () => {
    const service = TestBed.inject(CsrfTokenService);
    let firstToken: string | undefined;
    let cachedToken: string | undefined;

    service.getToken().subscribe((token) => (firstToken = token));
    const request = TestBed.inject(HttpTestingController).expectOne(endpoint);

    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush({ token: 'csrf-token' });

    service.getToken().subscribe((token) => (cachedToken = token));

    expect(firstToken).toBe('csrf-token');
    expect(cachedToken).toBe('csrf-token');
    TestBed.inject(HttpTestingController).expectNone(endpoint);
  });

  it('shares one in-flight request between concurrent callers', () => {
    const service = TestBed.inject(CsrfTokenService);
    const tokens: string[] = [];

    service.getToken().subscribe((token) => tokens.push(token));
    service.getToken().subscribe((token) => tokens.push(token));

    const request = TestBed.inject(HttpTestingController).expectOne(endpoint);
    request.flush({ token: 'shared-csrf-token' });

    expect(tokens).toEqual(['shared-csrf-token', 'shared-csrf-token']);
  });

  it('fetches a new token after invalidation', () => {
    const service = TestBed.inject(CsrfTokenService);
    service.getToken().subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne(endpoint)
      .flush({ token: 'first-token' });

    service.invalidate();
    service.getToken().subscribe();

    const refreshedRequest = TestBed.inject(HttpTestingController).expectOne(endpoint);
    expect(refreshedRequest.request.method).toBe('GET');
    refreshedRequest.flush({ token: 'second-token' });
  });

  it('renews the token explicitly and shares concurrent refresh requests', () => {
    const service = TestBed.inject(CsrfTokenService);
    service.getToken().subscribe();
    TestBed.inject(HttpTestingController)
      .expectOne(endpoint)
      .flush({ token: 'first-token' });

    const received: string[] = [];
    service.refreshToken().subscribe((token) => received.push(token));
    service.refreshToken().subscribe((token) => received.push(token));

    const refreshedRequest = TestBed.inject(HttpTestingController).expectOne(endpoint);
    refreshedRequest.flush({ token: 'renewed-token' });

    expect(received).toEqual(['renewed-token', 'renewed-token']);
    service.getToken().subscribe((token) => received.push(token));
    expect(received[2]).toBe('renewed-token');
    TestBed.inject(HttpTestingController).expectNone(endpoint);
  });

  it('does not let a late response overwrite a more recent token', () => {
    const service = TestBed.inject(CsrfTokenService);
    let originalToken: string | undefined;
    let renewedToken: string | undefined;
    service.getToken().subscribe((token) => (originalToken = token));
    const originalRequest = TestBed.inject(HttpTestingController).expectOne(endpoint);

    service.refreshToken().subscribe((token) => (renewedToken = token));
    const refreshedRequest = TestBed.inject(HttpTestingController).expectOne(endpoint);
    refreshedRequest.flush({ token: 'new-token' });
    originalRequest.flush({ token: 'late-old-token' });

    service.getToken().subscribe((token) => (renewedToken = token));
    expect(originalToken).toBe('late-old-token');
    expect(renewedToken).toBe('new-token');
    TestBed.inject(HttpTestingController).expectNone(endpoint);
  });
});
