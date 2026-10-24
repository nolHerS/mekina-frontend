import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api.config';
import { ReservasPropiasResponse } from '../../core/api/models/reservas-propias-response.model';
import { apiAuthInterceptor } from '../../core/auth/api-auth.interceptor';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { IdentidadResponse } from '../../core/auth/models/identidad-response.model';
import { CustomerBookingsPage } from './customer-bookings-page';
import { vi } from 'vitest';

describe('CustomerBookingsPage', () => {
  const authEndpoint = `${API_BASE_URL}/api/auth`;
  const bookingsEndpoint = `${API_BASE_URL}/api/reservas/mias`;
  const identity: IdentidadResponse = {
    id: '00000000-0000-0000-0000-000000000099',
    nombre: 'Cliente Mekina',
    correoElectronico: 'cliente@example.test',
    telefono: null,
    roles: ['CUSTOMER'],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [CustomerBookingsPage],
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

  function createPage(): ComponentFixture<CustomerBookingsPage> {
    const fixture = TestBed.createComponent(CustomerBookingsPage);
    fixture.detectChanges();
    return fixture;
  }

  function confirmCustomerSession(): void {
    TestBed.inject(HttpTestingController).expectOne(`${authEndpoint}/me`).flush(identity);
  }

  function bookingResponse(
    reservas: ReservasPropiasResponse['reservas'] = [],
    total = reservas.length,
    pagina = 0,
  ): ReservasPropiasResponse {
    return { reservas, pagina, limite: 20, total };
  }

  function reservation(
    id: string,
    empiezaEn: string,
    estado = 'CONFIRMED',
  ): ReservasPropiasResponse['reservas'][number] {
    return {
      id,
      empiezaEn,
      terminaEn: empiezaEn,
      zonaHoraria: 'Europe/Madrid',
      estado,
      precioTotal: 30,
      duracionTotalMinutos: 60,
      servicios: [{ nombre: 'Corte', precio: 30, duracionMinutos: 60 }],
    };
  }

  it('shows the session loading state and only requests bookings for a confirmed customer', () => {
    const fixture = createPage();
    expect(fixture.nativeElement.textContent).toContain('Comprobando tu sesión');
    TestBed.inject(HttpTestingController).expectNone(bookingsEndpoint);

    confirmCustomerSession();
    fixture.detectChanges();

    const request = TestBed.inject(HttpTestingController).expectOne(
      (candidate) => candidate.url === bookingsEndpoint,
    );
    expect(request.request.params.get('pagina')).toBe('0');
    expect(request.request.params.get('limite')).toBe('20');
    request.flush(bookingResponse());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no tienes reservas');
  });

  it('offers login and registration to an anonymous user without exposing private data', () => {
    const fixture = createPage();
    TestBed.inject(HttpTestingController).expectOne(`${authEndpoint}/me`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'Inicia sesión para consultar tus reservas',
    );
    expect(fixture.nativeElement.querySelector('a[href="/login"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[href="/registro"]')).toBeTruthy();
    const navigateSpy = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    (
      fixture.nativeElement.querySelector(
        '.customer-bookings__actions a[href="/login"]',
      ) as HTMLAnchorElement
    ).click();
    expect(navigateSpy).toHaveBeenCalledWith('/login', {
      state: { returnTo: '/mis-reservas' },
    });
    (fixture.nativeElement.querySelector(
      '.customer-bookings__actions a[href="/registro"]',
    ) as HTMLAnchorElement).click();
    expect(navigateSpy).toHaveBeenCalledWith('/registro', {
      state: { returnTo: '/mis-reservas' },
    });
    expect(fixture.nativeElement.textContent).not.toContain('CONFIRMED');
    TestBed.inject(HttpTestingController).expectNone(bookingsEndpoint);
  });

  it('does not request or display bookings for an authenticated non-customer', () => {
    const fixture = createPage();
    TestBed.inject(HttpTestingController).expectOne(`${authEndpoint}/me`).flush({
      ...identity,
      roles: ['BARBER'],
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Acceso no disponible');
    expect(fixture.nativeElement.querySelector('.booking-card')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(bookingsEndpoint);
  });

  it('separates future and past reservations and displays backend snapshots', () => {
    const fixture = createPage();
    confirmCustomerSession();
    const response = bookingResponse([
      reservation('00000000-0000-0000-0000-000000000201', '2099-10-20T10:00:00+02:00'),
      reservation('00000000-0000-0000-0000-000000000202', '2000-10-20T10:00:00+02:00'),
    ]);
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(response);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Reservas con inicio futuro');
    expect(fixture.nativeElement.textContent).toContain('Reservas con inicio pasado');
    expect(fixture.nativeElement.textContent).toContain('CONFIRMED');
    expect(fixture.nativeElement.textContent).toContain('30,00');
    expect(fixture.nativeElement.querySelectorAll('.booking-card')).toHaveLength(2);
  });

  it('shows multiple services and no cancellation action for a reservation in a terminal state', () => {
    const fixture = createPage();
    confirmCustomerSession();
    const item = {
      ...reservation(
        '00000000-0000-0000-0000-000000000204',
        '2099-10-20T10:00:00+02:00',
        'CANCELLED',
      ),
      servicios: [
        { nombre: 'Corte', precio: 20, duracionMinutos: 30 },
        { nombre: 'Barba', precio: 10, duracionMinutos: 15 },
      ],
    };
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(bookingResponse([item]));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Corte');
    expect(fixture.nativeElement.textContent).toContain('Barba');
    expect(fixture.nativeElement.textContent).toContain(
      'No hay acciones disponibles para esta reserva.',
    );
    expect(fixture.nativeElement.querySelector('.booking-card__actions button')).toBeNull();
  });

  it('shows an empty state for an empty page', () => {
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(bookingResponse());
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Todavía no tienes reservas');
    expect(fixture.nativeElement.querySelector('.booking-card')).toBeNull();
  });

  it('shows a recoverable error and retries the current page on demand', () => {
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(null, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudieron cargar tus reservas',
    );

    (fixture.nativeElement.querySelector('.customer-bookings__button') as HTMLButtonElement)
      .click();
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Cargando tus reservas');
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(bookingResponse());
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Todavía no tienes reservas');
  });

  it('shows a network-specific error without exposing the backend response', () => {
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(null, { status: 0, statusText: 'Unknown Error' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo conectar con el servicio',
    );
    expect(fixture.nativeElement.textContent).not.toContain('Unknown Error');
    expect(fixture.nativeElement.querySelector('.customer-bookings__button')).toBeTruthy();
  });

  it('keeps a 403 as an authorization error rather than treating it as logout', () => {
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(null, { status: 403, statusText: 'Forbidden' });
    fixture.detectChanges();

    expect(TestBed.inject(AuthApiService).sessionState().status).toBe('authenticated');
    expect(fixture.nativeElement.textContent).toContain(
      'Tu sesión no tiene permiso para consultar estas reservas',
    );
    expect(fixture.nativeElement.querySelector('.booking-card')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(`${authEndpoint}/me`);
  });

  it('confirms a 401 with /me and clears private data when the session has expired', () => {
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    TestBed.inject(HttpTestingController).expectOne(`${authEndpoint}/me`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    fixture.detectChanges();

    expect(TestBed.inject(AuthApiService).sessionState().status).toBe('anonymous');
    expect(fixture.nativeElement.textContent).toContain(
      'Inicia sesión para consultar tus reservas',
    );
    expect(fixture.nativeElement.textContent).not.toContain('CONFIRMED');
    expect(fixture.nativeElement.querySelector('.booking-card')).toBeNull();
  });

  it('loads the next page only after an explicit pagination action', () => {
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(bookingResponse(
        [reservation('00000000-0000-0000-0000-000000000203', '2099-10-20T10:00:00+02:00')],
        21,
      ));
    fixture.detectChanges();

    const next = fixture.nativeElement.querySelector(
      '.customer-bookings__pagination button:last-child',
    ) as HTMLButtonElement;
    expect(next.disabled).toBe(false);
    next.click();
    fixture.detectChanges();

    const request = TestBed.inject(HttpTestingController).expectOne(
      (candidate) => candidate.url === bookingsEndpoint,
    );
    expect(request.request.params.get('pagina')).toBe('1');
    request.flush(bookingResponse([], 21, 1));
    fixture.detectChanges();
    expect(fixture.nativeElement.textContent).toContain('Página 2');
  });

  it('opens an accessible cancellation confirmation and dismisses it without a request', () => {
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(
        bookingResponse([
          reservation(
            '00000000-0000-0000-0000-000000000205',
            '2099-10-20T10:00:00+02:00',
          ),
        ]),
      );
    fixture.detectChanges();

    (fixture.nativeElement.querySelector('.booking-card__actions button') as HTMLButtonElement)
      .click();
    fixture.detectChanges();
    const dialog = fixture.nativeElement.querySelector('[role="alertdialog"]') as HTMLElement;
    expect(dialog.getAttribute('aria-modal')).toBe('true');
    expect(dialog.getAttribute('aria-labelledby')).toBe('cancel-dialog-title');
    expect(dialog.textContent).toContain('puede ser irreversible');

    dialog.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
    TestBed.inject(HttpTestingController).expectNone(`${authEndpoint}/csrf`);
    TestBed.inject(HttpTestingController).expectNone(
      `${API_BASE_URL}/api/reservas/00000000-0000-0000-0000-000000000205`,
    );
  });

  it('confirms cancellation only once, accepts 204 and reloads server data', () => {
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(
        bookingResponse([
          reservation(
            '00000000-0000-0000-0000-000000000206',
            '2099-10-20T10:00:00+02:00',
          ),
        ]),
      );
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.booking-card__actions button') as HTMLButtonElement)
      .click();
    fixture.detectChanges();

    const confirm = fixture.nativeElement.querySelector(
      '#cancelConfirmButton',
    ) as HTMLButtonElement;
    confirm.click();
    confirm.click();
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    const csrfRequest = http.expectOne(`${authEndpoint}/csrf`);
    expect(csrfRequest.request.withCredentials).toBe(true);
    csrfRequest.flush({ token: 'csrf-token' });
    const deleteRequest = http.expectOne(
      `${API_BASE_URL}/api/reservas/00000000-0000-0000-0000-000000000206`,
    );
    expect(deleteRequest.request.method).toBe('DELETE');
    expect(deleteRequest.request.body).toBeNull();
    expect(deleteRequest.request.withCredentials).toBe(true);
    expect(deleteRequest.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    http.expectNone(
      `${API_BASE_URL}/api/reservas/00000000-0000-0000-0000-000000000206`,
    );
    deleteRequest.flush(null, { status: 204, statusText: 'No Content' });

    const refreshedList = http.expectOne(
      (candidate) => candidate.url === bookingsEndpoint,
    );
    refreshedList.flush(
      bookingResponse([
        reservation(
          '00000000-0000-0000-0000-000000000206',
          '2099-10-20T10:00:00+02:00',
          'CANCELLED',
        ),
      ]),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'El servidor confirmó la cancelación',
    );
    expect(fixture.nativeElement.textContent).toContain('CANCELLED');
    expect(fixture.nativeElement.querySelector('.booking-card__actions button')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alertdialog"]')).toBeNull();
  });

  it('keeps the reservation unchanged and gives a specific conflict message for 409', () => {
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(
        bookingResponse([
          reservation(
            '00000000-0000-0000-0000-000000000207',
            '2099-10-20T10:00:00+02:00',
          ),
        ]),
      );
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.booking-card__actions button') as HTMLButtonElement)
      .click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#cancelConfirmButton') as HTMLButtonElement)
      .click();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(
      `${API_BASE_URL}/api/reservas/00000000-0000-0000-0000-000000000207`,
    ).flush(
      { error: 'Internal details are not shown' },
      { status: 409, statusText: 'Conflict' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'La cita ya no se puede cancelar',
    );
    expect(fixture.nativeElement.textContent).toContain('CONFIRMED');
    expect(fixture.nativeElement.textContent).not.toContain('Internal details');
    expect(fixture.nativeElement.querySelector('.booking-card__actions button')).toBeTruthy();
  });

  it('does not retry an uncertain network failure and requires an explicit list refresh', () => {
    const reservationId = '00000000-0000-0000-0000-000000000208';
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(
        bookingResponse([
          reservation(reservationId, '2099-10-20T10:00:00+02:00'),
        ]),
      );
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.booking-card__actions button') as HTMLButtonElement)
      .click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#cancelConfirmButton') as HTMLButtonElement)
      .click();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${API_BASE_URL}/api/reservas/${reservationId}`)
      .error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo confirmar el resultado de la cancelación',
    );
    expect(
      (fixture.nativeElement.querySelector('.booking-card__actions button') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    http.expectNone(`${API_BASE_URL}/api/reservas/${reservationId}`);

    (fixture.nativeElement.querySelector(
      '.customer-bookings__feedback button',
    ) as HTMLButtonElement).click();
    fixture.detectChanges();
    http.expectOne((candidate) => candidate.url === bookingsEndpoint).flush(
      bookingResponse([
        reservation(reservationId, '2099-10-20T10:00:00+02:00'),
      ]),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'La lista se actualizó desde el servidor',
    );
    expect(
      (fixture.nativeElement.querySelector('.booking-card__actions button') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    http.expectNone(`${API_BASE_URL}/api/reservas/${reservationId}`);
  });

  it('treats a 5xx cancellation response as uncertain and does not log out', () => {
    const reservationId = '00000000-0000-0000-0000-000000000209';
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(
        bookingResponse([
          reservation(reservationId, '2099-10-20T10:00:00+02:00'),
        ]),
      );
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.booking-card__actions button') as HTMLButtonElement)
      .click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#cancelConfirmButton') as HTMLButtonElement)
      .click();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${API_BASE_URL}/api/reservas/${reservationId}`).flush(
      { error: 'Server stack trace' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();

    expect(TestBed.inject(AuthApiService).sessionState().status).toBe('authenticated');
    expect(fixture.nativeElement.textContent).toContain(
      'No se pudo confirmar el resultado de la cancelación',
    );
    http.expectNone(`${API_BASE_URL}/api/reservas/${reservationId}`);
  });

  it('rechecks a 401 during cancellation and hides private data after session expiry', () => {
    const reservationId = '00000000-0000-0000-0000-000000000210';
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(
        bookingResponse([
          reservation(reservationId, '2099-10-20T10:00:00+02:00'),
        ]),
      );
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.booking-card__actions button') as HTMLButtonElement)
      .click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#cancelConfirmButton') as HTMLButtonElement)
      .click();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${API_BASE_URL}/api/reservas/${reservationId}`).flush(
      null,
      { status: 401, statusText: 'Unauthorized' },
    );
    http.expectOne(`${authEndpoint}/me`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    fixture.detectChanges();

    expect(TestBed.inject(AuthApiService).sessionState().status).toBe('anonymous');
    expect(fixture.nativeElement.textContent).toContain(
      'Inicia sesión para consultar tus reservas',
    );
    expect(fixture.nativeElement.querySelector('.booking-card')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('CONFIRMED');
  });

  it('does not interpret a cancellation 403 as an expired session', () => {
    const reservationId = '00000000-0000-0000-0000-000000000211';
    const fixture = createPage();
    confirmCustomerSession();
    TestBed.inject(HttpTestingController)
      .expectOne((candidate) => candidate.url === bookingsEndpoint)
      .flush(
        bookingResponse([
          reservation(reservationId, '2099-10-20T10:00:00+02:00'),
        ]),
      );
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.booking-card__actions button') as HTMLButtonElement)
      .click();
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('#cancelConfirmButton') as HTMLButtonElement)
      .click();

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${API_BASE_URL}/api/reservas/${reservationId}`).flush(
      null,
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect(TestBed.inject(AuthApiService).sessionState().status).toBe('authenticated');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'problema de permisos o de seguridad',
    );
    http.expectNone(`${authEndpoint}/me`);
  });
});
