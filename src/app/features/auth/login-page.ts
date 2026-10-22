import { Component, DestroyRef, inject, signal } from '@angular/core';
import {
  AbstractControl,
  FormControl,
  FormGroup,
  ReactiveFormsModule,
  Validators,
} from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { finalize, switchMap } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { getAuthErrorMessage } from '../../core/auth/auth-error-message';
import { emailFormatValidator, nonWhitespaceValidator } from '../../core/auth/auth-form.validators';
import { SiteFooter } from '../../shared/site-footer/site-footer';
import { SiteHeader } from '../../shared/site-header/site-header';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SiteFooter, SiteHeader],
  selector: 'app-login-page',
  styleUrl: './auth-page.scss',
  templateUrl: './login-page.html',
})
export class LoginPage {
  private readonly authApi = inject(AuthApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly form = new FormGroup({
    correoElectronico: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        nonWhitespaceValidator,
        emailFormatValidator,
      ],
    }),
    contrasena: new FormControl('', {
      nonNullable: true,
      validators: [Validators.required, nonWhitespaceValidator],
    }),
    recordarme: new FormControl(false, { nonNullable: true }),
  });

  protected hasError(control: AbstractControl): boolean {
    return control.invalid && control.touched;
  }

  protected fieldError(control: AbstractControl, field: string): string {
    if (control.hasError('required')) {
      return `Introduce ${field}.`;
    }

    if (control.hasError('email')) {
      return 'Introduce un correo electrónico válido.';
    }

    return 'Revisa este campo.';
  }

  protected submit(): void {
    if (this.isSubmitting()) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.isSubmitting.set(true);
    let loginAccepted = false;
    const { correoElectronico, contrasena, recordarme } = this.form.getRawValue();

    this.authApi
      .login({ correoElectronico, contrasena, recordarme })
      .pipe(
        switchMap(() => {
          loginAccepted = true;
          return this.authApi.me();
        }),
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (identity) => {
          if (identity === null) {
            this.errorMessage.set(
              'No se pudo confirmar tu sesión. Inténtalo de nuevo.',
            );
            return;
          }

          void this.router.navigateByUrl('/reservar');
        },
        error: (error: unknown) => {
          this.errorMessage.set(
            loginAccepted
              ? 'El inicio de sesión se completó, pero no se pudo confirmar la sesión. Inténtalo de nuevo.'
              : getAuthErrorMessage(error, 'login'),
          );
        },
      });
  }
}
