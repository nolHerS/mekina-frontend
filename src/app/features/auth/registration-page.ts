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
import { finalize, switchMap, tap } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { getAuthErrorMessage, getBackendErrorMessage } from '../../core/auth/auth-error-message';
import { emailFormatValidator, nonWhitespaceValidator } from '../../core/auth/auth-form.validators';
import { RegistroRequest } from '../../core/auth/models/registro-request.model';
import { SiteFooter } from '../../shared/site-footer/site-footer';
import { SiteHeader } from '../../shared/site-header/site-header';

@Component({
  imports: [ReactiveFormsModule, RouterLink, SiteFooter, SiteHeader],
  selector: 'app-registration-page',
  styleUrl: './auth-page.scss',
  templateUrl: './registration-page.html',
})
export class RegistrationPage {
  private readonly authApi = inject(AuthApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly router = inject(Router);
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly sessionWarning = signal<string | null>(null);
  protected readonly form = new FormGroup({
    nombre: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        nonWhitespaceValidator,
        Validators.maxLength(255),
      ],
    }),
    correoElectronico: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        nonWhitespaceValidator,
        emailFormatValidator,
        Validators.maxLength(320),
      ],
    }),
    telefono: new FormControl('', {
      nonNullable: true,
      validators: [Validators.maxLength(50)],
    }),
    contrasena: new FormControl('', {
      nonNullable: true,
      validators: [
        Validators.required,
        nonWhitespaceValidator,
        Validators.minLength(6),
        Validators.maxLength(72),
      ],
    }),
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

    if (control.hasError('minlength')) {
      return 'La contraseña debe tener al menos 6 caracteres.';
    }

    if (control.hasError('maxlength')) {
      const maximum: unknown = control.errors?.['maxlength'].requiredLength;
      if (typeof maximum !== 'number') {
        return 'Este campo supera la longitud permitida.';
      }

      return `Este campo no puede superar ${maximum} caracteres.`;
    }

    return 'Revisa este campo.';
  }

  protected submit(): void {
    if (this.isSubmitting() || this.sessionWarning() !== null) {
      return;
    }

    if (this.form.invalid) {
      this.form.markAllAsTouched();
      return;
    }

    this.errorMessage.set(null);
    this.sessionWarning.set(null);
    this.isSubmitting.set(true);
    let registrationSucceeded = false;
    const values = this.form.getRawValue();
    const request: RegistroRequest = {
      nombre: values.nombre,
      correoElectronico: values.correoElectronico,
      contrasena: values.contrasena,
      ...(values.telefono.trim() !== ''
        ? { telefono: values.telefono.trim() }
        : {}),
    };

    this.authApi
      .register(request)
      .pipe(
        tap(() => (registrationSucceeded = true)),
        switchMap(() => this.authApi.me()),
        finalize(() => this.isSubmitting.set(false)),
        takeUntilDestroyed(this.destroyRef),
      )
      .subscribe({
        next: (identity) => {
          if (identity === null) {
            this.sessionWarning.set(
              'Tu cuenta se creó, pero no pudimos confirmar la sesión. Inicia sesión para continuar.',
            );
            return;
          }

          void this.router.navigateByUrl('/reservar', {
            state: { registrationWelcome: true },
          });
        },
        error: (error: unknown) => {
          if (registrationSucceeded) {
            const backendMessage = getBackendErrorMessage(error);
            this.sessionWarning.set(
              backendMessage === null
                ? 'Tu cuenta se creó, pero no pudimos confirmar la sesión. Inicia sesión para continuar.'
                : `Tu cuenta se creó, pero no pudimos confirmar la sesión: ${backendMessage}`,
            );
            return;
          }

          this.errorMessage.set(getAuthErrorMessage(error, 'registro'));
        },
      });
  }
}
