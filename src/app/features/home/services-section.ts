import { Component, inject, OnInit, signal } from '@angular/core';
import { ServicioResponse } from '../../core/api/models/servicio-response.model';
import { ServiciosApiService } from '../../core/api/servicios-api.service';

@Component({
  selector: 'app-services-section',
  styleUrl: './services-section.scss',
  templateUrl: './services-section.html',
})
export class ServicesSection implements OnInit {
  protected readonly services = signal<ServicioResponse[]>([]);
  protected readonly catalogState = signal<'loading' | 'success' | 'empty' | 'error'>('loading');

  private readonly serviciosApi = inject(ServiciosApiService);

  ngOnInit(): void {
    this.serviciosApi.getServicios().subscribe({
      next: (services) => {
        this.services.set(services);
        this.catalogState.set(services.length > 0 ? 'success' : 'empty');
      },
      error: (error: unknown) => {
        console.error('No se pudo cargar el catálogo de servicios.', error);
        this.catalogState.set('error');
      },
    });
  }

  protected formatPrice(price: number): string {
    const formattedPrice = new Intl.NumberFormat('es-ES', {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);

    return `${formattedPrice} €`;
  }
}
