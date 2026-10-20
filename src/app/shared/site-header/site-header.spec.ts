import { TestBed } from '@angular/core/testing';
import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  it('should open and close the mobile navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [SiteHeader],
    }).compileComponents();

    const fixture = TestBed.createComponent(SiteHeader);
    fixture.detectChanges();
    const button = fixture.nativeElement.querySelector('.menu-toggle') as HTMLButtonElement;

    expect(button.getAttribute('aria-expanded')).toBe('false');

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');

    fixture.nativeElement.querySelector('.primary-navigation a').click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
