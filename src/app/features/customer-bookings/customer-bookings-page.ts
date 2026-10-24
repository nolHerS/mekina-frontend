import { HttpErrorResponse } from '@angular/common/http';
import {
  afterNextRender,
  Component,
  computed,
  DestroyRef,
  ElementRef,
  inject,
  Injector,
  OnInit,
  signal,
  ViewChild,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { Router, RouterLink } from '@angular/router';
import { AuthApiService, SessionState } from '../../core/auth/auth-api.service';
import { IdentidadResponse } from '../../core/auth/models/identidad-response.model';
import {
  ReservaPropiaResponse,
  ReservasPropiasResponse,
} from '../../core/api/models/reservas-propias-response.model';
import { ReservasApiService } from '../../core/api/reservas-api.service';
import { ReservasPropiasApiService } from '../../core/api/reservas-propias-api.service';
import { SiteFooter } from '../../shared/site-footer/site-footer';
import { SiteHeader } from '../../shared/site-header/site-header';
import { CUSTOMER_BOOKINGS_PATH } from '../auth/auth-return-path';

type PageState =
  | 'checking-session'
  | 'session-error'
  | 'anonymous'
  | 'forbidden'
  | 'loading'
  | 'ready'
  | 'error';

type CancellationFeedback = {
  kind: 'status' | 'error';
  message: string;
  uncertain: boolean;
};

const PAGE_SIZE = 20;
const CURRENCY_FORMATTER = new Intl.NumberFormat('es-ES', {
  style: 'currency',
  currency: 'EUR',
});

@Component({
  imports: [RouterLink, SiteHeader, SiteFooter],
  selector: 'app-customer-bookings-page',
  styleUrl: './customer-bookings-page.scss',
  templateUrl: './customer-bookings-page.html',
})
export class CustomerBookingsPage implements OnInit {
  private readonly authApi = inject(AuthApiService);
  private readonly reservationsApi = inject(ReservasApiService);
  private readonly bookingsApi = inject(ReservasPropiasApiService);
  private readonly destroyRef = inject(DestroyRef);
  private readonly injector = inject(Injector);
  private readonly router = inject(Router);
  private canReadBookings = false;
  private pageToLoad = 0;
  private listRequestId = 0;
  private cancellationRequestId = 0;
  private cancellationTrigger: HTMLButtonElement | null = null;

  @ViewChild('cancelConfirmButton')
  private cancelConfirmButton?: ElementRef<HTMLButtonElement>;

  @ViewChild('cancelDialog')
  private cancelDialog?: ElementRef<HTMLElement>;

  @ViewChild('bookingsHeading')
  private bookingsHeading?: ElementRef<HTMLElement>;

  protected readonly pageState = signal<PageState>('checking-session');
  protected readonly bookings = signal<ReservasPropiasResponse | null>(null);
  protected readonly errorMessage = signal<string | null>(null);
  protected readonly cancellationTarget = signal<ReservaPropiaResponse | null>(null);
  protected readonly cancellationFeedback = signal<CancellationFeedback | null>(null);
  protected readonly cancellationPending = signal(false);
  protected readonly cancellationOutcomeUncertain = signal(false);
  protected readonly actionsDisabled = computed(
    () =>
      this.pageState() === 'loading' ||
      this.cancellationPending() ||
      this.cancellationOutcomeUncertain(),
  );
  protected readonly futureReservations = computed(() =>
    this.sortByStart(
      (this.bookings()?.reservas ?? []).filter(
        (reservation) => Date.parse(reservation.empiezaEn) >= Date.now(),
      ),
      'ascending',
    ),
  );
  protected readonly pastReservations = computed(() =>
    this.sortByStart(
      (this.bookings()?.reservas ?? []).filter(
        (reservation) => Date.parse(reservation.empiezaEn) < Date.now(),
      ),
      'descending',
    ),
  );
  protected readonly hasNextPage = computed(() => {
    const response = this.bookings();
    return response !== null && (response.pagina + 1) * response.limite < response.total;
  });

  ngOnInit(): void {
    this.resolveCurrentSession(this.authApi.sessionState());
  }

  protected retry(): void {
    if (this.pageState() === 'session-error') {
      this.checkSession();
      return;
    }

    if (this.pageState() === 'error') {
      this.loadPage(this.pageToLoad, this.cancellationOutcomeUncertain());
    }
  }

  protected refreshReservations(): void {
    if (this.pageState() === 'loading' || this.cancellationPending()) {
      return;
    }

    const isCheckingUncertainResult = this.cancellationOutcomeUncertain();
    this.cancellationFeedback.set({
      kind: 'status',
      message: isCheckingUncertainResult
        ? 'Consultando la lista actual. La cancelación no se volverá a enviar.'
        : 'Actualizando tus reservas…',
      uncertain: isCheckingUncertainResult,
    });
    this.loadPage(this.pageToLoad, true);
  }

  protected loadPreviousPage(): void {
    const page = this.bookings()?.pagina;
    if (
      page !== undefined &&
      page > 0 &&
      this.pageState() === 'ready' &&
      !this.actionsDisabled()
    ) {
      this.loadPage(page - 1);
    }
  }

  protected loadNextPage(): void {
    const page = this.bookings()?.pagina;
    if (
      page !== undefined &&
      this.hasNextPage() &&
      this.pageState() === 'ready' &&
      !this.actionsDisabled()
    ) {
      this.loadPage(page + 1);
    }
  }

  protected canOfferCancellation(reservation: ReservaPropiaResponse): boolean {
    return reservation.estado === 'PENDING' || reservation.estado === 'CONFIRMED';
  }

  protected requestCancellation(
    reservation: ReservaPropiaResponse,
    event: MouseEvent,
  ): void {
    if (
      !this.canReadBookings ||
      !this.canOfferCancellation(reservation) ||
      this.pageState() !== 'ready' ||
      this.actionsDisabled() ||
      this.cancellationTarget() !== null
    ) {
      return;
    }

    this.cancellationTrigger =
      event.currentTarget instanceof HTMLButtonElement
        ? event.currentTarget
        : null;
    this.cancellationFeedback.set(null);
    this.cancellationTarget.set(reservation);
    afterNextRender(
      () => this.cancelConfirmButton?.nativeElement.focus(),
      { injector: this.injector },
    );
  }

  protected dismissCancellation(): void {
    if (this.cancellationPending() || this.cancellationTarget() === null) {
      return;
    }

    this.closeCancellationDialog(true);
  }

  protected handleDialogBackdropClick(event: MouseEvent): void {
    if (event.target === event.currentTarget) {
      this.dismissCancellation();
    }
  }

  protected handleDialogKeydown(event: KeyboardEvent): void {
    if (event.key === 'Escape') {
      event.preventDefault();
      this.dismissCancellation();
      return;
    }

    if (event.key !== 'Tab') {
      return;
    }

    const dialog = event.currentTarget;
    if (!(dialog instanceof HTMLElement)) {
      return;
    }

    const controls = Array.from(
      dialog.querySelectorAll<HTMLButtonElement>('button:not(:disabled)'),
    );
    if (controls.length === 0) {
      event.preventDefault();
      dialog.focus();
      return;
    }

    const first = controls[0];
    const last = controls[controls.length - 1];
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  protected confirmCancellation(): void {
    const reservation = this.cancellationTarget();
    if (
      reservation === null ||
      this.cancellationPending() ||
      this.cancellationOutcomeUncertain()
    ) {
      return;
    }

    const requestId = ++this.cancellationRequestId;
    this.cancellationPending.set(true);
    this.cancellationFeedback.set(null);
    afterNextRender(
      () => this.cancelDialog?.nativeElement.focus(),
      { injector: this.injector },
    );
    this.reservationsApi
      .cancelarReserva(reservation.id)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.cancellationRequestId) {
            return;
          }

          this.cancellationPending.set(false);
          if (response.status !== 204) {
            this.markCancellationUncertain();
            return;
          }

          this.closeCancellationDialog(false);
          this.cancellationFeedback.set({
            kind: 'status',
            message: 'El servidor confirmó la cancelación. Actualizando tus reservas.',
            uncertain: false,
          });
          this.loadPage(this.pageToLoad);
        },
        error: (error: unknown) => {
          if (requestId !== this.cancellationRequestId) {
            return;
          }

          this.cancellationPending.set(false);
          this.closeCancellationDialog(true);
          this.handleCancellationError(error);
        },
      });
  }

  protected navigateToLogin(event: MouseEvent): void {
    this.navigateToAuth('/login', event);
  }

  protected navigateToRegistration(event: MouseEvent): void {
    this.navigateToAuth('/registro', event);
  }

  protected formatReservationDate(value: string, timeZone: string): string {
    return new Intl.DateTimeFormat('es-ES', {
      dateStyle: 'full',
      timeStyle: 'short',
      timeZone,
    }).format(new Date(value));
  }

  protected formatPrice(value: number): string {
    return CURRENCY_FORMATTER.format(value);
  }

  protected trackReservation(
    _index: number,
    reservation: ReservaPropiaResponse,
  ): string {
    return reservation.id;
  }

  private resolveCurrentSession(state: SessionState): void {
    switch (state.status) {
      case 'loading':
        this.checkSession();
        return;
      case 'error':
        this.pageState.set('session-error');
        this.errorMessage.set('No se pudo comprobar tu sesión. Puedes volver a intentarlo.');
        return;
      case 'anonymous':
        this.canReadBookings = false;
        this.bookings.set(null);
        this.pageState.set('anonymous');
        return;
      case 'authenticated':
        this.authorizeCustomer(state.identity);
        return;
    }
  }

  private checkSession(): void {
    this.pageState.set('checking-session');
    this.errorMessage.set(null);
    this.authApi
      .me()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (identity) => {
          if (identity === null) {
            this.canReadBookings = false;
            this.bookings.set(null);
            this.pageState.set('anonymous');
            return;
          }

          this.authorizeCustomer(identity);
        },
        error: () => {
          this.canReadBookings = false;
          this.bookings.set(null);
          this.pageState.set('session-error');
          this.errorMessage.set(
            'No se pudo comprobar tu sesión. Comprueba tu conexión y vuelve a intentarlo.',
          );
        },
      });
  }

  private authorizeCustomer(identity: IdentidadResponse): void {
    if (!identity.roles.includes('CUSTOMER')) {
      this.canReadBookings = false;
      this.bookings.set(null);
      this.pageState.set('forbidden');
      return;
    }

    this.canReadBookings = true;
    this.loadPage(0);
  }

  private loadPage(page: number, manualRefresh = false): void {
    if (
      !this.canReadBookings ||
      this.pageState() === 'loading' ||
      this.cancellationPending()
    ) {
      return;
    }

    const requestId = ++this.listRequestId;
    this.pageToLoad = page;
    this.pageState.set('loading');
    this.bookings.set(null);
    this.errorMessage.set(null);
    this.bookingsApi
      .getMisReservas(page, PAGE_SIZE)
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (response) => {
          if (requestId !== this.listRequestId) {
            return;
          }

          this.bookings.set(response);
          this.pageToLoad = response.pagina;
          this.pageState.set('ready');
          if (manualRefresh) {
            this.cancellationOutcomeUncertain.set(false);
            this.cancellationFeedback.set({
              kind: 'status',
              message: 'La lista se actualizó desde el servidor. Revisa el estado antes de decidir otra acción.',
              uncertain: false,
            });
          }
        },
        error: (error: unknown) => {
          if (requestId === this.listRequestId) {
            this.handleBookingsError(error);
          }
        },
      });
  }

  private handleBookingsError(error: unknown): void {
    this.bookings.set(null);
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.checkSessionAfterUnauthorized();
      return;
    }

    this.pageState.set('error');
    if (error instanceof HttpErrorResponse && error.status === 403) {
      this.errorMessage.set(
        'Tu sesión no tiene permiso para consultar estas reservas. No se han mostrado datos.',
      );
      return;
    }

    this.errorMessage.set(
      error instanceof HttpErrorResponse && error.status === 0
        ? 'No se pudo conectar con el servicio. Comprueba tu conexión y vuelve a cargar.'
        : 'No se pudieron cargar tus reservas. Vuelve a intentarlo.',
    );
  }

  private checkSessionAfterUnauthorized(): void {
    this.canReadBookings = false;
    this.bookings.set(null);
    this.cancellationFeedback.set(null);
    this.pageState.set('checking-session');
    this.authApi
      .me()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (identity) => {
          if (identity === null) {
            this.pageState.set('anonymous');
            return;
          }

          if (!identity.roles.includes('CUSTOMER')) {
            this.pageState.set('forbidden');
            return;
          }

          this.pageState.set('error');
          this.errorMessage.set(
            'No se pudieron cargar tus reservas. Vuelve a intentarlo.',
          );
        },
        error: () => {
          this.pageState.set('session-error');
          this.errorMessage.set(
            'No se pudo confirmar tu sesión. No se han mostrado datos privados.',
          );
        },
      });
  }

  private handleCancellationError(error: unknown): void {
    if (error instanceof HttpErrorResponse && error.status === 401) {
      this.checkSessionAfterUnauthorized();
      return;
    }

    if (
      !(error instanceof HttpErrorResponse) ||
      error.status === 0 ||
      error.status >= 500 ||
      ![400, 401, 403, 404, 409].includes(error.status)
    ) {
      this.markCancellationUncertain();
      return;
    }

    const messages: Record<number, string> = {
      400: 'No se pudo cancelar la cita porque la solicitud o las reglas actuales no lo permiten.',
      403: 'La operación no se autorizó. Puede ser un problema de permisos o de seguridad; tu sesión no se ha cerrado.',
      404: 'No se encontró la cita. Actualiza tus reservas para comprobar el estado actual.',
      409: 'La cita ya no se puede cancelar en sus condiciones actuales. Actualiza tus reservas antes de decidir qué hacer.',
    };
    this.cancellationFeedback.set({
      kind: 'error',
      message: messages[error.status],
      uncertain: false,
    });
  }

  private markCancellationUncertain(): void {
    this.cancellationOutcomeUncertain.set(true);
    this.cancellationFeedback.set({
      kind: 'error',
      message: 'No se pudo confirmar el resultado de la cancelación. Puede haberse aplicado o no. Consulta tus reservas antes de decidir; no se volverá a enviar automáticamente.',
      uncertain: true,
    });
    this.closeCancellationDialog(true);
  }

  private closeCancellationDialog(restoreFocus: boolean): void {
    this.cancellationTarget.set(null);
    const trigger = this.cancellationTrigger;
    this.cancellationTrigger = null;

    if (!restoreFocus) {
      afterNextRender(
        () => this.bookingsHeading?.nativeElement.focus(),
        { injector: this.injector },
      );
      return;
    }

    afterNextRender(
      () => {
        if (trigger?.isConnected && !trigger.disabled) {
          trigger.focus();
        } else {
          this.bookingsHeading?.nativeElement.focus();
        }
      },
      { injector: this.injector },
    );
  }

  private sortByStart(
    reservations: ReservaPropiaResponse[],
    direction: 'ascending' | 'descending',
  ): ReservaPropiaResponse[] {
    const factor = direction === 'ascending' ? 1 : -1;
    return [...reservations].sort(
      (left, right) =>
        factor *
        (Date.parse(left.empiezaEn) - Date.parse(right.empiezaEn)),
    );
  }

  private navigateToAuth(path: '/login' | '/registro', event: MouseEvent): void {
    if (
      event.button !== 0 ||
      event.ctrlKey ||
      event.metaKey ||
      event.shiftKey ||
      event.altKey
    ) {
      return;
    }

    event.preventDefault();
    void this.router.navigateByUrl(path, {
      state: { returnTo: CUSTOMER_BOOKINGS_PATH },
    });
  }
}
