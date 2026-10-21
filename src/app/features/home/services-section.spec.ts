import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from '../../core/api/api.config';
import { ServicioResponse } from '../../core/api/models/servicio-response.model';
import { ServicesSection } from './services-section';

describe('ServicesSection', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [ServicesSection],
      providers: [provideHttpClient(), provideHttpClientTesting()],
    }).compileComponents();
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('shows a loading state while requesting the catalog', () => {
    const fixture = TestBed.createComponent(ServicesSection);
    fixture.detectChanges();

    const status = fixture.nativeElement.querySelector('[role="status"]') as HTMLElement;
    const content = fixture.nativeElement.querySelector('.catalog-content') as HTMLElement;

    expect(status.textContent).toContain('Cargando servicios');
    expect(content.getAttribute('aria-busy')).toBe('true');
    TestBed.inject(HttpTestingController).expectOne(`${API_BASE_URL}/api/servicios`);
  });

  it('shows the API services and handles a null description', () => {
    const fixture = TestBed.createComponent(ServicesSection);
    fixture.detectChanges();

    const service: ServicioResponse = {
      id: '00000000-0000-0000-0000-000000000010',
      nombre: 'Corte',
      descripcion: null,
      precio: 18.5,
      duracionMinutos: 30,
      activo: true,
      creadoEn: '2026-10-20T10:00:00+02:00',
      actualizadoEn: '2026-10-20T10:00:00+02:00',
    };
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush([service]);
    fixture.detectChanges();

    const card = fixture.nativeElement.querySelector('.service-card') as HTMLElement;

    expect(card.querySelector('h3')?.textContent).toContain('Corte');
    expect(card.querySelector('.service-card__details p')).toBeNull();
    expect([...card.querySelectorAll('dd')].map((value) => value.textContent?.trim())).toEqual([
      '30 min',
      '18,50 €',
    ]);
    expect(fixture.nativeElement.querySelector('[role="alert"]')).toBeNull();
  });

  it('shows an empty state when the API returns no services', () => {
    const fixture = TestBed.createComponent(ServicesSection);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush([]);
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent).toContain('No hay servicios disponibles');
    expect(fixture.nativeElement.querySelector('.service-grid')).toBeNull();
  });

  it('shows a clear error state when the API request fails', () => {
    const fixture = TestBed.createComponent(ServicesSection);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush({ error: 'Unavailable' }, { status: 503, statusText: 'Service Unavailable' });
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'No se han podido cargar los servicios',
    );
    expect(fixture.nativeElement.querySelector('.service-card')).toBeNull();
  });
});
