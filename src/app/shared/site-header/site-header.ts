import { Component, ElementRef, inject, signal } from '@angular/core';
import { NgOptimizedImage } from '@angular/common';
import { RouterLink } from '@angular/router';

@Component({
  imports: [NgOptimizedImage, RouterLink],
  selector: 'app-site-header',
  styleUrl: './site-header.scss',
  templateUrl: './site-header.html',
})
export class SiteHeader {
  protected readonly menuOpen = signal(false);
  private readonly hostElement = inject(ElementRef<HTMLElement>);

  protected readonly links = [
    { label: 'Inicio', fragment: 'inicio' },
    { label: 'Servicios', fragment: 'servicios' },
    { label: 'Horarios', fragment: 'horarios' },
    { label: 'Ubicación', fragment: 'ubicacion' },
    { label: 'Contacto', fragment: 'contacto' },
    { label: 'Mi cita', route: '/reservar' },
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
