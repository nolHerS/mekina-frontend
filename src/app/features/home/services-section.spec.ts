import { TestBed } from '@angular/core/testing';
import { ServicesSection } from './services-section';

describe('ServicesSection', () => {
  it('should show sample services with clearly provisional prices and durations', async () => {
    await TestBed.configureTestingModule({
      imports: [ServicesSection],
    }).compileComponents();

    const fixture = TestBed.createComponent(ServicesSection);
    fixture.detectChanges();

    const cards = fixture.nativeElement.querySelectorAll('.service-card') as NodeListOf<HTMLElement>;

    expect(cards.length).toBe(3);
    expect(cards[0].querySelector('h3')?.textContent).toContain('Corte clásico');

    for (const card of cards) {
      expect([...card.querySelectorAll('dt')].map((label) => label.textContent?.trim())).toEqual([
        'Duración',
        'Precio',
      ]);
      expect([...card.querySelectorAll('dd')].map((value) => value.textContent?.trim())).toEqual([
        'Por confirmar',
        'Por confirmar',
      ]);
    }
  });
});
