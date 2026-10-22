import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { Location } from '@angular/common';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api.config';
import { apiAuthInterceptor } from '../../core/auth/api-auth.interceptor';
import { AuthResponse } from '../../core/auth/models/auth-response.model';
import { IdentidadResponse } from '../../core/auth/models/identidad-response.model';
import { RegistrationPage } from './registration-page';
import { vi } from 'vitest';

describe('RegistrationPage', () => {
  const authEndpoint = `${API_BASE_URL}/api/auth`;
  const authResponse: AuthResponse = {
    id: '00000000-0000-0000-0000-000000000001',
    nombre: 'Cliente nuevo',
    correoElectronico: 'nuevo@example.test',
    roles: ['CUSTOMER'],
  };
  const identity: IdentidadResponse = {
    ...authResponse,
    telefono: '600000000',
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [RegistrationPage],
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

  function createPage(): ComponentFixture<RegistrationPage> {
    const fixture = TestBed.createComponent(RegistrationPage);
    fixture.detectChanges();
    return fixture;
  }

  function setField(
    fixture: ComponentFixture<RegistrationPage>,
    selector: string,
    value: string,
  ): void {
    const input = fixture.nativeElement.querySelector(selector) as HTMLInputElement;
    input.value = value;
    input.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
  }

  function fillForm(
    fixture: ComponentFixture<RegistrationPage>,
    includePhone = true,
  ): void {
    setField(fixture, '#registration-name', 'Cliente nuevo');
    setField(fixture, '#registration-email', 'nuevo@example.test');
    if (includePhone) {
      setField(fixture, '#registration-phone', '600000000');
    }
    setField(fixture, '#registration-password', 'clave-segura');
  }

  function submitForm(fixture: ComponentFixture<RegistrationPage>): void {
    const form = fixture.nativeElement.querySelector('form') as HTMLFormElement;
    form.dispatchEvent(new Event('submit', { bubbles: true, cancelable: true }));
    fixture.detectChanges();
  }

  it('renders the documented fields, limits, and login link', () => {
    const root = createPage().nativeElement as HTMLElement;

    expect(root.querySelector('h1')?.textContent).toContain('Empieza');
    expect((root.querySelector('#registration-name') as HTMLInputElement).maxLength).toBe(
      255,
    );
    expect((root.querySelector('#registration-email') as HTMLInputElement).maxLength).toBe(
      320,
    );
    expect((root.querySelector('#registration-phone') as HTMLInputElement).maxLength).toBe(
      50,
    );
    expect(
      (root.querySelector('#registration-password') as HTMLInputElement).maxLength,
    ).toBe(72);
    expect(root.querySelector('a[routerlink="/login"]')).toBeTruthy();
  });

  it('shows validation errors and prevents a request for invalid fields', () => {
    const fixture = createPage();
    submitForm(fixture);

    expect(fixture.nativeElement.querySelector('#registration-name-error')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('#registration-email-error')).toBeTruthy();
    expect(
      fixture.nativeElement.querySelector('#registration-password-error'),
    ).toBeTruthy();
    TestBed.inject(HttpTestingController).expectNone(`${authEndpoint}/csrf`);

    setField(fixture, '#registration-name', 'N'.repeat(256));
    setField(fixture, '#registration-email', `${'e'.repeat(315)}@example.test`);
    setField(fixture, '#registration-phone', '1'.repeat(51));
    setField(fixture, '#registration-password', 'p'.repeat(73));
    submitForm(fixture);

    expect(fixture.nativeElement.querySelectorAll('.auth-field__error').length).toBeGreaterThanOrEqual(
      4,
    );
    TestBed.inject(HttpTestingController).expectNone(`${authEndpoint}/csrf`);
  });

  it('posts only registration fields and navigates after /me confirms the session', async () => {
    const fixture = createPage();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    fillForm(fixture);
    submitForm(fixture);

    const http = TestBed.inject(HttpTestingController);
    const csrfRequest = http.expectOne(`${authEndpoint}/csrf`);
    csrfRequest.flush({ token: 'csrf-token' });

    const registrationRequest = http.expectOne(`${authEndpoint}/registro`);
    expect(registrationRequest.request.method).toBe('POST');
    expect(registrationRequest.request.body).toEqual({
      nombre: 'Cliente nuevo',
      correoElectronico: 'nuevo@example.test',
      telefono: '600000000',
      contrasena: 'clave-segura',
    });
    expect(registrationRequest.request.body.roles).toBeUndefined();
    expect(registrationRequest.request.withCredentials).toBe(true);
    expect(registrationRequest.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    registrationRequest.flush(authResponse, {
      status: 201,
      statusText: 'Created',
    });

    http.expectOne(`${authEndpoint}/me`).flush(identity);
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/reservar', {
      state: { registrationWelcome: true },
    });
    expect(
      (fixture.nativeElement.querySelector('#registration-password') as HTMLInputElement)
        .value,
    ).toBe('');
  });

  it('allows login when registration succeeds but /me cannot confirm the session', () => {
    const fixture = createPage();
    const navigateSpy = vi.spyOn(TestBed.inject(Router), 'navigateByUrl');
    fillForm(fixture, false);
    submitForm(fixture);

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    const registrationRequest = http.expectOne(`${authEndpoint}/registro`);
    expect(registrationRequest.request.body.telefono).toBeUndefined();
    registrationRequest.flush(authResponse, {
      status: 201,
      statusText: 'Created',
    });
    http.expectOne(`${authEndpoint}/me`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Tu cuenta se creó, pero no pudimos confirmar la sesión',
    );
    expect(fixture.nativeElement.querySelector('a[routerlink="/login"]')).toBeTruthy();
    expect(navigateSpy).not.toHaveBeenCalled();
  });

  it('returns to reservations with the pending selection after confirmed registration', async () => {
    const reservationDraft = {
      servicioId: '00000000-0000-0000-0000-000000000010',
      profesionalId: '00000000-0000-0000-0000-000000000020',
      fecha: '2026-10-21',
      empiezaEn: '2026-10-21T10:00:00+02:00',
    };
    vi.spyOn(TestBed.inject(Location), 'getState').mockReturnValue({
      reservationDraft,
    });
    const fixture = createPage();
    const navigateSpy = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    fillForm(fixture);
    submitForm(fixture);

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/registro`).flush(authResponse, {
      status: 201,
      statusText: 'Created',
    });
    http.expectOne(`${authEndpoint}/me`).flush(identity);
    await fixture.whenStable();

    expect(navigateSpy).toHaveBeenCalledWith('/reservar', {
      state: { registrationWelcome: true, reservationDraft },
    });
  });

  it('shows a clear duplicate-email message and login link without exposing backend details', () => {
    const fixture = createPage();
    fillForm(fixture);
    submitForm(fixture);

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/registro`).flush(
      { error: 'No se puede completar el registro' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      'Este correo ya está registrado. Inicia sesión o utiliza otro correo electrónico',
    );
    expect(alert?.textContent).not.toContain('No se puede completar el registro');
    expect(
      (alert?.querySelector('a[routerlink="/login"]') as HTMLAnchorElement).textContent,
    ).toContain('¿Ya tienes una cuenta? Inicia sesión');
    expect(
      (fixture.nativeElement.querySelector('#registration-name') as HTMLInputElement)
        .value,
    ).toBe('Cliente nuevo');
    expect(
      (fixture.nativeElement.querySelector('#registration-email') as HTMLInputElement)
        .value,
    ).toBe('nuevo@example.test');
    expect(
      (fixture.nativeElement.querySelector('#registration-password') as HTMLInputElement)
        .value,
    ).toBe('');
  });

  it('shows a general validation message for other registration errors without exposing backend details', () => {
    const fixture = createPage();
    fillForm(fixture);
    submitForm(fixture);

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/registro`).flush(
      { error: 'internal.validation.stack.trace' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      'Revisa los datos introducidos e inténtalo de nuevo.',
    );
    expect(alert?.textContent).not.toContain('internal.validation.stack.trace');
    expect(alert?.querySelector('a[routerlink="/login"]')).toBeNull();
    expect(
      (fixture.nativeElement.querySelector('#registration-password') as HTMLInputElement)
        .value,
    ).toBe('');
  });

  it('shows a rate-limit message without exposing backend response details', () => {
    const fixture = createPage();
    fillForm(fixture);
    submitForm(fixture);

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/registro`).flush(
      { message: 'Demasiadas solicitudes' },
      {
        status: 429,
        statusText: 'Too Many Requests',
        headers: { 'Retry-After': '60' },
      },
    );
    fixture.detectChanges();
    const alert = fixture.nativeElement.querySelector('[role="alert"]');
    expect(alert?.textContent).toContain(
      'Has realizado demasiados intentos. Inténtalo de nuevo más tarde.',
    );
    expect(alert?.textContent).not.toContain('Demasiadas solicitudes');
    expect(alert?.querySelector('a[routerlink="/login"]')).toBeNull();
  });
});
