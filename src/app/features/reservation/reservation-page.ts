import { Component, computed, inject, OnInit, signal } from '@angular/core';
import { SiteFooter } from '../../shared/site-footer/site-footer';
import { SiteHeader } from '../../shared/site-header/site-header';
import { ServicioResponse } from '../../core/api/models/servicio-response.model';
import { ServiciosApiService } from '../../core/api/servicios-api.service';

type CatalogState = 'loading' | 'success' | 'empty' | 'error';

@Component({
  imports: [SiteHeader, SiteFooter],
  selector: 'app-reservation-page',
  styleUrl: './reservation-page.scss',
  templateUrl: './reservation-page.html',
})
export class ReservationPage implements OnInit {
  protected readonly services = signal<ServicioResponse[]>([]);
  protected readonly catalogState = signal<CatalogState>('loading');
  protected readonly selectedServiceId = signal<string | null>(null);
  protected readonly selectedService = computed(
    () =>
      this.services().find((service) => service.id === this.selectedServiceId()) ?? null,
  );

  private readonly serviciosApi = inject(ServiciosApiService);

  ngOnInit(): void {
    this.loadServices();
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
    this.selectedServiceId.set(serviceId);
  }

  protected formatPrice(price: number): string {
    const formattedPrice = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

    return `${formattedPrice} €`;
  }
}
