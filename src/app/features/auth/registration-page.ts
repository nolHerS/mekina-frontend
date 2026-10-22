import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
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
import { emailFormatValidator, nonWhitespaceValidator } from '../../core/auth/auth-form.validators';
import { RegistroRequest } from '../../core/auth/models/registro-request.model';
import { readReservationDraft } from '../reservation/reservation-draft';
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
  private readonly location = inject(Location);
  private readonly router = inject(Router);
  private readonly reservationDraft = readReservationDraft(this.location.getState());
  protected readonly isSubmitting = signal(false);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly emailConflict = signal(false);
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
    this.emailConflict.set(false);
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
        tap(() => {
          registrationSucceeded = true;
          this.form.controls.contrasena.reset('');
        }),
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
            state: {
              registrationWelcome: true,
              ...(this.reservationDraft === null
                ? {}
                : { reservationDraft: this.reservationDraft }),
            },
          });
        },
        error: (error: unknown) => {
          if (registrationSucceeded) {
            this.sessionWarning.set(
              'Tu cuenta se creó, pero no pudimos confirmar la sesión. Inicia sesión para continuar.',
            );
            return;
          }

          this.form.controls.contrasena.reset('');
          this.emailConflict.set(
            error instanceof HttpErrorResponse && error.status === 409,
          );
          this.errorMessage.set(this.registrationErrorMessage(error));
        },
      });
  }

  private registrationErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse) {
      switch (error.status) {
        case 0:
          return 'No se pudo conectar con el servicio. Inténtalo de nuevo.';
        case 400:
          return 'Revisa los datos introducidos e inténtalo de nuevo.';
        case 403:
          return 'No se pudo validar la solicitud. Inténtalo de nuevo.';
        case 409:
          return 'Este correo ya está registrado. Inicia sesión o utiliza otro correo electrónico';
        case 429:
          return 'Has realizado demasiados intentos. Inténtalo de nuevo más tarde.';
      }
    }

    return 'No se pudo completar el registro. Inténtalo de nuevo.';
  }
}
