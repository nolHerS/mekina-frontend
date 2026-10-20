import { Component } from '@angular/core';
import { SiteHeader } from '../../shared/site-header/site-header';

@Component({
  imports: [SiteHeader],
  selector: 'app-home-page',
  styleUrl: './home-page.scss',
  templateUrl: './home-page.html',
})
export class HomePageComponent {
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
