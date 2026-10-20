import { Component, ElementRef, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';

@Component({
  imports: [NgOptimizedImage],
  selector: 'app-site-header',
  styleUrl: './site-header.scss',
  templateUrl: './site-header.html',
})
export class SiteHeader {
  protected readonly menuOpen = signal(false);
  private readonly hostElement = inject(ElementRef<HTMLElement>);

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

  protected handleEscape(): void {
    if (!this.menuOpen()) {
      return;
    }

    const host: HTMLElement = this.hostElement.nativeElement;
    const toggle = host.querySelector<HTMLButtonElement>('.menu-toggle');
    toggle?.focus();
    this.closeMenu();
  }
}
