import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { SiteHeader } from './site-header';

describe('SiteHeader', () => {
  it('should open and close the mobile navigation', async () => {
    await TestBed.configureTestingModule({
      imports: [SiteHeader],
      providers: [provideRouter([])],
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

    button.click();
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('true');
    const firstLink = fixture.nativeElement.querySelector(
      '.primary-navigation a',
    ) as HTMLAnchorElement;
    firstLink.focus();
    firstLink.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape', bubbles: true }));
    fixture.detectChanges();
    expect(button.getAttribute('aria-expanded')).toBe('false');
    expect(button.getAttribute('aria-expanded')).toBe('false');
  });
});
