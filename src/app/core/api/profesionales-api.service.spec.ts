import { HttpErrorResponse, provideHttpClient } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { API_BASE_URL } from './api.config';
import { ProfesionalPublicoResponse } from './models/profesional-publico-response.model';
import { ProfesionalesApiService } from './profesionales-api.service';

describe('ProfesionalesApiService', () => {
  beforeEach(() => {
    TestBed.configureTestingModule({
      providers: [provideHttpClient(), provideHttpClientTesting()],
    });
  });

  afterEach(() => {
    TestBed.inject(HttpTestingController).verify();
  });

  it('requests the public professional list and returns its public fields', () => {
    const expected: ProfesionalPublicoResponse[] = [
      {
        id: '00000000-0000-0000-0000-000000000020',
        nombre: 'Profesional Mekina',
      },
    ];
    let response: ProfesionalPublicoResponse[] | undefined;

    TestBed.inject(ProfesionalesApiService)
      .getProfesionalesPublicos()
      .subscribe((professionals) => (response = professionals));

    const request = TestBed.inject(HttpTestingController).expectOne(
      `${API_BASE_URL}/api/profesionales/publicos`,
    );
    expect(request.request.method).toBe('GET');
    request.flush(expected);

    expect(response).toEqual(expected);
  });

  it('returns an empty list when no public professionals are available', () => {
    let response: ProfesionalPublicoResponse[] | undefined;

    TestBed.inject(ProfesionalesApiService)
      .getProfesionalesPublicos()
      .subscribe((professionals) => (response = professionals));

    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush([]);

    expect(response).toEqual([]);
  });

  it('propagates an HTTP error', () => {
    let responseError: HttpErrorResponse | undefined;

    TestBed.inject(ProfesionalesApiService)
      .getProfesionalesPublicos()
      .subscribe({
        error: (error: HttpErrorResponse) => (responseError = error),
      });

    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/profesionales/publicos`)
      .flush(
        { error: 'Unavailable' },
        { status: 503, statusText: 'Service Unavailable' },
      );

    expect(responseError?.status).toBe(503);
  });
});
