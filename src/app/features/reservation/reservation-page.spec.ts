import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { ComponentFixture, TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api.config';
import { DisponibilidadResponse } from '../../core/api/models/disponibilidad-response.model';
import { ProfesionalPublicoResponse } from '../../core/api/models/profesional-publico-response.model';
import { ServicioResponse } from '../../core/api/models/servicio-response.model';
import { ReservationPage } from './reservation-page';
import { vi } from 'vitest';

describe('ReservationPage', () => {
  const TODAY = '2026-10-21';

  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
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

  function startsAtHours(date: string, firstHour: number, count: number): string[] {
    return Array.from(
      { length: count },
      (_, index) =>
        `${date}T${String(firstHour + index).padStart(2, '0')}:00:00+02:00`,
    );
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
      'El envío de la reserva se implementará en una fase posterior',
    );
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
