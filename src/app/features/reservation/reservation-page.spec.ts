import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { API_BASE_URL } from '../../core/api/api.config';
import { ServicioResponse } from '../../core/api/models/servicio-response.model';
import { ReservationPage } from './reservation-page';

describe('ReservationPage', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ReservationPage],
      providers: [provideRouter([]), provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
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

  function loadCatalog(services: ServicioResponse[]): HTMLElement {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();

    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(services);
    fixture.detectChanges();

    return fixture.nativeElement as HTMLElement;
  }

  it('loads services and starts with no service selected', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();

    const request = TestBed.inject(HttpTestingController).expectOne(
      `${API_BASE_URL}/api/servicios`,
    );
    expect(request.request.method).toBe('GET');
    expect(fixture.nativeElement.querySelector('.reservation__state[role="status"]')?.textContent).toContain(
      'Cargando servicios',
    );
    request.flush(createServices(1));
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('Servicio 1');
    expect(fixture.nativeElement.querySelectorAll('.service-option')).toHaveLength(1);
    expect(
      (fixture.nativeElement.querySelector('.service-option__radio') as HTMLInputElement)
        .checked,
    ).toBe(false);
    expect(fixture.nativeElement.querySelector('.reservation__selected-list')).toBeNull();
  });

  it('shows the API error without substituting sample services', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush({ error: 'Unavailable' }, { status: 503, statusText: 'Service Unavailable' });
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
  });

  it('selects one service and updates the summary', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(createServices(1));
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

  it('keeps continuing disabled while professional selection is pending', () => {
    const fixture = TestBed.createComponent(ReservationPage);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush(createServices(1));
    fixture.detectChanges();

    const radio = fixture.nativeElement.querySelector(
      '.service-option__radio',
    ) as HTMLInputElement;
    radio.click();
    fixture.detectChanges();

    const continueButton = fixture.nativeElement.querySelector(
      '.reservation__continue',
    ) as HTMLButtonElement;

    expect(continueButton.disabled).toBe(true);
    expect(fixture.nativeElement.querySelector('#professional-pending')?.textContent).toContain(
      'La selección de profesional todavía está pendiente',
    );
    TestBed.inject(HttpTestingController).expectNone(
      `${API_BASE_URL}/api/disponibilidad`,
    );
  });

  it('provides labelled keyboard-operable radio controls in one group', () => {
    const page = loadCatalog(createServices(1));
    const radio = page.querySelector('.service-option__radio') as HTMLInputElement;

    expect(radio.type).toBe('radio');
    expect(radio.name).toBe('servicio');
    expect(radio.labels).toHaveLength(1);
    expect(page.querySelector('fieldset[aria-describedby="service-selection-help"]')).not.toBeNull();
  });
});
