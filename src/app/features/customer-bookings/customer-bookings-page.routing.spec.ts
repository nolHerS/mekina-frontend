import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_BASE_URL } from '../../core/api/api.config';
import { apiAuthInterceptor } from '../../core/auth/api-auth.interceptor';
import { IdentidadResponse } from '../../core/auth/models/identidad-response.model';
import { routes } from '../../app.routes';
import { CustomerBookingsPage } from './customer-bookings-page';

describe('Customer bookings route', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([apiAuthInterceptor])),
        provideHttpClientTesting(),
      ],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('loads the lazy /mis-reservas route without adding a frontend auth guard', async () => {
    const harness = await RouterTestingHarness.create();
    const page = await harness.navigateByUrl('/mis-reservas', CustomerBookingsPage);

    expect(TestBed.inject(Router).url).toBe('/mis-reservas');
    expect(page).toBeInstanceOf(CustomerBookingsPage);
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/auth/me`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });
    harness.fixture.detectChanges();
    expect(harness.routeNativeElement?.textContent).toContain(
      'Inicia sesión para consultar tus reservas',
    );
  });
});
