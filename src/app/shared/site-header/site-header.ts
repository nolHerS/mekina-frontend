import { Component, DestroyRef, ElementRef, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { finalize } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { getBackendErrorMessage } from '../../core/auth/auth-error-message';

@Component({
  imports: [NgOptimizedImage, RouterLink],
  selector: 'app-site-header',
  styleUrl: './site-header.scss',
  templateUrl: './site-header.html',
})
export class SiteHeader {
  protected readonly menuOpen = signal(false);
  protected readonly logoutPending = signal(false);
  protected readonly logoutError = signal<string | null>(null);
  private readonly authApi = inject(AuthApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly sessionState = this.authApi.sessionState;
  private readonly hostElement = inject(ElementRef<HTMLElement>);

  protected readonly links = [
    { label: 'Inicio', fragment: 'inicio' },
    { label: 'Servicios', fragment: 'servicios' },
    { label: 'Horarios', fragment: 'horarios' },
    { label: 'Ubicación', fragment: 'ubicacion' },
    { label: 'Contacto', fragment: 'contacto' },
    { label: 'Mi cita', route: '/reservar' },
  ];

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }

  protected logout(): void {
    if (this.logoutPending()) {
      return;
    }

    this.logoutPending.set(true);
    this.logoutError.set(null);
    this.authApi
      .logout()
      .pipe(
        finalize(() => this.logoutPending.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: () => {
          this.closeMenu();
          void this.router.navigateByUrl('/');
        },
        error: (error: unknown) =>
          this.logoutError.set(
            getBackendErrorMessage(error) ??
              'No se pudo cerrar sesión. Inténtalo de nuevo.',
          ),
      });
  }

  protected handleEscape(): void {
    if (!this.menuOpen()) {
      return;
    }

    const host: HTMLElement = this.hostElement.nativeElement;
    const toggle = host.querySelector<HTMLButtonElement>('.menu-toggle');
    toggle?.focus();
    this.closeMenu();
  }
}
