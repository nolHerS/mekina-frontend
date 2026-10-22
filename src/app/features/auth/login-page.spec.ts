import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api.config';
import { apiAuthInterceptor } from '../../core/auth/api-auth.interceptor';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { AuthResponse } from '../../core/auth/models/auth-response.model';
import { IdentidadResponse } from '../../core/auth/models/identidad-response.model';
import { LoginPage } from './login-page';
import { vi } from 'vitest';

describe('LoginPage', () => {
  const authEndpoint = `${API_BASE_URL}/api/auth`;
  const authResponse: AuthResponse = {
    id: '00000000-0000-0000-0000-000000000001',
    nombre: 'Cliente',
    correoElectronico: 'cliente@example.test',
    roles: ['CUSTOMER'],
  };
  const identity: IdentidadResponse = {
    ...authResponse,
    telefono: null,
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [LoginPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiAuthInterceptor])),
        provideHttpClientTesting(),
      ],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  function createPage(): ComponentFixture<LoginPage> {
    const fixture = TestBed.createComponent(LoginPage);
    fixture.detectChanges();
    return fixture;
  }

  function fillForm(fixture: ComponentFixture<LoginPage>): void {
    const email = fixture.nativeElement.querySelector(
      '#login-email',
    ) as HTMLInputElement;
    email.value = 'cliente@example.test';
    email.dispatchEvent(new Event('input', { bubbles: true }));

    const password = fixture.nativeElement.querySelector(
      '#login-password',
    ) as HTMLInputElement;
    password.value = 'clave-segura';
    password.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function submitForm(fixture: ComponentFixture<LoginPage>): void {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('renders labeled controls, defaults Recordarme to false, and links to registration', () => {
    const fixture = createPage();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Qué bueno');
    expect(root.querySelector('label[for="login-email"]')?.textContent).toContain(
      'Correo electrónico',
    );
    expect(root.querySelector('label[for="login-password"]')?.textContent).toContain(
      'Contraseña',
    );
    expect(
      (root.querySelector('#login-remember') as HTMLInputElement).checked,
    ).toBe(false);
    expect(root.querySelector('a[routerlink="/registro"]')).toBeTruthy();
  });

  it('shows field validation and does not submit invalid values', () => {
    const fixture = createPage();
    submitForm(fixture);

    expect(fixture.nativeElement.querySelector('#login-email-error')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#login-password-error')).toBeTruthy();
    expect(
      (fixture.nativeElement.querySelector('#login-email') as HTMLInputElement).getAttribute(
        'aria-invalid',
      ),
    ).toBe('true');
    TestBed.inject(HttpTestingController).expectNone(
      `${authEndpoint}/csrf`,
    );
  });

  it('submits the login, confirms the session, and navigates to reservations', async () => {
    const fixture = createPage();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fillForm(fixture);

    const remember = fixture.nativeElement.querySelector(
      '#login-remember',
    ) as HTMLInputElement;
    expect(remember.checked).toBe(false);
    submitForm(fixture);

    const http = TestBed.inject(HttpTestingController);
    const csrfRequest = http.expectOne(`${authEndpoint}/csrf`);
    csrfRequest.flush({ token: 'csrf-token' });

    const submitButton = fixture.nativeElement.querySelector(
      '.auth-submit',
    ) as HTMLButtonElement;
    expect(submitButton.disabled).toBe(true);
    const loginRequest = http.expectOne(`${authEndpoint}/login`);
    expect(loginRequest.request.body).toEqual({
      correoElectronico: 'cliente@example.test',
      contrasena: 'clave-segura',
      recordarme: false,
    });
    expect(loginRequest.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    expect(loginRequest.request.withCredentials).toBe(true);
    loginRequest.flush(authResponse);

    const meRequest = http.expectOne(`${authEndpoint}/me`);
    expect(meRequest.request.withCredentials).toBe(true);
    meRequest.flush(identity);

    await fixture.whenStable();
    fixture.detectChanges();
    expect(navigateSpy).toHaveBeenCalledWith('/reservar');
    expect(submitButton.disabled).toBe(false);
  });

  it('recovers from an initial /me 403 and confirms identity after login', async () => {
    const fixture = createPage();
    const authApi = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);
    authApi.me().subscribe({ error: () => undefined });
    http.expectOne(`${authEndpoint}/me`).flush(
      null,
      { status: 403, statusText: 'Forbidden' },
    );
    expect(authApi.sessionState().status).toBe('error');

    const navigateSpy = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    fillForm(fixture);
    submitForm(fixture);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/login`).flush(authResponse);
    http.expectOne(`${authEndpoint}/me`).flush(identity);

    await fixture.whenStable();
    fixture.detectChanges();
    expect(authApi.sessionState()).toEqual({
      status: 'authenticated',
      identity,
    });
    expect(navigateSpy).toHaveBeenCalledWith('/reservar');
  });

  it('shows useful HTTP errors without assuming a uniform response body', () => {
    const fixture = createPage();
    fillForm(fixture);
    submitForm(fixture);

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/login`).flush(
      { error: 'Credenciales no válidas' },
      { status: 401, statusText: 'Unauthorized' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'Credenciales no válidas',
    );
    expect(TestBed.inject(Router).url).toBe('/');
  });
});
