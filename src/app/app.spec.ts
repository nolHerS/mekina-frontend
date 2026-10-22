import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  HttpTestingController,
  provideHttpClientTesting,
} from '@angular/common/http/testing';
import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { API_BASE_URL } from './core/api/api.config';
import { apiAuthInterceptor } from './core/auth/api-auth.interceptor';
import { App } from './app';
import { routes } from './app.routes';
import { HomePageComponent } from './features/home/home-page';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [
        provideRouter(routes),
        provideHttpClient(withInterceptors([apiAuthInterceptor])),
        provideHttpClientTesting(),
      ],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/auth/me`)
      .flush(null, { status: 401, statusText: 'Unauthorized' });

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load the home route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', HomePageComponent);

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Tu estilo.');
    TestBed.inject(HttpTestingController)
      .expectOne(`${API_BASE_URL}/api/servicios`)
      .flush([]);
  });
});
