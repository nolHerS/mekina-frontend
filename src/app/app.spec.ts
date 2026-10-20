import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { RouterTestingHarness } from '@angular/router/testing';
import { App } from './app';
import { routes } from './app.routes';
import { HomePageComponent } from './features/home/home-page';

describe('App', () => {
  beforeEach(async () => {
    await TestBed.configureTestingModule({
      imports: [App],
      providers: [provideRouter(routes)],
    })
      .compileComponents();
  });

  it('should create the app', () => {
    const fixture = TestBed.createComponent(App);

    expect(fixture.componentInstance).toBeTruthy();
  });

  it('should load the home route', async () => {
    const harness = await RouterTestingHarness.create();
    await harness.navigateByUrl('/', HomePageComponent);

    expect(harness.routeNativeElement?.querySelector('h1')?.textContent).toContain('Tu estilo.');
  });
});
