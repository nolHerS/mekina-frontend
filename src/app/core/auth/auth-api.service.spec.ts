import { HttpErrorResponse, provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../api/api.config';
import { apiAuthInterceptor } from './api-auth.interceptor';
import { AuthApiService } from './auth-api.service';
import { AuthResponse } from './models/auth-response.model';
import { IdentidadResponse } from './models/identidad-response.model';

describe('AuthApiService', () => {
  const authEndpoint = `${API_BASE_URL}/api/auth`;
  const csrfEndpoint = `${authEndpoint}/csrf`;
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

  it('sends the exact login body and defaults recordarme to false', () => {
    let response: AuthResponse | undefined;
    TestBed.inject(AuthApiService)
      .login({
        correoElectronico: 'cliente@example.test',
        contrasena: 'clave-segura',
      })
      .subscribe((result) => (response = result));

    const http = TestBed.inject(HttpTestingController);
    const csrfRequest = http.expectOne(csrfEndpoint);
    expect(csrfRequest.request.withCredentials).toBe(true);
    csrfRequest.flush({ token: 'csrf-token' });

    const loginRequest = http.expectOne(`${authEndpoint}/login`);
    expect(loginRequest.request.method).toBe('POST');
    expect(loginRequest.request.body).toEqual({
      correoElectronico: 'cliente@example.test',
      contrasena: 'clave-segura',
      recordarme: false,
    });
    expect(loginRequest.request.withCredentials).toBe(true);
    expect(loginRequest.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    loginRequest.flush(authResponse);

    expect(response).toEqual(authResponse);
    expect(TestBed.inject(AuthApiService).sessionState()).toEqual({ status: 'loading' });
  });

  it('sends registration fields without adding optional fields and returns the response', () => {
    let response: AuthResponse | undefined;
    TestBed.inject(AuthApiService)
      .register({
        nombre: 'Cliente nuevo',
        correoElectronico: 'nuevo@example.test',
        telefono: '600000000',
        contrasena: 'clave-segura',
      })
      .subscribe((result) => (response = result));

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(csrfEndpoint).flush({ token: 'csrf-token' });

    const registrationRequest = http.expectOne(`${authEndpoint}/registro`);
    expect(registrationRequest.request.method).toBe('POST');
    expect(registrationRequest.request.body).toEqual({
      nombre: 'Cliente nuevo',
      correoElectronico: 'nuevo@example.test',
      telefono: '600000000',
      contrasena: 'clave-segura',
    });
    expect(registrationRequest.request.withCredentials).toBe(true);
    expect(registrationRequest.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    registrationRequest.flush(authResponse, { status: 201, statusText: 'Created' });

    expect(response).toEqual(authResponse);
  });

  it('invalidates the CSRF token after successful login', () => {
    const service = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);

    service
      .login({
        correoElectronico: 'cliente@example.test',
        contrasena: 'clave-segura',
      })
      .subscribe();
    http.expectOne(csrfEndpoint).flush({ token: 'first-token' });
    http.expectOne(`${authEndpoint}/login`).flush(authResponse);

    service.logout().subscribe();

    const refreshedCsrfRequest = http.expectOne(csrfEndpoint);
    refreshedCsrfRequest.flush({ token: 'second-token' });
    const logoutRequest = http.expectOne(`${authEndpoint}/logout`);
    expect(logoutRequest.request.headers.get('X-CSRF-TOKEN')).toBe('second-token');
    logoutRequest.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('invalidates the CSRF token after successful registration', () => {
    const service = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);

    service
      .register({
        nombre: 'Cliente nuevo',
        correoElectronico: 'nuevo@example.test',
        contrasena: 'clave-segura',
      })
      .subscribe();
    http.expectOne(csrfEndpoint).flush({ token: 'first-token' });
    http.expectOne(`${authEndpoint}/registro`).flush(authResponse, {
      status: 201,
      statusText: 'Created',
    });

    service.logout().subscribe();

    const refreshedCsrfRequest = http.expectOne(csrfEndpoint);
    refreshedCsrfRequest.flush({ token: 'second-token' });
    const logoutRequest = http.expectOne(`${authEndpoint}/logout`);
    expect(logoutRequest.request.headers.get('X-CSRF-TOKEN')).toBe('second-token');
    logoutRequest.flush(null, { status: 204, statusText: 'No Content' });
  });

  it('uses /me as the source of truth for an authenticated session', () => {
    let response: IdentidadResponse | null | undefined;
    const service = TestBed.inject(AuthApiService);

    service.me().subscribe((result) => (response = result));

    const request = TestBed.inject(HttpTestingController).expectOne(
      `${authEndpoint}/me`,
    );
    expect(request.request.method).toBe('GET');
    expect(request.request.withCredentials).toBe(true);
    request.flush(identity);

    expect(response).toEqual(identity);
    expect(service.sessionState()).toEqual({
      status: 'authenticated',
      identity,
    });
  });

  it('updates the current profile with the documented fields and refreshes shared identity', () => {
    const service = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);
    service.me().subscribe();
    http.expectOne(`${authEndpoint}/me`).flush(identity);

    const updatedIdentity = { ...identity, telefono: '611111111' };
    service
      .updateProfile({ nombre: identity.nombre, telefono: '611111111' })
      .subscribe();

    const csrfRequest = http.expectOne(csrfEndpoint);
    expect(csrfRequest.request.method).toBe('GET');
    csrfRequest.flush({ token: 'csrf-token' });

    const profileRequest = http.expectOne(`${authEndpoint}/me`);
    expect(profileRequest.request.method).toBe('PATCH');
    expect(profileRequest.request.body).toEqual({
      nombre: identity.nombre,
      telefono: '611111111',
    });
    expect(profileRequest.request.withCredentials).toBe(true);
    expect(profileRequest.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    profileRequest.flush(updatedIdentity);

    expect(service.sessionState()).toEqual({
      status: 'authenticated',
      identity: updatedIdentity,
    });
  });

  it('shares a pending /me request between concurrent callers', () => {
    const service = TestBed.inject(AuthApiService);
    const results: Array<IdentidadResponse | null> = [];
    service.me().subscribe((result) => results.push(result));
    service.me().subscribe((result) => results.push(result));

    TestBed.inject(HttpTestingController)
      .expectOne(`${authEndpoint}/me`)
      .flush(identity);

    expect(results).toEqual([identity, identity]);
    expect(service.sessionState()).toEqual({
      status: 'authenticated',
      identity,
    });
  });

  it('ignores an older /me response that arrives after login confirmation', () => {
    const service = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);
    const staleIdentity = { ...identity, nombre: 'Identidad antigua' };
    service.me().subscribe();
    const initialMeRequest = http.expectOne(`${authEndpoint}/me`);

    service
      .login({
        correoElectronico: 'cliente@example.test',
        contrasena: 'clave-segura',
      })
      .subscribe();
    http.expectOne(csrfEndpoint).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/login`).flush(authResponse);

    service.me().subscribe();
    http.expectOne(`${authEndpoint}/me`).flush(identity);
    expect(service.sessionState()).toEqual({
      status: 'authenticated',
      identity,
    });

    initialMeRequest.flush(staleIdentity);
    expect(service.sessionState()).toEqual({
      status: 'authenticated',
      identity,
    });
  });

  it('does not restore an identity from /me after a successful logout', () => {
    const service = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);
    service.me().subscribe();
    const olderMeRequest = http.expectOne(`${authEndpoint}/me`);

    service.logout().subscribe();
    http.expectOne(csrfEndpoint).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/logout`).flush(null, {
      status: 204,
      statusText: 'No Content',
    });
    expect(service.sessionState()).toEqual({ status: 'anonymous' });

    olderMeRequest.flush(identity);
    expect(service.sessionState()).toEqual({ status: 'anonymous' });
  });

  it('treats a 401 from /me as an anonymous session', () => {
    let response: IdentidadResponse | null | undefined;
    const service = TestBed.inject(AuthApiService);

    service.me().subscribe((result) => (response = result));
    TestBed.inject(HttpTestingController)
      .expectOne(`${authEndpoint}/me`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(response).toBeNull();
    expect(service.sessionState()).toEqual({ status: 'anonymous' });
  });

  it('preserves a 403 from /me as a session-check error, not anonymous', () => {
    const service = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);
    let receivedError: HttpErrorResponse | undefined;

    service.me().subscribe({
      error: (error: HttpErrorResponse) => (receivedError = error),
    });
    http.expectOne(`${authEndpoint}/me`).flush(
      { message: 'Acceso denegado' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(receivedError?.status).toBe(403);
    expect(service.sessionState()).toEqual({
      status: 'error',
      error: receivedError,
    });
  });

  it('preserves 401, 403, 409, and 429 backend errors and Retry-After', () => {
    const service = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);
    const receivedErrors: HttpErrorResponse[] = [];
    const loginRequest = {
      correoElectronico: 'cliente@example.test',
      contrasena: 'clave-incorrecta',
    };

    service.login(loginRequest).subscribe({
      error: (error: HttpErrorResponse) => receivedErrors.push(error),
    });
    http.expectOne(csrfEndpoint).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/login`).flush(
      { error: 'Credenciales no válidas' },
      { status: 401, statusText: 'Unauthorized' },
    );

    service.login(loginRequest).subscribe({
      error: (error: HttpErrorResponse) => receivedErrors.push(error),
    });
    http.expectOne(`${authEndpoint}/login`).flush(
      { error: 'CSRF inválido' },
      { status: 403, statusText: 'Forbidden' },
    );

    service
      .register({
        nombre: 'Cliente existente',
        correoElectronico: 'cliente@example.test',
        contrasena: 'clave-segura',
      })
      .subscribe({
        error: (error: HttpErrorResponse) => receivedErrors.push(error),
      });
    http.expectOne(`${authEndpoint}/registro`).flush(
      { error: 'No se puede completar el registro' },
      { status: 409, statusText: 'Conflict' },
    );

    service.login(loginRequest).subscribe({
      error: (error: HttpErrorResponse) => receivedErrors.push(error),
    });
    const limitedRequest = http.expectOne(`${authEndpoint}/login`);
    limitedRequest.flush(
      { error: 'Demasiadas solicitudes' },
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '30' },
      },
    );

    expect(receivedErrors.map((error) => error.status)).toEqual([401, 403, 409, 429]);
    expect(receivedErrors[1].error).toEqual({ error: 'CSRF inválido' });
    expect(receivedErrors[2].error).toEqual({
      error: 'No se puede completar el registro',
    });
    expect(receivedErrors[3].headers.get('Retry-After')).toBe('30');
  });

  it('does not mark the session anonymous when logout fails', () => {
    const service = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);
    service.me().subscribe();
    http.expectOne(`${authEndpoint}/me`).flush(identity);

    let logoutError: HttpErrorResponse | undefined;
    service.logout().subscribe({
      error: (error: HttpErrorResponse) => (logoutError = error),
    });
    http.expectOne(csrfEndpoint).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/logout`).flush(
      { error: 'CSRF inválido' },
      { status: 403, statusText: 'Forbidden' },
    );

    expect(logoutError?.status).toBe(403);
    expect(service.sessionState()).toEqual({
      status: 'authenticated',
      identity,
    });
  });

  it('marks the session anonymous after a successful logout', () => {
    const service = TestBed.inject(AuthApiService);
    const http = TestBed.inject(HttpTestingController);
    service.me().subscribe();
    http.expectOne(`${authEndpoint}/me`).flush(identity);

    service.logout().subscribe();
    const csrfRequest = http.expectOne(csrfEndpoint);
    expect(csrfRequest.request.method).toBe('GET');
    expect(csrfRequest.request.withCredentials).toBe(true);
    csrfRequest.flush({ token: 'csrf-token' });
    const logoutRequest = http.expectOne(`${authEndpoint}/logout`);
    expect(logoutRequest.request.method).toBe('POST');
    expect(logoutRequest.request.withCredentials).toBe(true);
    expect(logoutRequest.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    logoutRequest.flush(null, {
      status: 204,
      statusText: 'No Content',
    });

    expect(service.sessionState()).toEqual({ status: 'anonymous' });
  });
});
