import {
  Component,
  computed,
  inject,
  OnDestroy,
  OnInit,
  signal,
} from '@angular/core';
import { Subscription } from 'rxjs';
import { SiteFooter } from '../../shared/site-footer/site-footer';
import { SiteHeader } from '../../shared/site-header/site-header';
import { DisponibilidadApiService } from '../../core/api/disponibilidad-api.service';
import { DisponibilidadResponse } from '../../core/api/models/disponibilidad-response.model';
import { ProfesionalPublicoResponse } from '../../core/api/models/profesional-publico-response.model';
import { ServicioResponse } from '../../core/api/models/servicio-response.model';
import { ProfesionalesApiService } from '../../core/api/profesionales-api.service';
import { ServiciosApiService } from '../../core/api/servicios-api.service';

type CatalogState = 'loading' | 'success' | 'empty' | 'error';
type AvailabilityState = 'idle' | 'loading' | 'success' | 'empty' | 'error';

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
  imports: [SiteHeader, SiteFooter],
  selector: 'app-reservation-page',
  styleUrl: './reservation-page.scss',
  templateUrl: './reservation-page.html',
})
export class ReservationPage implements OnDestroy, OnInit {
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
  protected readonly continueNotice = signal(false);
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

  private readonly serviciosApi = inject(ServiciosApiService);
  private readonly profesionalesApi = inject(ProfesionalesApiService);
  private readonly disponibilidadApi = inject(DisponibilidadApiService);
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
    this.catalogState.set('loading');
    this.serviciosApi.getServicios().subscribe({
      next: (services) => {
        this.services.set(services);
        this.catalogState.set(services.length > 0 ? 'success' : 'empty');
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar el catálogo para la reserva.', error);
        this.catalogState.set('error');
      },
    });
  }

  protected selectService(serviceId: string): void {
    if (this.selectedServiceId() === serviceId) {
      return;
    }

    this.continueNotice.set(false);
    this.selectedServiceId.set(serviceId);
    this.invalidateDateSelection();
  }

  protected loadProfessionals(): void {
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
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar la lista pública de profesionales.', error);
        this.professionalsState.set('error');
      },
    });
  }

  protected selectProfessional(professionalId: string): void {
    if (this.selectedProfessionalId() === professionalId) {
      return;
    }

    this.continueNotice.set(false);
    this.selectedProfessionalId.set(professionalId);
    this.invalidateDateSelection();
  }

  protected selectDate(event: Event): void {
    if (!(event.target instanceof HTMLInputElement)) {
      return;
    }

    const date = event.target.value;
    this.continueNotice.set(false);
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
          this.availabilityRequest = null;
        },
        error: (error: unknown) => {
          if (requestId !== this.availabilityRequestId) {
            return;
          }

          console.error('No se pudo consultar la disponibilidad.', error);
          this.availabilityState.set('error');
          this.availabilityRequest = null;
        },
      });
  }

  protected selectStart(start: string): void {
    if (this.availableStarts().includes(start)) {
      this.continueNotice.set(false);
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
    if (this.canContinue()) {
      this.continueNotice.set(true);
    }
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
    this.continueNotice.set(false);
    this.selectedDate.set(null);
    this.resetTimePresentation();
    this.availability.set(null);
    this.availabilityState.set('idle');
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
