import { Component } from '@angular/core';

@Component({
  selector: 'app-services-section',
  styleUrl: './services-section.scss',
  templateUrl: './services-section.html',
})
export class ServicesSection {
  // Datos visuales provisionales; se sustituirán por el catálogo confirmado.
  protected readonly services = [
    {
      number: '01',
      name: 'Corte clásico',
      description: 'Un estilo limpio, definido a tu medida.',
      duration: 'Duración por confirmar',
    },
    {
      number: '02',
      name: 'Arreglo de barba',
      description: 'Perfilado y cuidado para un acabado preciso.',
      duration: 'Duración por confirmar',
    },
    {
      number: '03',
      name: 'Corte y barba',
      description: 'Una atención completa para renovar tu estilo.',
      duration: 'Duración por confirmar',
    },
  ];
}
