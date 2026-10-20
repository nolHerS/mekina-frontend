import { Component, signal } from '@angular/core';

@Component({
  selector: 'app-site-header',
  styleUrl: './site-header.scss',
  templateUrl: './site-header.html',
})
export class SiteHeader {
  protected readonly menuOpen = signal(false);

  protected readonly links = [
    { label: 'Inicio', href: '#inicio' },
    { label: 'Servicios', href: '#servicios' },
    { label: 'Horarios', href: '#horarios' },
    { label: 'Ubicación', href: '#ubicacion' },
    { label: 'Contacto', href: '#contacto' },
    { label: 'Mi cita', href: '#mi-cita' },
  ];

  protected closeMenu(): void {
    this.menuOpen.set(false);
  }
}
