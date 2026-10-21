import { provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_BASE_URL } from '../../core/api/api.config';
import { routes } from '../../app.routes';
import { ReservationPage } from './reservation-page';

describe('Reservation route', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('navigates to the lazy-loaded /reservar page', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/reservar', ReservationPage);

    expect(TestBed.inject(Router).url).toBe('/reservar');
    expect(page).toBeInstanceOf(ReservationPage);
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush([]);
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush([]);
    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain(
      'Elige tu servicio.',
    );
    TestBed.inject(HttpTestingController).expectNone(
      `${API_BASE_URL}/api/disponibilidad`,
    );
  });
});
