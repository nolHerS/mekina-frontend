import { provideHttpClient, withInterceptors } from '@angular/common/http';
import { Location } from '@angular/common';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { By } from '@angular/platform-browser';
import { provideRouter, RouterLink } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api.config';
import { DisponibilidadResponse } from '../../core/api/models/disponibilidad-response.model';
import { ProfesionalPublicoResponse } from '../../core/api/models/profesional-publico-response.model';
import { ReservaResponse } from '../../core/api/models/reserva-response.model';
import { ServicioResponse } from '../../core/api/models/servicio-response.model';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { apiAuthInterceptor } from '../../core/auth/api-auth.interceptor';
import { IdentidadResponse } from '../../core/auth/models/identidad-response.model';
import { ReservationPage } from './reservation-page';
import { RESERVATION_TERMS } from './reservation-terms';
import { vi } from 'vitest';

describe('ReservationPage', () => {
  const TODAY = '2026-10-21';
  const authEndpoint = `${API_BASE_URL}/api/auth`;
  const identity: IdentidadResponse = {
    id: '00000000-0000-0000-0000-000000000099',
    nombre: 'Cliente',
    correoElectronico: 'cliente@example.test',
    telefono: '600000000',
    roles: ['CUSTOMER'],
  };

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationPage],
      providers: [
        provideRouter([]),
        provideHttpClient(withInterceptors([apiAuthInterceptor])),
        provideHttpClientTesting(),
        {
          provide: RESERVATION_TERMS,
          useValue: {
            status: 'approved',
            text: 'Texto de condiciones aprobado para pruebas.',
          },
        },
      ],
    }).compileComponents();
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-20T22:30:00.000Z'));
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
    vi.useRealTimers();
  });

  function createServices(count: number): ServicioResponse[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `00000000-0000-0000-0000-${String(index + 1).padStart(12, '0')}`,
      nombre: `Servicio ${index + 1}`,
      descripcion: null,
      precio: 18.5,
      duracionMinutos: 30,
      activo: true,
      creadoEn: '2026-10-20T10:00:00+02:00',
      actualizadoEn: '2026-10-20T10:00:00+02:00',
    }));
  }

  function createProfessionals(count: number): ProfesionalPublicoResponse[] {
    return Array.from({ length: count }, (_, index) => ({
      id: `00000000-0000-0000-0000-${String(index + 20).padStart(12, '0')}`,
      nombre: `Profesional ${index + 1}`,
    }));
  }

  function loadCatalog(
    services: ServicioResponse[],
    professionals: ProfesionalPublicoResponse[] = [],
  ): HTMLElement {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();

    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(services);
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush(professionals);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  function flushCatalog(
    fixture: ComponentFixture<ReservationPage>,
    serviceCount = 1,
    professionalCount = 1,
  ): void {
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${API_BASE_URL}/api/servicios`).flush(createServices(serviceCount));
    http
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush(createProfessionals(professionalCount));
    fixture.detectChanges();
  }

  function selectServiceAndProfessional(
    fixture: ComponentFixture<ReservationPage>,
    serviceIndex = 0,
    professionalIndex = 0,
  ): void {
    const serviceRadios = fixture.nativeElement.querySelectorAll(
      '.service-option__radio',
    ) as NodeListOf<HTMLInputElement>;
    const professionalRadios = fixture.nativeElement.querySelectorAll(
      '.professional-option__radio',
    ) as NodeListOf<HTMLInputElement>;
    serviceRadios[serviceIndex].click();
    professionalRadios[professionalIndex].click();
    fixture.detectChanges();
  }

  function chooseDate(
    fixture: ComponentFixture<ReservationPage>,
    date: string,
  ): HTMLInputElement {
    const input = fixture.nativeElement.querySelector(
      '#reservation-date',
    ) as HTMLInputElement;
    input.value = date;
    input.dispatchEvent(new Event('change'));
    fixture.detectChanges();
    return input;
  }

  function expectAvailabilityRequest(date: string) {
    const request = TestBed.inject(HttpTestingController).expectOne(
      (candidate) => candidate.url === `${API_BASE_URL}/api/disponibilidad`,
    );

    expect(request.request.method).toBe('GET');
    expect(request.request.params.get('profesionalId')).toBe(
      createProfessionals(1)[0].id,
    );
    expect(request.request.params.get('desde')).toBe(date);
    expect(request.request.params.get('hasta')).toBe(date);
    expect(request.request.params.getAll('servicioId')).toEqual([
      createServices(1)[0].id,
    ]);

    return request;
  }

  function availabilityResponse(
    date: string,
    starts: string[],
    professionalIndex = 0,
  ): DisponibilidadResponse {
    return {
      profesionalId: createProfessionals(professionalIndex + 1)[professionalIndex].id,
      zonaHoraria: 'Europe/Madrid',
      duracionTotalMinutos: 30,
      desde: date,
      hasta: date,
      dias: [{ fecha: date, inicios: starts }],
    };
  }

  function reservationResponse(
    start = `${TODAY}T10:00:00+02:00`,
  ): ReservaResponse {
    return {
      id: '00000000-0000-0000-0000-000000000200',
      profesionalId: createProfessionals(1)[0].id,
      estado: 'CONFIRMED',
      empiezaEn: start,
      terminaEn: `${TODAY}T11:00:00+02:00`,
      duracionTotalMinutos: 60,
      precioTotal: 30,
    };
  }

  function startsAtHours(date: string, firstHour: number, count: number): string[] {
    return Array.from(
      { length: count },
      (_, index) =>
        `${date}T${String(firstHour + index).padStart(2, '0')}:00:00+02:00`,
    );
  }

  function prepareCompleteSelection(
    fixture: ComponentFixture<ReservationPage>,
    start = `${TODAY}T10:00:00+02:00`,
  ): void {
    flushCatalog(fixture);
    selectServiceAndProfessional(fixture);
    chooseDate(fixture, TODAY);
    expectAvailabilityRequest(TODAY).flush(availabilityResponse(TODAY, [start]));
    fixture.detectChanges();
    (fixture.nativeElement.querySelector('.time-option') as HTMLButtonElement).click();
    fixture.detectChanges();
  }

  function setAnonymousSession(): void {
    TestBed.inject(AuthApiService).me().subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController).expectOne(`${authEndpoint}/me`).flush(
      null,
      { status: 401, statusText: 'Unauthorized' },
    );
  }

  function setAuthenticatedSession(phone = identity.telefono): void {
    TestBed.inject(AuthApiService).me().subscribe();
    TestBed.inject(HttpTestingController).expectOne(`${authEndpoint}/me`).flush({
      ...identity,
      telefono: phone,
    });
  }

  function acceptConditions(fixture: ComponentFixture<ReservationPage>): void {
    const checkbox = fixture.nativeElement.querySelector(
      '#reservation-accept-conditions',
    ) as HTMLInputElement;
    checkbox.click();
    fixture.detectChanges();
  }

  function startReservationRequest(
    fixture: ComponentFixture<ReservationPage>,
    start = `${TODAY}T10:00:00+02:00`,
  ) {
    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();
    acceptConditions(fixture);

    const confirmButton = fixture.nativeElement.querySelector(
      '.reservation__continuation .reservation__continue',
    ) as HTMLButtonElement;
    expect(confirmButton.disabled).toBe(false);
    confirmButton.click();
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    const sessionRequest = http.expectOne(`${authEndpoint}/me`);
    expect(sessionRequest.request.method).toBe('GET');
    sessionRequest.flush(identity);

    const availabilityRequest = http.expectOne(
      (request) => request.url === `${API_BASE_URL}/api/disponibilidad`,
    );
    expect(availabilityRequest.request.method).toBe('GET');
    expect(availabilityRequest.request.params.get('profesionalId')).toBe(
      createProfessionals(1)[0].id,
    );
    expect(availabilityRequest.request.params.get('desde')).toBe(TODAY);
    expect(availabilityRequest.request.params.get('hasta')).toBe(TODAY);
    expect(availabilityRequest.request.params.getAll('servicioId')).toEqual([
      createServices(1)[0].id,
    ]);
    availabilityRequest.flush(availabilityResponse(TODAY, [start]));

    const csrfRequest = http.expectOne(`${authEndpoint}/csrf`);
    expect(csrfRequest.request.method).toBe('GET');
    csrfRequest.flush({ token: 'csrf-token' });

    const createRequest = http.expectOne(`${API_BASE_URL}/api/reservas`);
    expect(createRequest.request.method).toBe('POST');
    expect(createRequest.request.withCredentials).toBe(true);
    expect(createRequest.request.headers.get('X-CSRF-TOKEN')).toBe('csrf-token');
    expect(createRequest.request.body).toEqual({
      profesionalId: createProfessionals(1)[0].id,
      servicioIds: [createServices(1)[0].id],
      empiezaEn: start,
      aceptaCondiciones: true,
    });
    return createRequest;
  }

  it('loads both lists and starts with no selection', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();

    const http = TestBed.inject(HttpTestingController);
    const servicesRequest = http.expectOne(
      `${API_BASE_URL}/api/servicios`,
    );
    const professionalsRequest = http.expectOne(
      `${API_BASE_URL}/api/profesionales/publicos`,
    );
    expect(servicesRequest.request.method).toBe('GET');
    expect(professionalsRequest.request.method).toBe('GET');
    expect(fixture.nativeElement.querySelector('.reservation__state[role="status"]')?.textContent).toContain(
      'Cargando servicios',
    );
    expect(
      fixture.nativeElement.querySelector(
        '.reservation__professionals .reservation__state[role="status"]',
      )?.textContent,
    ).toContain('Cargando profesionales');
    servicesRequest.flush(createServices(1));
    professionalsRequest.flush(createProfessionals(1));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Servicio 1');
    expect(fixture.nativeElement.querySelectorAll('.service-option')).toHaveLength(1);
    expect(
      (fixture.nativeElement.querySelector('.service-option__radio') as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(
      (fixture.nativeElement.querySelector('.professional-option__radio') as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')).toBeNull();
    expect(
      (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
    const dateInput = fixture.nativeElement.querySelector(
      '#reservation-date',
    ) as HTMLInputElement;
    expect(dateInput.min).toBe(TODAY);
    expect(dateInput.max).toBe('2026-11-19');
    expect(dateInput.disabled).toBe(true);
  });

  it('shows the API error without substituting sample services', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush({ error: 'Unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido cargar los servicios',
    );
    expect(fixture.nativeElement.querySelector('.service-option')).toBeNull();
    expect(fixture.nativeElement.textContent).not.toContain('Servicio 1');
  });

  it('shows an empty state when the catalog is empty', () => {
    const page = loadCatalog([]);

    expect(page.querySelector('.reservation__state[role="status"]')?.textContent).toContain(
      'No hay servicios disponibles',
    );
    expect(page.querySelector('.service-option')).toBeNull();
    expect(
      page.querySelector('.reservation__professionals .reservation__state[role="status"]')
        ?.textContent,
    ).toContain('No hay profesionales disponibles');
  });

  it('selects one service and updates the summary', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(createServices(1));
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush([]);
    fixture.detectChanges();

    const radio = fixture.nativeElement.querySelector(
      '.service-option__radio',
    ) as HTMLInputElement;
    radio.click();
    fixture.detectChanges();

    expect(radio.checked).toBe(true);
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent).toContain(
      'Servicio 1',
    );
  });

  it('changes to another service without keeping the previous selection', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(createServices(2));
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush([]);
    fixture.detectChanges();

    const radios = fixture.nativeElement.querySelectorAll(
      '.service-option__radio',
    ) as NodeListOf<HTMLInputElement>;
    radios[0].click();
    fixture.detectChanges();
    radios[1].click();
    fixture.detectChanges();

    expect(radios[0].checked).toBe(false);
    expect(radios[1].checked).toBe(true);
    expect(fixture.nativeElement.querySelectorAll('.reservation__selected-list li')).toHaveLength(
      1,
    );
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent).toContain(
      'Servicio 2',
    );
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent).not.toContain(
      'Servicio 1',
    );
  });

  it('keeps continuing disabled until both service and professional are selected', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(createServices(1));
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush(createProfessionals(2));
    fixture.detectChanges();

    const serviceRadio = fixture.nativeElement.querySelector(
      '.service-option__radio',
    ) as HTMLInputElement;
    const professionalRadios = fixture.nativeElement.querySelectorAll(
      '.professional-option__radio',
    ) as NodeListOf<HTMLInputElement>;
    const continueButton = fixture.nativeElement.querySelector(
      '.reservation__continue',
    ) as HTMLButtonElement;

    expect(continueButton.disabled).toBe(true);

    serviceRadio.click();
    fixture.detectChanges();
    expect(continueButton.disabled).toBe(true);

    professionalRadios[0].click();
    fixture.detectChanges();
    expect(continueButton.disabled).toBe(true);

    professionalRadios[1].click();
    fixture.detectChanges();

    expect(professionalRadios[0].checked).toBe(false);
    expect(professionalRadios[1].checked).toBe(true);
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent).toContain(
      'Profesional 2',
    );
    TestBed.inject(HttpTestingController).expectNone(
      `${API_BASE_URL}/api/disponibilidad`,
    );
  });

  it('shows an accessible professional error and allows retrying', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(createServices(1));
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush({ error: 'Unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    const professionalSection = fixture.nativeElement.querySelector(
      '.reservation__professionals',
    ) as HTMLElement;
    expect(professionalSection.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido cargar los profesionales',
    );

    (professionalSection.querySelector('.reservation__retry') as HTMLButtonElement).click();
    const retryRequest = TestBed.inject(HttpTestingController).expectOne(
      `${API_BASE_URL}/api/profesionales/publicos`,
    );
    retryRequest.flush(createProfessionals(1));
    fixture.detectChanges();

    expect(professionalSection.querySelector('.professional-option__radio')).not.toBeNull();
    expect(professionalSection.querySelector('[role="alert"]')).toBeNull();
  });

  it('queries one Madrid date and preserves the returned offset on the selected time', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    flushCatalog(fixture);
    selectServiceAndProfessional(fixture);

    const dateInput = chooseDate(fixture, TODAY);
    expect(dateInput.disabled).toBe(false);
    const request = expectAvailabilityRequest(TODAY);
    const start = `${TODAY}T10:00:00+02:00`;
    request.flush(availabilityResponse(TODAY, [start]));
    fixture.detectChanges();

    const timeButton = fixture.nativeElement.querySelector(
      '.reservation__availability .time-option',
    ) as HTMLButtonElement;
    expect(timeButton.type).toBe('button');
    expect(timeButton.textContent).toContain('10:00:00 UTC+02:00');
    expect(timeButton.getAttribute('aria-pressed')).toBe('false');
    expect(
      (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    timeButton.click();
    fixture.detectChanges();

    expect(timeButton.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent).toContain(
      '10:00:00 UTC+02:00',
    );
    expect(
      (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement)
        .disabled,
    ).toBe(false);

    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reservation__summary')?.textContent).toContain(
      'Comprobando tu sesión',
    );
  });

  it('shows login and registration actions for an anonymous session with the draft in navigation state', () => {
    setAnonymousSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();

    const links = fixture.debugElement.queryAll(
      By.css('.reservation__continuation a[routerLink]'),
    );
    expect(links).toHaveLength(2);
    expect(links.map((link) => link.nativeElement.textContent.trim())).toEqual([
      'Iniciar sesión',
      'Crear cuenta',
    ]);
    const expectedDraft = {
      servicioId: createServices(1)[0].id,
      profesionalId: createProfessionals(1)[0].id,
      fecha: TODAY,
      empiezaEn: `${TODAY}T10:00:00+02:00`,
    };
    expect(links[0].injector.get(RouterLink).state).toEqual({
      reservationDraft: expectedDraft,
    });
    expect(links[1].injector.get(RouterLink).state).toEqual({
      reservationDraft: expectedDraft,
    });
  });

  it('does not treat a loading session as anonymous and can retry the check', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reservation__continuation')?.textContent)
      .toContain('Comprobando tu sesión');
    expect(fixture.nativeElement.querySelector('.reservation__continuation a[routerLink]')).toBeNull();

    (fixture.nativeElement.querySelector('.reservation__continuation .reservation__retry') as HTMLButtonElement).click();
    TestBed.inject(HttpTestingController)
      .expectOne(`${authEndpoint}/me`)
      .flush(identity);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reservation__continuation')?.textContent)
      .toContain('Confirma la selección');
  });

  it('keeps a forbidden session check distinct and allows retrying it', () => {
    TestBed.inject(AuthApiService).me().subscribe({ error: () => undefined });
    TestBed.inject(HttpTestingController).expectOne(`${authEndpoint}/me`).flush(
      null,
      { status: 403, statusText: 'Forbidden' },
    );
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reservation__continuation[role="alert"]'))
      .not.toBeNull();
    expect(fixture.nativeElement.querySelector('.reservation__continuation a[routerLink]')).toBeNull();

    (fixture.nativeElement.querySelector('.reservation__continuation .reservation__retry') as HTMLButtonElement).click();
    TestBed.inject(HttpTestingController)
      .expectOne(`${authEndpoint}/me`)
      .flush(identity);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reservation__continuation')?.textContent)
      .toContain('Confirma la selección');
  });

  it('prepares a selection for an authenticated customer without creating a reservation', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reservation__continuation')?.textContent)
      .toContain('Confirma la selección');
    expect(TestBed.inject(HttpTestingController).match(
      (request) => request.url.endsWith('/api/reservas'),
    )).toHaveLength(0);
  });

  it('stops an authenticated customer without a phone before confirmation', () => {
    setAuthenticatedSession(null);
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reservation__continuation')?.textContent)
      .toContain('Completa el teléfono de contacto');
    expect(TestBed.inject(HttpTestingController).match(
      (request) => request.url.endsWith('/api/reservas'),
    )).toHaveLength(0);
  });

  it('keeps reservation submission disabled until explicit consent', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);
    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();

    const confirmButton = fixture.nativeElement.querySelector(
      '.reservation__continuation .reservation__continue',
    ) as HTMLButtonElement;
    expect(fixture.nativeElement.querySelector('#reservation-accept-conditions')).not.toBeNull();
    expect(confirmButton.disabled).toBe(true);
    TestBed.inject(HttpTestingController).expectNone(
      (request) => request.url.endsWith('/api/reservas'),
    );
  });

  it('keeps booking blocked and shows pending legal copy until approved conditions are supplied', () => {
    TestBed.overrideProvider(RESERVATION_TERMS, {
      useValue: { status: 'pending' },
    });
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);
    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#reservation-accept-conditions')).toBeNull();
    expect(fixture.nativeElement.textContent).toContain(
      'Las condiciones de reserva están pendientes de validación',
    );
    TestBed.inject(HttpTestingController).expectNone(
      (request) => request.url.endsWith('/api/reservas'),
    );
  });

  it('creates a reservation only after 201 and shows the server response values', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    const request = startReservationRequest(fixture);
    const response = reservationResponse();
    request.flush(response, { status: 201, statusText: 'Created' });
    fixture.detectChanges();

    const confirmation = fixture.nativeElement.querySelector(
      '.reservation__confirmation',
    ) as HTMLElement;
    expect(confirmation.textContent).toContain('Reserva confirmada');
    expect(confirmation.querySelector('time')?.getAttribute('datetime')).toBe(
      response.empiezaEn,
    );
    expect(confirmation.textContent).toContain(response.empiezaEn);
    expect(confirmation.textContent).toContain('60 min');
    expect(confirmation.textContent).toContain('30,00 €');
    expect(confirmation.textContent).toContain(response.estado);
    expect(fixture.nativeElement.querySelector('.reservation__continue')).toBeNull();
  });

  it('does not show confirmation for a successful HTTP status other than 201', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    const request = startReservationRequest(fixture);
    request.flush(reservationResponse(), { status: 200, statusText: 'OK' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reservation__confirmation')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('no se pudo verificar la confirmación');
    expect(fixture.nativeElement.textContent).not.toContain('Reserva confirmada');
    expect(
      (fixture.nativeElement.querySelector(
        'input[name="servicio"]',
      ) as HTMLInputElement).disabled,
    ).toBe(true);
    expect(fixture.nativeElement.querySelector('#reservation-acknowledge-uncertain'))
      .not.toBeNull();
    TestBed.inject(HttpTestingController).expectNone(`${API_BASE_URL}/api/reservas`);
  });

  it('does not POST when the selected start disappears during revalidation', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);
    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();
    acceptConditions(fixture);
    (fixture.nativeElement.querySelector(
      '.reservation__continuation .reservation__continue',
    ) as HTMLButtonElement).click();

    TestBed.inject(HttpTestingController)
      .expectOne(`${authEndpoint}/me`)
      .flush(identity);
    const availability = TestBed.inject(HttpTestingController).expectOne(
      (request) => request.url === `${API_BASE_URL}/api/disponibilidad`,
    );
    availability.flush(availabilityResponse(TODAY, [`${TODAY}T11:00:00+02:00`]));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('Servicio 1');
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('Profesional 1');
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain(TODAY);
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .not.toContain('10:00:00');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('Ese horario ya no aparece disponible');
    TestBed.inject(HttpTestingController).expectNone(
      (request) => request.url.endsWith('/api/reservas'),
    );
  });

  it('prevents duplicate POSTs while one reservation request is in progress', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);
    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();
    acceptConditions(fixture);

    const confirmButton = fixture.nativeElement.querySelector(
      '.reservation__continuation .reservation__continue',
    ) as HTMLButtonElement;
    confirmButton.click();
    confirmButton.click();
    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/me`).flush(identity);
    http.expectOne((request) => request.url === `${API_BASE_URL}/api/disponibilidad`)
      .flush(availabilityResponse(TODAY, [`${TODAY}T10:00:00+02:00`]));
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    const createRequests = http.match(`${API_BASE_URL}/api/reservas`);
    expect(createRequests).toHaveLength(1);
    createRequests[0].flush(reservationResponse(), {
      status: 201,
      statusText: 'Created',
    });
  });

  it.each([
    [400, 'No se pudo crear la reserva', { error: 'INTERNAL_VALIDATION_DETAILS' }],
    [403, 'No se pudo autorizar la solicitud', { error: 'INTERNAL_SECURITY_DETAILS' }],
    [404, 'ya no está disponible', { error: 'INTERNAL_RESOURCE_DETAILS' }],
  ])('shows a safe message for HTTP %s without exposing the backend body', (status, expected) => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    const request = startReservationRequest(fixture);
    request.flush(
      { error: 'INTERNAL_ERROR_BODY' },
      { status: Number(status), statusText: 'Error' },
    );
    fixture.detectChanges();

    const alert = fixture.nativeElement.querySelector('[role="alert"]') as HTMLElement;
    expect(alert.textContent).toContain(String(expected));
    expect(alert.textContent).not.toContain('INTERNAL_ERROR_BODY');
    expect(fixture.nativeElement.querySelector('.reservation__confirmation')).toBeNull();
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('10:00:00');
  });

  it('renews CSRF explicitly after 403 without resending the reservation', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    const request = startReservationRequest(fixture);
    request.flush(
      { error: 'INTERNAL_SECURITY_DETAILS' },
      { status: 403, statusText: 'Forbidden' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('#reservation-refresh-csrf')).not.toBeNull();
    TestBed.inject(HttpTestingController).expectNone(`${API_BASE_URL}/api/auth/csrf`);
    TestBed.inject(HttpTestingController).expectNone(`${API_BASE_URL}/api/reservas`);

    (fixture.nativeElement.querySelector('#reservation-refresh-csrf') as HTMLButtonElement)
      .click();
    const csrfRefresh = TestBed.inject(HttpTestingController).expectOne(
      `${API_BASE_URL}/api/auth/csrf`,
    );
    expect(csrfRefresh.request.method).toBe('GET');
    csrfRefresh.flush({ token: 'renewed-csrf-token' });
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain(
      'La reserva no se ha reenviado',
    );
    expect(fixture.nativeElement.querySelector('.reservation__confirmation')).toBeNull();
    expect(fixture.nativeElement.querySelector('.reservation__continuation .reservation__continue'))
      .not.toBeNull();
    TestBed.inject(HttpTestingController).expectNone(`${API_BASE_URL}/api/reservas`);
  });

  it.each([500, 503])(
    'locks the selection after HTTP %s until the user confirms the result externally',
    (status) => {
      setAuthenticatedSession();
      const fixture = TestBed.createComponent(ReservationPage);
      fixture.detectChanges();
      prepareCompleteSelection(fixture);

      const request = startReservationRequest(fixture);
      request.flush(
        { error: 'INTERNAL_SERVER_DETAILS' },
        { status, statusText: 'Server Error' },
      );
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
        .toContain('Puede haberse creado o no');
      expect(fixture.nativeElement.textContent)
        .toContain('Comprueba tus reservas por otro canal');
      expect(fixture.nativeElement.textContent).not.toContain('INTERNAL_SERVER_DETAILS');
      expect(fixture.nativeElement.querySelector('.reservation__pending')?.textContent)
        .toContain('No se ha podido confirmar si la solicitud creó una reserva');
      expect(fixture.nativeElement.querySelector('.reservation__confirmation')).toBeNull();
      expect(
        (fixture.nativeElement.querySelector(
          'input[name="servicio"]',
        ) as HTMLInputElement).disabled,
      ).toBe(true);
      expect(
        (fixture.nativeElement.querySelector(
          '.reservation__summary .reservation__continue',
        ) as HTMLButtonElement).disabled,
      ).toBe(true);
      TestBed.inject(HttpTestingController).expectNone(`${API_BASE_URL}/api/reservas`);

      (fixture.nativeElement.querySelector(
        '#reservation-acknowledge-uncertain',
      ) as HTMLButtonElement).click();
      fixture.detectChanges();

      expect(fixture.nativeElement.querySelector('.reservation__continuation')).toBeNull();
      expect(
        (fixture.nativeElement.querySelector(
          'input[name="servicio"]',
        ) as HTMLInputElement).disabled,
      ).toBe(false);
      TestBed.inject(HttpTestingController).expectNone(`${API_BASE_URL}/api/reservas`);
    },
  );

  it('rechecks a 401 session and offers login without losing the selection', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    const request = startReservationRequest(fixture);
    request.flush(null, { status: 401, statusText: 'Unauthorized' });
    TestBed.inject(HttpTestingController).expectOne(`${authEndpoint}/me`).flush(null, {
      status: 401,
      statusText: 'Unauthorized',
    });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reservation__continuation a[routerLink="/login"]'))
      .not.toBeNull();
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('Servicio 1');
    expect(fixture.nativeElement.querySelector('.reservation__confirmation')).toBeNull();
  });

  it('refreshes the visible schedule after a 409 without claiming a specific cause', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    const request = startReservationRequest(fixture);
    request.flush(
      { error: 'La reserva ya no está disponible' },
      { status: 409, statusText: 'Conflict' },
    );
    const refreshRequest = TestBed.inject(HttpTestingController).expectOne(
      (candidate) => candidate.url === `${API_BASE_URL}/api/disponibilidad`,
    );
    refreshRequest.flush(
      availabilityResponse(TODAY, [`${TODAY}T11:00:00+02:00`]),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo completar la reserva');
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .not.toContain('solapamiento');
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('Servicio 1');
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .not.toContain('10:00:00');
    TestBed.inject(HttpTestingController).expectNone(
      (candidate) => candidate.url === `${API_BASE_URL}/api/reservas`,
    );
  });

  it('does not retry or claim success when the POST result is uncertain', () => {
    setAuthenticatedSession();
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);

    const request = startReservationRequest(fixture);
    request.error(new ProgressEvent('error'));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo confirmar el resultado de la reserva');
    expect(fixture.nativeElement.querySelector('.reservation__confirmation')).toBeNull();
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('10:00:00');
    expect(
      (fixture.nativeElement.querySelector(
        'input[name="servicio"]',
      ) as HTMLInputElement).disabled,
    ).toBe(true);
    TestBed.inject(HttpTestingController).expectNone(
      (candidate) => candidate.url === `${API_BASE_URL}/api/reservas`,
    );
  });

  it('updates a missing phone through PATCH and shares the returned identity', () => {
    setAuthenticatedSession(null);
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);
    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();

    const phoneInput = fixture.nativeElement.querySelector(
      '#reservation-phone',
    ) as HTMLInputElement;
    phoneInput.value = '611111111';
    phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.debugElement
      .query(By.css('.reservation__continuation form'))
      .triggerEventHandler('ngSubmit', new Event('submit'));

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/me`).flush(identity);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    const patch = http.expectOne(`${authEndpoint}/me`);
    expect(patch.request.method).toBe('PATCH');
    expect(patch.request.body).toEqual({
      nombre: identity.nombre,
      telefono: '611111111',
    });
    const updatedIdentity = { ...identity, telefono: '611111111' };
    patch.flush(updatedIdentity);
    fixture.detectChanges();

    expect(TestBed.inject(AuthApiService).sessionState()).toEqual({
      status: 'authenticated',
      identity: updatedIdentity,
    });
    expect(fixture.nativeElement.textContent)
      .toContain('El teléfono se ha actualizado en tu perfil');
    expect(http.match((request) => request.url.endsWith('/api/reservas'))).toHaveLength(0);
  });

  it('does not continue to reservation creation when the profile update fails', () => {
    setAuthenticatedSession(null);
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    prepareCompleteSelection(fixture);
    (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement).click();
    fixture.detectChanges();
    const phoneInput = fixture.nativeElement.querySelector(
      '#reservation-phone',
    ) as HTMLInputElement;
    phoneInput.value = '611111111';
    phoneInput.dispatchEvent(new Event('input', { bubbles: true }));
    fixture.detectChanges();
    fixture.debugElement
      .query(By.css('.reservation__continuation form'))
      .triggerEventHandler('ngSubmit', new Event('submit'));

    const http = TestBed.inject(HttpTestingController);
    http.expectOne(`${authEndpoint}/me`).flush(identity);
    http.expectOne(`${authEndpoint}/csrf`).flush({ token: 'csrf-token' });
    http.expectOne(`${authEndpoint}/me`).flush(
      { error: 'INTERNAL_PROFILE_ERROR' },
      { status: 400, statusText: 'Bad Request' },
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent)
      .toContain('No se pudo guardar el teléfono');
    expect(fixture.nativeElement.textContent).not.toContain('INTERNAL_PROFILE_ERROR');
    http.expectNone((request) => request.url.endsWith('/api/reservas'));
  });

  it('restores a returned draft only after rechecking the exact start time', () => {
    const start = `${TODAY}T10:00:00+02:00`;
    const draft = {
      servicioId: createServices(1)[0].id,
      profesionalId: createProfessionals(1)[0].id,
      fecha: TODAY,
      empiezaEn: start,
    };
    vi.spyOn(TestBed.inject(Location), 'getState').mockReturnValue({
      reservationDraft: draft,
    });
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(createServices(1));
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush(createProfessionals(1));
    fixture.detectChanges();

    const availabilityRequest = TestBed.inject(HttpTestingController).expectOne(
      (request) => request.url === `${API_BASE_URL}/api/disponibilidad`,
    );
    expect(availabilityRequest.request.params.get('desde')).toBe(TODAY);
    expect(availabilityRequest.request.params.get('profesionalId')).toBe(draft.profesionalId);
    availabilityRequest.flush(availabilityResponse(TODAY, [start]));
    fixture.detectChanges();

    expect((fixture.nativeElement.querySelector('#reservation-date') as HTMLInputElement).value)
      .toBe(TODAY);
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('UTC+02:00');
    expect(
      (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
  });

  it('does not restore a saved time that is no longer available', () => {
    const staleStart = `${TODAY}T10:00:00+02:00`;
    vi.spyOn(TestBed.inject(Location), 'getState').mockReturnValue({
      reservationDraft: {
        servicioId: createServices(1)[0].id,
        profesionalId: createProfessionals(1)[0].id,
        fecha: TODAY,
        empiezaEn: staleStart,
      },
    });
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(createServices(1));
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush(createProfessionals(1));
    const availabilityRequest = TestBed.inject(HttpTestingController).expectOne(
      (request) => request.url === `${API_BASE_URL}/api/disponibilidad`,
    );
    availabilityRequest.flush(
      availabilityResponse(TODAY, [`${TODAY}T11:00:00+02:00`]),
    );
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .not.toContain('10:00:00');
    expect(fixture.nativeElement.querySelector('.reservation__continuation')?.textContent)
      .toContain('el horario dejó de estar disponible');
    expect(
      (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement)
        .disabled,
    ).toBe(true);
  });

  it('shows empty availability and dates without available starts', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    flushCatalog(fixture);
    selectServiceAndProfessional(fixture);

    chooseDate(fixture, TODAY);
    const noDayRequest = expectAvailabilityRequest(TODAY);
    const noDay = availabilityResponse(TODAY, []);
    noDay.dias = [];
    noDayRequest.flush(noDay);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reservation__state[role="status"]')?.textContent)
      .toContain('No hay disponibilidad para esta fecha');

    chooseDate(fixture, '2026-10-22');
    const noStartsRequest = TestBed.inject(HttpTestingController).expectOne(
      (candidate) => candidate.url === `${API_BASE_URL}/api/disponibilidad`,
    );
    noStartsRequest.flush(availabilityResponse('2026-10-22', []));
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.reservation__state[role="status"]')?.textContent)
      .toContain('No hay horarios disponibles para esta fecha');
  });

  it('groups starts by Madrid time across the autumn offset change', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    flushCatalog(fixture);
    selectServiceAndProfessional(fixture);

    const date = '2026-10-25';
    chooseDate(fixture, date);
    const starts = [
      `${date}T02:30:00+02:00`,
      `${date}T02:30:00+01:00`,
      `${date}T12:59:00+00:00`,
      `${date}T13:00:00+00:00`,
    ];
    expectAvailabilityRequest(date).flush(availabilityResponse(date, starts));
    fixture.detectChanges();

    const morning = fixture.nativeElement.querySelectorAll(
      '#morning-time-options .time-option',
    ) as NodeListOf<HTMLButtonElement>;
    const afternoon = fixture.nativeElement.querySelectorAll(
      '#afternoon-time-options .time-option',
    ) as NodeListOf<HTMLButtonElement>;

    expect(morning).toHaveLength(3);
    expect(afternoon).toHaveLength(1);
    expect(
      fixture.nativeElement.querySelector('#morning-time-options')?.getAttribute('role'),
    ).toBe('group');
    expect(
      fixture.nativeElement
        .querySelector('#morning-time-options')
        ?.getAttribute('aria-labelledby'),
    ).toBe('morning-title');
    expect(Array.from(morning).map((button) => button.textContent?.trim())).toEqual([
      '02:30:00 UTC+02:00',
      '02:30:00 UTC+01:00',
      '12:59:00 UTC+00:00',
    ]);
    expect(afternoon[0].textContent).toContain('13:00:00 UTC+00:00');

    morning[1].click();
    fixture.detectChanges();
    expect(morning[1].getAttribute('aria-pressed')).toBe('true');
    expect(morning[0].getAttribute('aria-pressed')).toBe('false');
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('02:30:00 UTC+01:00');
  });

  it('limits each period to six and independently expands, collapses, and selects hidden times', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    flushCatalog(fixture);
    selectServiceAndProfessional(fixture);
    chooseDate(fixture, TODAY);

    const starts = [
      ...startsAtHours(TODAY, 7, 7),
      ...startsAtHours(TODAY, 14, 7),
    ];
    expectAvailabilityRequest(TODAY).flush(availabilityResponse(TODAY, starts));
    fixture.detectChanges();

    const morningToggle = fixture.nativeElement.querySelector(
      'button[aria-controls="morning-time-options"]',
    ) as HTMLButtonElement;
    const afternoonToggle = fixture.nativeElement.querySelector(
      'button[aria-controls="afternoon-time-options"]',
    ) as HTMLButtonElement;
    const morningOptions = () =>
      fixture.nativeElement.querySelectorAll(
        '#morning-time-options .time-option',
      ) as NodeListOf<HTMLButtonElement>;
    const afternoonOptions = () =>
      fixture.nativeElement.querySelectorAll(
        '#afternoon-time-options .time-option',
      ) as NodeListOf<HTMLButtonElement>;

    expect(morningOptions()).toHaveLength(6);
    expect(afternoonOptions()).toHaveLength(6);
    expect(morningToggle.getAttribute('aria-expanded')).toBe('false');
    expect(afternoonToggle.getAttribute('aria-expanded')).toBe('false');

    morningToggle.click();
    fixture.detectChanges();
    expect(morningOptions()).toHaveLength(7);
    expect(afternoonOptions()).toHaveLength(6);
    expect(morningToggle.textContent).toContain('Ver menos horarios');

    const additionalStart = morningOptions()[6];
    expect(additionalStart.textContent).toContain('13:00:00 UTC+02:00');
    additionalStart.click();
    fixture.detectChanges();
    expect(additionalStart.getAttribute('aria-pressed')).toBe('true');
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('13:00:00 UTC+02:00');

    morningToggle.click();
    fixture.detectChanges();
    expect(morningOptions()).toHaveLength(6);
    expect(afternoonOptions()).toHaveLength(6);
    expect(
      (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement)
        .disabled,
    ).toBe(false);
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')?.textContent)
      .toContain('13:00:00 UTC+02:00');

    afternoonToggle.click();
    fixture.detectChanges();
    expect(afternoonOptions()).toHaveLength(7);
    expect(morningOptions()).toHaveLength(6);
    expect(afternoonToggle.getAttribute('aria-expanded')).toBe('true');
  });

  it('shows an empty message for a period with no starts', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    flushCatalog(fixture);
    selectServiceAndProfessional(fixture);
    chooseDate(fixture, TODAY);

    const starts = startsAtHours(TODAY, 9, 2);
    expectAvailabilityRequest(TODAY).flush(availabilityResponse(TODAY, starts));
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelectorAll('#morning-time-options .time-option'))
      .toHaveLength(2);
    expect(fixture.nativeElement.querySelector('#afternoon-time-options')).toBeNull();
    expect(fixture.nativeElement.querySelector('.time-period:last-child [role="status"]')
      ?.textContent).toContain('Sin horarios disponibles por la tarde');
  });

  it.each(['servicio', 'profesional'])(
    'cancels pending availability and clears dependent selections when changing %s',
    (selection) => {
      const fixture = TestBed.createComponent(ReservationPage);
      fixture.detectChanges();
      flushCatalog(fixture, 2, 2);
      selectServiceAndProfessional(fixture);
      chooseDate(fixture, TODAY);
      const pendingRequest = expectAvailabilityRequest(TODAY);

      const changedRadio = fixture.nativeElement.querySelectorAll(
        selection === 'servicio'
          ? '.service-option__radio'
          : '.professional-option__radio',
      )[1] as HTMLInputElement;
      changedRadio.click();
      fixture.detectChanges();

      expect(pendingRequest.cancelled).toBe(true);
      expect(
        (fixture.nativeElement.querySelector('#reservation-date') as HTMLInputElement).value,
      ).toBe('');
      expect(
        fixture.nativeElement.querySelector(
          '.reservation__availability .time-option',
        ),
      ).toBeNull();
      expect(
        (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement)
          .disabled,
      ).toBe(true);
    },
  );

  it.each(['servicio', 'profesional'])(
    'resets expanded time groups when changing %s',
    (selection) => {
      const fixture = TestBed.createComponent(ReservationPage);
      fixture.detectChanges();
      flushCatalog(fixture, 2, 2);
      selectServiceAndProfessional(fixture);
      chooseDate(fixture, TODAY);
      const starts = [
        ...startsAtHours(TODAY, 7, 7),
        ...startsAtHours(TODAY, 14, 7),
      ];
      expectAvailabilityRequest(TODAY).flush(availabilityResponse(TODAY, starts));
      fixture.detectChanges();

      const morningToggle = fixture.nativeElement.querySelector(
        'button[aria-controls="morning-time-options"]',
      ) as HTMLButtonElement;
      const afternoonToggle = fixture.nativeElement.querySelector(
        'button[aria-controls="afternoon-time-options"]',
      ) as HTMLButtonElement;
      morningToggle.click();
      afternoonToggle.click();
      fixture.detectChanges();
      expect(morningToggle.getAttribute('aria-expanded')).toBe('true');
      expect(afternoonToggle.getAttribute('aria-expanded')).toBe('true');
      const additionalStart = fixture.nativeElement.querySelectorAll(
        '#morning-time-options .time-option',
      )[6] as HTMLButtonElement;
      additionalStart.click();
      fixture.detectChanges();
      expect(additionalStart.getAttribute('aria-pressed')).toBe('true');

      const changedRadio = fixture.nativeElement.querySelectorAll(
        selection === 'servicio'
          ? '.service-option__radio'
          : '.professional-option__radio',
      )[1] as HTMLInputElement;
      changedRadio.click();
      fixture.detectChanges();
      expect(
        (fixture.nativeElement.querySelector('#reservation-date') as HTMLInputElement).value,
      ).toBe('');

      chooseDate(fixture, TODAY);
      const refreshRequest = TestBed.inject(HttpTestingController).expectOne(
        (candidate) => candidate.url === `${API_BASE_URL}/api/disponibilidad`,
      );
      expect(refreshRequest.request.params.getAll('servicioId')).toEqual([
        createServices(2)[selection === 'servicio' ? 1 : 0].id,
      ]);
      expect(refreshRequest.request.params.get('profesionalId')).toBe(
        createProfessionals(2)[selection === 'profesional' ? 1 : 0].id,
      );
      refreshRequest.flush(
        availabilityResponse(TODAY, starts, selection === 'profesional' ? 1 : 0),
      );
      fixture.detectChanges();

      expect(
        fixture.nativeElement.querySelectorAll(
          '#morning-time-options .time-option',
        ),
      ).toHaveLength(6);
      expect(
        fixture.nativeElement.querySelectorAll(
          '#afternoon-time-options .time-option',
        ),
      ).toHaveLength(6);
      expect(
        fixture.nativeElement.querySelector(
          'button[aria-controls="morning-time-options"]',
        )?.getAttribute('aria-expanded'),
      ).toBe('false');
      expect(
        fixture.nativeElement.querySelector(
          'button[aria-controls="afternoon-time-options"]',
        )?.getAttribute('aria-expanded'),
      ).toBe('false');
    },
  );

  it('keeps service and professional when changing date and clears the selected time', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    flushCatalog(fixture);
    selectServiceAndProfessional(fixture);

    chooseDate(fixture, TODAY);
    const firstRequest = expectAvailabilityRequest(TODAY);
    firstRequest.flush(availabilityResponse(TODAY, startsAtHours(TODAY, 7, 7)));
    fixture.detectChanges();
    const morningToggle = fixture.nativeElement.querySelector(
      'button[aria-controls="morning-time-options"]',
    ) as HTMLButtonElement;
    morningToggle.click();
    fixture.detectChanges();
    const firstTimeButton = fixture.nativeElement.querySelector(
      '#morning-time-options .time-option:last-child',
    ) as HTMLButtonElement;
    firstTimeButton.click();
    fixture.detectChanges();
    expect(firstTimeButton.getAttribute('aria-pressed')).toBe('true');

    chooseDate(fixture, '2026-10-22');
    const nextRequest = TestBed.inject(HttpTestingController).expectOne(
      (candidate) => candidate.url === `${API_BASE_URL}/api/disponibilidad`,
    );
    expect(nextRequest.request.params.get('desde')).toBe('2026-10-22');
    expect(nextRequest.request.params.get('hasta')).toBe('2026-10-22');
    expect(
      (fixture.nativeElement.querySelector('.service-option__radio') as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      (fixture.nativeElement.querySelector('.professional-option__radio') as HTMLInputElement)
        .checked,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector(
        '.reservation__availability .time-option',
      ),
    ).toBeNull();
    expect(
      (fixture.nativeElement.querySelector('.reservation__continue') as HTMLButtonElement)
        .disabled,
    ).toBe(true);

    nextRequest.flush(availabilityResponse('2026-10-22', startsAtHours('2026-10-22', 7, 7)));
    fixture.detectChanges();
    expect(
      fixture.nativeElement.querySelectorAll(
        '#morning-time-options .time-option',
      ),
    ).toHaveLength(6);
    expect(
      fixture.nativeElement.querySelector(
        'button[aria-controls="morning-time-options"]',
      )?.getAttribute('aria-expanded'),
    ).toBe('false');
    expect(
      Array.from(
        fixture.nativeElement.querySelectorAll(
          '#morning-time-options .time-option',
        ) as NodeListOf<HTMLButtonElement>,
      ).some((button) => button.getAttribute('aria-pressed') === 'true'),
    ).toBe(false);
  });

  it('shows an accessible availability error and retries the selected date', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    flushCatalog(fixture);
    selectServiceAndProfessional(fixture);
    chooseDate(fixture, TODAY);

    expect(
      fixture.nativeElement.querySelector('.reservation__availability [role="status"]')
        ?.textContent,
    ).toContain('Consultando horarios');
    expectAvailabilityRequest(TODAY).flush(
      { error: 'Unavailable' },
      { status: 503, statusText: 'Service Unavailable' },
    );
    fixture.detectChanges();
    const availabilitySection = fixture.nativeElement.querySelector(
      '.reservation__availability',
    ) as HTMLElement;
    expect(availabilitySection.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido cargar los horarios',
    );

    (availabilitySection.querySelector('button.reservation__retry') as HTMLButtonElement).click();
    const retryRequest = expectAvailabilityRequest(TODAY);
    const start = `${TODAY}T10:00:00+02:00`;
    retryRequest.flush(availabilityResponse(TODAY, [start]));
    fixture.detectChanges();

    expect(availabilitySection.querySelector('[role="alert"]')).toBeNull();
    expect(
      availabilitySection.querySelector('.time-option'),
    ).not.toBeNull();
  });

  it('provides labelled keyboard-operable radio groups for service and professional', () => {
    const page = loadCatalog(createServices(1), createProfessionals(1));
    const serviceRadio = page.querySelector('.service-option__radio') as HTMLInputElement;
    const professionalRadio = page.querySelector(
      '.professional-option__radio',
    ) as HTMLInputElement;

    expect(serviceRadio.type).toBe('radio');
    expect(serviceRadio.name).toBe('servicio');
    expect(serviceRadio.labels).toHaveLength(1);
    expect(page.querySelector('fieldset[aria-describedby="service-selection-help"]')).not.toBeNull();
    expect(professionalRadio.type).toBe('radio');
    expect(professionalRadio.name).toBe('profesional');
    expect(professionalRadio.labels).toHaveLength(1);
    expect(
      page.querySelector('fieldset[aria-describedby="professional-selection-help"]'),
    ).not.toBeNull();
  });
});
