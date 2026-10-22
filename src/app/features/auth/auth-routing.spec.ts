import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_BASE_URL } from '../../core/api/api.config';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { routes } from '../../app.routes';
import { LoginPage } from './login-page';
import { RegistrationPage } from './registration-page';

describe('Authentication routes', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  it('loads the standalone login page lazily at /login', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/login', LoginPage);

    expect(page).toBeInstanceOf(LoginPage);
    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Qué bueno',
    );
  });

  it('loads the standalone registration page lazily at /registro', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/registro', RegistrationPage);

    expect(page).toBeInstanceOf(RegistrationPage);
    expect(TestBed.inject(Router).url).toBe('/registro');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Empieza',
    );
  });

  it('keeps the login route reachable when the initial session check returns 403', async () => {
    const authApi = TestBed.inject(AuthApiService);
    authApi.me().subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/auth/me`)
      .flush(null, { status: 403, statusText: 'Forbidden' });
    expect(authApi.sessionState().status).toBe('error');

    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/registro', RegistrationPage);
    const loginLink = harness.routeNativeElement?.querySelector(
      'a[routerlink="/login"]',
    ) as HTMLAnchorElement | null;
    expect(loginLink).not.toBeNull();

    loginLink?.click();
    await harness.fixture.whenStable();
    harness.detectChanges();

    expect(TestBed.inject(Router).url).toBe('/login');
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Qué bueno',
    );
  });

  it('shows the registration welcome on reservations after passing confirmed session state', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/login', LoginPage);

    await TestBed.inject(Router).navigateByUrl('/reservar', {
      state: { registrationWelcome: true },
    });
    await harness.fixture.whenStable();
    harness.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_BASE_URL}/api/servicios`).flush([]);
    http.expectOne(`${API_BASE_URL}/api/profesionales/publicos`).flush([]);
    await harness.fixture.whenStable();
    harness.detectChanges();

    const statusMessages = Array.from(
      harness.routeNativeElement?.querySelectorAll('[role="status"]') ?? [],
    );
    expect(
      statusMessages.some((message) =>
        message.textContent?.includes('Tu sesión está confirmada'),
      ),
    ).toBe(true);
  });
});
