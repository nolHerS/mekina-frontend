import { TestBed } from '@angular/core/testing';
import { VisitInformation } from './visit-information';

describe('VisitInformation', () => {
  it('shows the confirmed weekly hours and address', async () => {
    await TestBed.configureTestingModule({
      imports: [VisitInformation],
    }).compileComponents();

    const fixture = TestBed.createComponent(VisitInformation);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;

    expect(root.textContent).toContain('De lunes a sábado');
    expect(root.textContent).toContain('Mañana');
    expect(root.textContent).toContain('10:00–14:00');
    expect(root.textContent).toContain('Tarde');
    expect(root.textContent).toContain('17:00–21:00');
    expect(root.textContent).toContain('Calle Carmen 7A');
    expect(root.textContent).toContain(
      'Villafranca de los Barros, Badajoz',
    );
    expect(root.textContent).not.toContain('domingo');
    expect(root.textContent).not.toContain('Pendiente de confirmación');
  });

  it('links the confirmed address and Instagram profile with safe new-tab attributes', async () => {
    await TestBed.configureTestingModule({
      imports: [VisitInformation],
    }).compileComponents();

    const fixture = TestBed.createComponent(VisitInformation);
    fixture.detectChanges();
    const root = fixture.nativeElement as HTMLElement;
    const mapsLink = root.querySelector(
      'a[href^="https://www.google.com/maps/search/"]',
    ) as HTMLAnchorElement;
    const instagramLink = root.querySelector(
      'a[href="https://www.instagram.com/mekina_barberia/"]',
    ) as HTMLAnchorElement;

    expect(new URL(mapsLink.href).searchParams.get('query')).toBe(
      'Calle Carmen 7A, Villafranca de los Barros, Badajoz',
    );
    expect(mapsLink.target).toBe('_blank');
    expect(mapsLink.rel).toContain('noopener');
    expect(instagramLink.textContent).toContain('@mekina_barberia');
    expect(instagramLink.target).toBe('_blank');
    expect(instagramLink.rel).toContain('noopener');
    expect(instagramLink.getAttribute('aria-label')).toContain(
      'abre en una pestaña nueva',
    );
  });
});
