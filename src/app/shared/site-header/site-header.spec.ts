import { signal, WritableSignal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideRouter, Router } from '@angular/router';
import { Observable, of, Subject, tap, throwError } from 'rxjs';
import { vi } from 'vitest';
import { AuthApiService, SessionState } from '../../core/auth/auth-api.service';
import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  let sessionState: WritableSignal<SessionState>;
  let logoutResponse: Observable<void>;
  let logoutCalls: number;

  beforeEach(async () => {
    sessionState = signal<SessionState>({ status: 'anonymous' });
    logoutResponse = of(void 0);
    logoutCalls = 0;

    await TestBed.configureTestingModule({
      imports: [SiteHeader],
      providers: [
        provideRouter([]),
        {
          provide: AuthApiService,
          useValue: {
            sessionState: sessionState.asReadonly(),
            logout: () => {
              logoutCalls += 1;
              return logoutResponse.pipe(
                tap(() => sessionState.set({ status: 'anonymous' })),
              );
            },
          },
        },
      ],
    }).compileComponents();
  });

  function createHeader() {
    const fixture = TestBed.createComponent(SiteHeader);
    fixture.detectChanges();
    return fixture;
  }

  it('shows login and registration links only for an anonymous session', () => {
    const fixture = createHeader();

    expect(fixture.nativeElement.querySelector('a[routerlink="/login"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[routerlink="/registro"]')).toBeTruthy();

    sessionState.set({ status: 'loading' });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[routerlink="/login"]')).toBeNull();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'Comprobando sesión',
    );

    sessionState.set({ status: 'error', error: new Error('Forbidden') });
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('a[routerlink="/login"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[routerlink="/registro"]')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('[role="status"]')?.textContent).toContain(
      'No se pudo comprobar la sesión',
    );
  });

  it('shows the confirmed identity and logs out only after a successful response', () => {
    const fixture = createHeader();
    const router = TestBed.inject(Router);
    const navigateSpy = vi.spyOn(router, 'navigateByUrl').mockResolvedValue(true);
    sessionState.set({
      status: 'authenticated',
      identity: {
        id: '00000000-0000-0000-0000-000000000001',
        nombre: 'Cliente',
        correoElectronico: 'cliente@example.test',
        telefono: null,
        roles: ['CUSTOMER'],
      },
    });
    fixture.detectChanges();
    const response = new Subject<void>();
    logoutResponse = response.asObservable();

    expect(fixture.nativeElement.textContent).toContain('Cliente');
    expect(fixture.nativeElement.querySelector('button.primary-navigation__logout')).toBeTruthy();
    expect(fixture.nativeElement.querySelector('a[routerlink="/login"]')).toBeNull();

    (
      fixture.nativeElement.querySelector(
        'button.primary-navigation__logout',
      ) as HTMLButtonElement
    ).click();
    (
      fixture.nativeElement.querySelector(
        'button.primary-navigation__logout',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(logoutCalls).toBe(1);
    expect(
      fixture.nativeElement.querySelector(
        'button.primary-navigation__logout',
      ).disabled,
    ).toBe(true);
    expect(
      fixture.nativeElement.querySelector(
        'button.primary-navigation__logout',
      ).getAttribute('aria-busy'),
    ).toBe('true');
    expect(navigateSpy).not.toHaveBeenCalled();
    expect(logoutCalls).toBe(1);

    response.next();
    response.complete();
    fixture.detectChanges();

    expect(sessionState()).toEqual({ status: 'anonymous' });
    expect(fixture.nativeElement.querySelector('a[routerlink="/login"]')).toBeTruthy();
    expect(navigateSpy).toHaveBeenCalledWith('/');
    expect(
      fixture.nativeElement.querySelector(
        'button.primary-navigation__logout',
      ),
    ).toBeNull();
  });

  it('keeps the authenticated state and displays an error when logout fails', () => {
    const fixture = createHeader();
    const navigateSpy = vi
      .spyOn(TestBed.inject(Router), 'navigateByUrl')
      .mockResolvedValue(true);
    const identity = {
      id: '00000000-0000-0000-0000-000000000001',
      nombre: 'Cliente',
      correoElectronico: 'cliente@example.test',
      telefono: null,
      roles: ['CUSTOMER'],
    };
    sessionState.set({ status: 'authenticated', identity });
    logoutResponse = throwError(() => new Error('Logout failed'));
    fixture.detectChanges();

    (
      fixture.nativeElement.querySelector(
        'button.primary-navigation__logout',
      ) as HTMLButtonElement
    ).click();
    fixture.detectChanges();

    expect(sessionState()).toEqual({ status: 'authenticated', identity });
    expect(fixture.nativeElement.querySelector('[role="alert"]')?.textContent).toContain(
      'No se pudo cerrar sesión',
    );
    expect(navigateSpy).not.toHaveBeenCalled();
    const logoutButton = fixture.nativeElement.querySelector(
      'button.primary-navigation__logout',
    ) as HTMLButtonElement;
    expect(logoutButton).toBeTruthy();
    expect(logoutButton.disabled).toBe(false);

    logoutResponse = of(void 0);
    logoutButton.click();
    fixture.detectChanges();
    expect(logoutCalls).toBe(2);
    expect(sessionState()).toEqual({ status: 'anonymous' });
    expect(navigateSpy).toHaveBeenCalledWith('/');
  });

  it('opens, closes, and restores focus for the mobile navigation', () => {
    const fixture = createHeader();
    const button = fixture.nativeElement.querySelector(
      '.menu-toggle',
    ) as HTMLButtonElement;

    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    fixture.nativeElement.querySelector('.primary-navigation a').click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    fixture.detectChanges();
    const firstLink = fixture.nativeElement.querySelector(
      '.primary-navigation a',
    ) as HTMLAnchorElement;
    firstLink.focus();
    firstLink.dispatchEvent(
      new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }),
    );
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
