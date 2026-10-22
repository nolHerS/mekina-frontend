import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { HttpErrorResponse } from '@angular/common/http';
import { Location } from '@angular/common';
import { FormControl, ReactiveFormsModule, Validators } from '@angular/forms';
import { Router, RouterLink } from '@angular/router';
import { Subscription } from 'rxjs';
import { AuthApiService } from '../../core/auth/auth-api.service';
import { CsrfTokenService } from '../../core/auth/csrf-token.service';
import { nonWhitespaceValidator } from '../../core/auth/auth-form.validators';
import { SiteFooter } from '../../shared/site-footer/site-footer';
import { SiteHeader } from '../../shared/site-header/site-header';
import { DisponibilidadApiService } from '../../core/api/disponibilidad-api.service';
import { ReservasApiService } from '../../core/api/reservas-api.service';
import { CrearReservaRequest } from '../../core/api/models/crear-reserva-request.model';
import { DisponibilidadResponse } from '../../core/api/models/disponibilidad-response.model';
import { ProfesionalPublicoResponse } from '../../core/api/models/profesional-publico-response.model';
import {
  isReservaResponse,
  ReservaResponse,
} from '../../core/api/models/reserva-response.model';
import { ServicioResponse } from '../../core/api/models/servicio-response.model';
import { ProfesionalesApiService } from '../../core/api/profesionales-api.service';
import { ServiciosApiService } from '../../core/api/servicios-api.service';
import {
  hasRegistrationWelcome,
  readReservationDraft,
  ReservationDraft,
} from './reservation-draft';
import { RESERVATION_TERMS } from './reservation-terms';

type CatalogState = 'loading' | 'success' | 'empty' | 'error';
type AvailabilityState = 'idle' | 'loading' | 'success' | 'empty' | 'error';
type BookingOperation =
  | 'checking-session'
  | 'checking-availability'
  | 'creating'
  | 'updating-profile'
  | 'refreshing-csrf'
  | null;
type ContinueState =
  | 'anonymous'
  | 'loading'
  | 'error'
  | 'phone-required'
  | 'ready'
  | 'draft-invalid'
  | 'not-customer'
  | 'slot-stale'
  | 'failed'
  | 'uncertain'
  | 'success'
  | null;

const BUSINESS_TIME_ZONE = 'Europe/Madrid';
const MAX_VISIBLE_TIME_OPTIONS = 6;
const BUSINESS_HOUR_FORMATTER = new Intl.DateTimeFormat('en', {
  timeZone: BUSINESS_TIME_ZONE,
  hour: '2-digit',
  hourCycle: 'h23',
});

function getBusinessHour(offsetDateTime: string): number {
  const instant = new Date(offsetDateTime);
  if (!Number.isFinite(instant.getTime())) {
    throw new RangeError('El inicio de disponibilidad no es una fecha válida.');
  }

  const hour = BUSINESS_HOUR_FORMATTER.formatToParts(instant)
    .find((part) => part.type === 'hour')
    ?.value;

  if (hour === undefined) {
    throw new Error('No se pudo determinar la hora de Europe/Madrid.');
  }

  return Number(hour);
}

function getBusinessDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en', {
    timeZone: BUSINESS_TIME_ZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
  }).formatToParts(now);
  const year = parts.find((part) => part.type === 'year')?.value;
  const month = parts.find((part) => part.type === 'month')?.value;
  const day = parts.find((part) => part.type === 'day')?.value;

  if (!year || !month || !day) {
    throw new Error('No se pudo determinar la fecha de Europe/Madrid.');
  }

  return `${year}-${month}-${day}`;
}

function addCalendarDays(date: string, days: number): string {
  const value = new Date(`${date}T00:00:00.000Z`);
  value.setUTCDate(value.getUTCDate() + days);
  return value.toISOString().slice(0, 10);
}

function isCalendarDate(date: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) {
    return false;
  }

  const value = new Date(`${date}T00:00:00.000Z`);
  return Number.isFinite(value.getTime()) && value.toISOString().slice(0, 10) === date;
}

@Component({
  imports: [ReactiveFormsModule, RouterLink, SiteHeader, SiteFooter],
  selector: 'app-reservation-page',
  styleUrl: './reservation-page.scss',
  templateUrl: './reservation-page.html',
})
export class ReservationPage implements OnDestroy, OnInit {
  private readonly router = inject(Router);
  private readonly location = inject(Location);
  private readonly routeState =
    this.router.getCurrentNavigation()?.extras.state ?? this.location.getState();
  private pendingDraft = readReservationDraft(this.routeState);
  private restoredDraftStart: string | null = null;
  private draftRestoreAttempted = false;
  private readonly authApi = inject(AuthApiService);
  protected readonly registrationWelcome = signal(
    hasRegistrationWelcome(this.routeState),
  );
  protected readonly services = signal<ServicioResponse[]>([]);
  protected readonly catalogState = signal<CatalogState>('loading');
  protected readonly selectedServiceId = signal<string | null>(null);
  protected readonly professionals = signal<ProfesionalPublicoResponse[]>([]);
  protected readonly professionalsState = signal<CatalogState>('loading');
  protected readonly selectedProfessionalId = signal<string | null>(null);
  protected readonly dateMin = signal('');
  protected readonly dateMax = signal('');
  protected readonly selectedDate = signal<string | null>(null);
  protected readonly availability = signal<DisponibilidadResponse | null>(null);
  protected readonly availabilityState = signal<AvailabilityState>('idle');
  protected readonly selectedStart = signal<string | null>(null);
  protected readonly continueState = signal<ContinueState>(null);
  protected readonly bookingOperation = signal<BookingOperation>(null);
  protected readonly bookingError = signal<string | null>(null);
  protected readonly csrfRefreshAvailable = signal(false);
  protected readonly csrfRefreshMessage = signal<string | null>(null);
  protected readonly reservationOutcomeUncertain = signal(false);
  protected readonly profileError = signal<string | null>(null);
  protected readonly phoneSaved = signal(false);
  protected readonly reservationResult = signal<ReservaResponse | null>(null);
  protected readonly conditionsAccepted = signal(false);
  protected readonly phoneControl = new FormControl('', {
    nonNullable: true,
    validators: [
      Validators.required,
      Validators.maxLength(50),
      nonWhitespaceValidator,
    ],
  });
  private readonly reservationTerms = inject(RESERVATION_TERMS);
  private readonly approvedReservationTerms =
    this.reservationTerms.status === 'approved' &&
    this.reservationTerms.text.trim() !== ''
      ? this.reservationTerms
      : null;
  protected readonly conditionsPending = this.approvedReservationTerms === null;
  protected readonly conditionsText =
    this.approvedReservationTerms?.text ?? null;
  protected readonly conditionsUrl =
    this.approvedReservationTerms?.url ?? null;
  protected readonly conditionsApproved =
    this.approvedReservationTerms !== null;
  protected readonly morningExpanded = signal(false);
  protected readonly afternoonExpanded = signal(false);
  protected readonly selectedService = computed(
    () =>
      this.services().find((service) => service.id === this.selectedServiceId()) ?? null,
  );
  protected readonly selectedProfessional = computed(
    () =>
      this.professionals().find(
        (professional) => professional.id === this.selectedProfessionalId(),
      ) ?? null,
  );
  protected readonly canChooseDate = computed(
    () =>
      this.selectedService() !== null &&
      this.selectedProfessional() !== null &&
      this.dateMin() !== '' &&
      this.dateMax() !== '',
  );
  protected readonly selectedDay = computed(
    () =>
      this.availability()?.dias.find(
        (day) => day.fecha === this.selectedDate(),
      ) ?? null,
  );
  protected readonly availableStarts = computed(
    () => this.selectedDay()?.inicios ?? [],
  );
  protected readonly morningStarts = computed(() =>
    this.availableStarts().filter((start) => getBusinessHour(start) < 14),
  );
  protected readonly afternoonStarts = computed(() =>
    this.availableStarts().filter((start) => getBusinessHour(start) >= 14),
  );
  protected readonly visibleMorningStarts = computed(() =>
    this.getVisibleStarts(this.morningStarts(), this.morningExpanded()),
  );
  protected readonly visibleAfternoonStarts = computed(() =>
    this.getVisibleStarts(this.afternoonStarts(), this.afternoonExpanded()),
  );
  protected readonly canExpandMorning = computed(
    () => this.morningStarts().length > MAX_VISIBLE_TIME_OPTIONS,
  );
  protected readonly canExpandAfternoon = computed(
    () => this.afternoonStarts().length > MAX_VISIBLE_TIME_OPTIONS,
  );
  protected readonly canContinue = computed(
    () =>
      this.selectedService() !== null &&
      this.selectedProfessional() !== null &&
      this.isBookableDate(this.selectedDate() ?? '') &&
      this.selectedStart() !== null &&
      this.availableStarts().includes(this.selectedStart() ?? ''),
  );
  protected readonly authNavigationState = computed(() => {
    const draft = this.createReservationDraft();
    return draft === null ? {} : { reservationDraft: draft };
  });
  protected readonly isBookingBusy = computed(
    () => this.bookingOperation() !== null,
  );
  protected readonly isReservationLocked = computed(
    () =>
      this.isBookingBusy() ||
      this.reservationOutcomeUncertain() ||
      this.reservationResult() !== null,
  );
  protected readonly canSubmitReservation = computed(
    () =>
      this.canContinue() &&
      this.continueState() === 'ready' &&
      this.conditionsApproved &&
      this.conditionsAccepted() &&
      !this.isReservationLocked(),
  );

  private readonly csrfToken = inject(CsrfTokenService);
  private readonly serviciosApi = inject(ServiciosApiService);
  private readonly profesionalesApi = inject(ProfesionalesApiService);
  private readonly disponibilidadApi = inject(DisponibilidadApiService);
  private readonly reservasApi = inject(ReservasApiService);
  private availabilityRequest: Subscription | null = null;
  private availabilityRequestId = 0;

  ngOnInit(): void {
    const today = getBusinessDate(new Date());
    this.dateMin.set(today);
    this.dateMax.set(addCalendarDays(today, 29));
    this.loadServices();
    this.loadProfessionals();
  }

  ngOnDestroy(): void {
    this.cancelAvailabilityRequest();
  }

  protected loadServices(): void {
    if (this.isReservationLocked()) {
      return;
    }

    this.catalogState.set('loading');
    this.serviciosApi.getServicios().subscribe({
      next: (services) => {
        this.services.set(services);
        this.catalogState.set(services.length > 0 ? 'success' : 'empty');
        this.restoreDraftWhenCatalogsReady();
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar el catálogo para la reserva.', error);
        this.catalogState.set('error');
      },
    });
  }

  protected selectService(serviceId: string): void {
    if (
      this.isReservationLocked() ||
      this.selectedServiceId() === serviceId
    ) {
      return;
    }

    this.resetConfirmationState();
    this.cancelPendingDraftRestore();
    this.continueState.set(null);
    this.selectedServiceId.set(serviceId);
    this.invalidateDateSelection();
  }

  protected loadProfessionals(): void {
    if (this.isReservationLocked()) {
      return;
    }

    this.professionalsState.set('loading');
    this.professionals.set([]);
    this.selectedProfessionalId.set(null);
    this.invalidateDateSelection();

    this.profesionalesApi.getProfesionalesPublicos().subscribe({
      next: (professionals) => {
        this.professionals.set(professionals);
        this.professionalsState.set(
          professionals.length > 0 ? 'success' : 'empty',
        );
        this.restoreDraftWhenCatalogsReady();
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar la lista pública de profesionales.', error);
        this.professionalsState.set('error');
      },
    });
  }

  protected selectProfessional(professionalId: string): void {
    if (
      this.isReservationLocked() ||
      this.selectedProfessionalId() === professionalId
    ) {
      return;
    }

    this.resetConfirmationState();
    this.cancelPendingDraftRestore();
    this.continueState.set(null);
    this.selectedProfessionalId.set(professionalId);
    this.invalidateDateSelection();
  }

  protected selectDate(event: Event): void {
    if (
      this.isReservationLocked() ||
      !(event.target instanceof HTMLInputElement)
    ) {
      return;
    }

    this.resetConfirmationState();
    const date = event.target.value;
    this.continueState.set(null);
    this.resetTimePresentation();
    this.availability.set(null);
    this.cancelAvailabilityRequest();

    if (!this.canChooseDate() || !this.isBookableDate(date)) {
      this.selectedDate.set(null);
      this.availabilityState.set('idle');
      return;
    }

    this.selectedDate.set(date);
    this.loadAvailability();
  }

  protected loadAvailability(): void {
    if (this.reservationOutcomeUncertain()) {
      return;
    }

    this.cancelAvailabilityRequest();
    this.resetTimePresentation();
    this.availability.set(null);

    const date = this.selectedDate();
    const service = this.selectedService();
    const professional = this.selectedProfessional();

    if (
      !date ||
      !this.isBookableDate(date) ||
      !service ||
      !professional
    ) {
      this.availabilityState.set('idle');
      return;
    }

    this.availabilityState.set('loading');
    const requestId = this.availabilityRequestId;
    this.availabilityRequest = this.disponibilidadApi
      .getDisponibilidad({
        profesionalId: professional.id,
        desde: date,
        hasta: date,
        servicioIds: [service.id],
      })
      .subscribe({
        next: (availability) => {
          if (requestId !== this.availabilityRequestId) {
            return;
          }

          this.availability.set(availability);
          this.availabilityState.set(
            availability.dias.length > 0 ? 'success' : 'empty',
          );
          this.restoreSelectedStartIfAvailable();
          this.availabilityRequest = null;
        },
        error: (error: unknown) => {
          if (requestId !== this.availabilityRequestId) {
            return;
          }

          console.error('No se pudo consultar la disponibilidad.', error);
          this.availabilityState.set('error');
          if (this.restoredDraftStart !== null) {
            this.restoredDraftStart = null;
            this.continueState.set('draft-invalid');
          }
          this.availabilityRequest = null;
        },
      });
  }

  protected selectStart(start: string): void {
    if (
      !this.isReservationLocked() &&
      this.availableStarts().includes(start)
    ) {
      this.resetConfirmationState();
      this.continueState.set(null);
      this.selectedStart.set(start);
    }
  }

  protected toggleMorning(): void {
    this.morningExpanded.update((expanded) => !expanded);
  }

  protected toggleAfternoon(): void {
    this.afternoonExpanded.update((expanded) => !expanded);
  }

  protected continueSelection(): void {
    if (this.isReservationLocked()) {
      return;
    }

    if (!this.canContinue()) {
      this.continueState.set('draft-invalid');
      return;
    }

    const session = this.authApi.sessionState();
    switch (session.status) {
      case 'anonymous':
        this.continueState.set('anonymous');
        break;
      case 'loading':
        this.continueState.set('loading');
        break;
      case 'error':
        this.continueState.set('error');
        break;
      case 'authenticated':
        if (!session.identity.roles.includes('CUSTOMER')) {
          this.continueState.set('not-customer');
        } else if (
          session.identity.telefono === null ||
          session.identity.telefono.trim() === ''
        ) {
          this.continueState.set('phone-required');
        } else {
          this.continueState.set('ready');
        }
        break;
    }
  }

  protected retrySessionCheck(): void {
    if (this.isReservationLocked()) {
      return;
    }

    this.continueState.set('loading');
    this.authApi.me().subscribe({
      next: () => this.continueSelection(),
      error: () => this.continueState.set('error'),
    });
  }

  protected refreshCsrfAfterForbidden(): void {
    if (!this.csrfRefreshAvailable() || this.isBookingBusy()) {
      return;
    }

    this.csrfRefreshMessage.set(null);
    this.bookingOperation.set('refreshing-csrf');
    this.csrfToken.refreshToken().subscribe({
      next: () => {
        this.bookingOperation.set(null);
        this.csrfRefreshAvailable.set(false);
        this.csrfRefreshMessage.set(
          'El token se ha renovado. La reserva no se ha reenviado; si decides continuar, tendrás que confirmar de nuevo.',
        );
        this.continueState.set('ready');
      },
      error: () => {
        this.bookingOperation.set(null);
        this.csrfRefreshMessage.set(
          'No se pudo renovar el token de seguridad. La reserva no se ha reenviado.',
        );
      },
    });
  }

  protected acknowledgeUncertainOutcome(): void {
    if (!this.reservationOutcomeUncertain()) {
      return;
    }

    this.reservationOutcomeUncertain.set(false);
    this.continueState.set(null);
    this.bookingError.set(null);
  }

  protected setConditionsAccepted(event: Event): void {
    if (
      !this.conditionsApproved ||
      this.isReservationLocked() ||
      !(event.target instanceof HTMLInputElement)
    ) {
      return;
    }

    this.conditionsAccepted.set(event.target.checked);
  }

  protected updatePhoneAndContinue(): void {
    if (this.isReservationLocked()) {
      return;
    }

    this.profileError.set(null);
    this.phoneSaved.set(false);
    if (this.phoneControl.invalid) {
      this.phoneControl.markAsTouched();
      return;
    }

    this.bookingOperation.set('checking-session');
    this.authApi.me().subscribe({
      next: (identity) => {
        if (identity === null) {
          this.bookingOperation.set(null);
          this.continueState.set('anonymous');
          this.profileError.set(
            'Tu sesión ya no está activa. Inicia sesión para continuar.',
          );
          return;
        }

        if (!identity.roles.includes('CUSTOMER')) {
          this.bookingOperation.set(null);
          this.continueState.set('not-customer');
          this.profileError.set(
            'Esta cuenta no puede crear reservas online.',
          );
          return;
        }

        const telefono = this.phoneControl.value.trim();
        this.bookingOperation.set('updating-profile');
        this.authApi
          .updateProfile({ nombre: identity.nombre, telefono })
          .subscribe({
            next: (updatedIdentity) => {
              this.bookingOperation.set(null);
              if (
                updatedIdentity.telefono === null ||
                updatedIdentity.telefono.trim() === ''
              ) {
                this.profileError.set(
                  'No se pudo confirmar el teléfono guardado. No se ha enviado la reserva.',
                );
                return;
              }

              this.phoneControl.reset('');
              this.phoneSaved.set(true);
              this.continueState.set('ready');
            },
            error: (error: unknown) => {
              this.bookingOperation.set(null);
              this.handleProfileError(error);
            },
          });
      },
      error: (error: unknown) => {
        this.bookingOperation.set(null);
        this.profileError.set(this.sessionCheckErrorMessage(error));
        this.continueState.set('error');
      },
    });
  }

  protected confirmReservation(): void {
    if (!this.canSubmitReservation()) {
      return;
    }

    const draft = this.createReservationDraft();
    if (draft === null) {
      this.continueState.set('draft-invalid');
      return;
    }

    this.bookingError.set(null);
    this.csrfRefreshMessage.set(null);
    this.bookingOperation.set('checking-session');
    this.authApi.me().subscribe({
      next: (identity) => {
        if (identity === null) {
          this.bookingOperation.set(null);
          this.continueState.set('anonymous');
          this.bookingError.set(
            'Tu sesión ha caducado. Inicia sesión para conservar y continuar con esta selección.',
          );
          return;
        }

        if (!identity.roles.includes('CUSTOMER')) {
          this.bookingOperation.set(null);
          this.continueState.set('not-customer');
          this.bookingError.set(
            'Esta cuenta no tiene permisos para crear reservas online.',
          );
          return;
        }

        if (
          identity.telefono === null ||
          identity.telefono.trim() === ''
        ) {
          this.bookingOperation.set(null);
          this.continueState.set('phone-required');
          this.bookingError.set(
            'Completa el teléfono de tu perfil para continuar con este flujo.',
          );
          return;
        }

        this.revalidateAvailabilityAndCreate(draft);
      },
      error: (error: unknown) => {
        this.bookingOperation.set(null);
        this.continueState.set('error');
        this.bookingError.set(this.sessionCheckErrorMessage(error));
      },
    });
  }

  private revalidateAvailabilityAndCreate(draft: ReservationDraft): void {
    this.bookingOperation.set('checking-availability');
    this.disponibilidadApi
      .getDisponibilidad({
        profesionalId: draft.profesionalId,
        desde: draft.fecha,
        hasta: draft.fecha,
        servicioIds: [draft.servicioId],
      })
      .subscribe({
        next: (availability) => {
          this.availability.set(availability);
          this.availabilityState.set(
            availability.dias.length > 0 ? 'success' : 'empty',
          );
          const stillAvailable =
            availability.profesionalId === draft.profesionalId &&
            availability.dias.some(
              (day) =>
                day.fecha === draft.fecha &&
                day.inicios.includes(draft.empiezaEn),
            );
          if (!stillAvailable) {
            this.bookingOperation.set(null);
            this.selectedStart.set(null);
            this.continueState.set('slot-stale');
            this.bookingError.set(
              'Ese horario ya no aparece disponible. Elige otra hora para continuar.',
            );
            return;
          }

          const request: CrearReservaRequest = {
            profesionalId: draft.profesionalId,
            servicioIds: [draft.servicioId],
            empiezaEn: draft.empiezaEn,
            aceptaCondiciones: true,
          };
          this.createReservation(request, draft);
        },
        error: (error: unknown) => {
          this.bookingOperation.set(null);
          this.continueState.set('failed');
          this.bookingError.set(this.availabilityRevalidationError(error));
        },
      });
  }

  private createReservation(
    request: CrearReservaRequest,
    draft: ReservationDraft,
  ): void {
    this.bookingOperation.set('creating');
    this.reservasApi.createReserva(request).subscribe({
      next: (response) => {
        if (
          response.status !== 201 ||
          !isReservaResponse(response.body) ||
          response.body.profesionalId !== draft.profesionalId
        ) {
          this.bookingOperation.set(null);
          this.markReservationOutcomeUncertain(
            'El servidor respondió, pero no se pudo verificar la confirmación. Comprueba tus reservas por otro canal o contacta con la barbería antes de volver a intentarlo.',
          );
          return;
        }

        this.bookingOperation.set(null);
        this.bookingError.set(null);
        this.reservationResult.set(response.body);
        this.continueState.set('success');
      },
      error: (error: unknown) => {
        this.bookingOperation.set(null);
        this.handleReservationError(error);
      },
    });
  }

  private handleReservationError(error: unknown): void {
    if (!(error instanceof HttpErrorResponse)) {
      this.markReservationOutcomeUncertain(
        'No se pudo confirmar el resultado de la reserva. Puede haberse creado o no. Comprueba tus reservas por otro canal o contacta con la barbería antes de volver a intentarlo.',
      );
      return;
    }

    if (
      error.status === 0 ||
      error.status >= 500 ||
      ![400, 401, 403, 404, 409].includes(error.status)
    ) {
      this.markReservationOutcomeUncertain(
        'No se pudo confirmar el resultado de la reserva. Puede haberse creado o no. Comprueba tus reservas por otro canal o contacta con la barbería antes de volver a intentarlo.',
      );
      return;
    }

    switch (error.status) {
      case 400:
        this.continueState.set('failed');
        this.bookingError.set(
          'No se pudo crear la reserva porque algún dato o regla no es válido. Revisa la selección y vuelve a intentarlo.',
        );
        break;
      case 401:
        this.recheckSessionAfterUnauthorized();
        break;
      case 403:
        this.continueState.set('failed');
        this.csrfRefreshAvailable.set(true);
        this.csrfRefreshMessage.set(null);
        this.bookingError.set(
          'No se pudo autorizar la solicitud. Puede ser un problema de permisos o de seguridad; tu sesión no se ha cerrado.',
        );
        break;
      case 404:
        this.continueState.set('failed');
        this.bookingError.set(
          'El servicio o el profesional ya no está disponible. Revisa la selección antes de continuar.',
        );
        break;
      case 409:
        this.continueState.set('slot-stale');
        this.bookingError.set(
          'No se pudo completar la reserva. Revisa la disponibilidad y vuelve a elegir una hora.',
        );
        this.selectedStart.set(null);
        this.loadAvailability();
        break;
    }
  }

  private markReservationOutcomeUncertain(message: string): void {
    this.reservationOutcomeUncertain.set(true);
    this.continueState.set('uncertain');
    this.bookingError.set(message);
  }

  private recheckSessionAfterUnauthorized(): void {
    this.bookingOperation.set('checking-session');
    this.authApi.me().subscribe({
      next: (identity) => {
        this.bookingOperation.set(null);
        if (identity === null) {
          this.continueState.set('anonymous');
          this.bookingError.set(
            'Tu sesión ha caducado. Inicia sesión para conservar y continuar con esta selección.',
          );
          return;
        }

        this.continueState.set('failed');
        this.bookingError.set(
          'No se pudo autorizar la reserva. La sesión sigue activa, pero no se ha repetido el envío.',
        );
      },
      error: () => {
        this.bookingOperation.set(null);
        this.continueState.set('error');
        this.bookingError.set(
          'No se pudo comprobar el estado de la sesión. No se ha repetido el envío.',
        );
      },
    });
  }

  private handleProfileError(error: unknown): void {
    if (error instanceof HttpErrorResponse) {
      if (error.status === 401) {
        this.recheckSessionAfterUnauthorized();
        this.profileError.set(
          'No se pudo actualizar el perfil porque la sesión puede haber caducado.',
        );
        return;
      }

      if (error.status === 400) {
        this.profileError.set(
          'No se pudo guardar el teléfono. Revisa el valor e inténtalo de nuevo.',
        );
        return;
      }

      if (error.status === 403) {
        this.profileError.set(
          'No se pudo autorizar la actualización del perfil. Tu sesión no se ha cerrado.',
        );
        return;
      }

      if (error.status === 0) {
        this.profileError.set(
          'No se pudo confirmar si el teléfono se guardó. No se ha enviado la reserva; vuelve a comprobar el perfil antes de reintentarlo.',
        );
        return;
      }
    }

    this.profileError.set(
      'No se pudo actualizar el perfil. No se ha enviado la reserva.',
    );
  }

  private sessionCheckErrorMessage(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 403) {
      return 'No se pudo verificar la autorización de la sesión. No se ha enviado la reserva.';
    }

    return 'No se pudo comprobar la sesión. No se ha enviado la reserva; inténtalo de nuevo.';
  }

  private availabilityRevalidationError(error: unknown): string {
    if (error instanceof HttpErrorResponse && error.status === 404) {
      return 'El profesional o servicio ya no está disponible. Revisa la selección.';
    }

    if (error instanceof HttpErrorResponse && error.status === 400) {
      return 'No se pudo validar la fecha o selección. Revisa los datos y elige de nuevo.';
    }

    return 'No se pudo volver a comprobar la disponibilidad. No se ha enviado la reserva; inténtalo de nuevo.';
  }

  private resetConfirmationState(): void {
    this.conditionsAccepted.set(false);
    this.bookingError.set(null);
    this.profileError.set(null);
    this.phoneSaved.set(false);
    this.csrfRefreshAvailable.set(false);
    this.csrfRefreshMessage.set(null);
  }

  protected formatStartLabel(start: string): string {
    const match =
      /T(\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?)(Z|[+-]\d{2}:\d{2})$/.exec(start);

    if (!match) {
      return start;
    }

    const offset = match[2] === 'Z' ? 'UTC+00:00' : `UTC${match[2]}`;
    return `${match[1]} ${offset}`;
  }

  private invalidateDateSelection(): void {
    this.cancelAvailabilityRequest();
    this.continueState.set(null);
    this.selectedDate.set(null);
    this.resetTimePresentation();
    this.availability.set(null);
    this.availabilityState.set('idle');
  }

  private cancelPendingDraftRestore(): void {
    if (this.pendingDraft !== null) {
      this.pendingDraft = null;
      this.draftRestoreAttempted = true;
    }
  }

  private restoreDraftWhenCatalogsReady(): void {
    if (
      this.pendingDraft === null ||
      this.draftRestoreAttempted ||
      this.catalogState() === 'loading' ||
      this.professionalsState() === 'loading' ||
      this.catalogState() === 'error' ||
      this.professionalsState() === 'error'
    ) {
      return;
    }

    const draft = this.pendingDraft;
    const hasService = this.services().some(
      (service) => service.id === draft.servicioId,
    );
    const hasProfessional = this.professionals().some(
      (professional) => professional.id === draft.profesionalId,
    );
    if (
      !hasService ||
      !hasProfessional ||
      !this.isBookableDate(draft.fecha)
    ) {
      this.pendingDraft = null;
      this.draftRestoreAttempted = true;
      this.continueState.set('draft-invalid');
      return;
    }

    this.draftRestoreAttempted = true;
    this.pendingDraft = null;
    this.selectedServiceId.set(draft.servicioId);
    this.selectedProfessionalId.set(draft.profesionalId);
    this.selectedDate.set(draft.fecha);
    this.restoredDraftStart = draft.empiezaEn;
    this.loadAvailability();
  }

  private restoreSelectedStartIfAvailable(): void {
    if (this.restoredDraftStart === null) {
      return;
    }

    const restoredStart = this.restoredDraftStart;
    this.restoredDraftStart = null;
    if (this.availableStarts().includes(restoredStart)) {
      this.selectedStart.set(restoredStart);
      return;
    }

    this.continueState.set('draft-invalid');
  }

  private createReservationDraft(): ReservationDraft | null {
    if (!this.canContinue()) {
      return null;
    }

    const servicioId = this.selectedService()?.id;
    const profesionalId = this.selectedProfessional()?.id;
    const fecha = this.selectedDate();
    const empiezaEn = this.selectedStart();
    return servicioId && profesionalId && fecha && empiezaEn
      ? { servicioId, profesionalId, fecha, empiezaEn }
      : null;
  }

  private getVisibleStarts(starts: string[], expanded: boolean): string[] {
    return expanded ? starts : starts.slice(0, MAX_VISIBLE_TIME_OPTIONS);
  }

  private resetTimePresentation(): void {
    this.selectedStart.set(null);
    this.morningExpanded.set(false);
    this.afternoonExpanded.set(false);
  }

  private cancelAvailabilityRequest(): void {
    this.availabilityRequestId += 1;
    this.availabilityRequest?.unsubscribe();
    this.availabilityRequest = null;
  }

  private isBookableDate(date: string): boolean {
    return (
      isCalendarDate(date) &&
      date >= this.dateMin() &&
      date <= this.dateMax()
    );
  }

  protected formatPrice(price: number): string {
    const formattedPrice = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

    return `${formattedPrice} €`;
  }
}
