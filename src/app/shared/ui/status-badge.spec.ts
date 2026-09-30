import { TestBed } from '@angular/core/testing';
import { StatusBadge } from './status-badge';

describe('StatusBadge', () => {
  it('renders the tone class and a readable label', () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', 'red');
    fixture.detectChanges();

    const chip: HTMLElement = fixture.nativeElement.querySelector('.hs-status');
    expect(chip.classList).toContain('hs-status--danger');
    expect(chip.textContent?.trim()).toBe('Action needed');
  });

  it('allows a custom label', () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', 'green');
    fixture.componentRef.setInput('label', 'OK');
    fixture.detectChanges();

    expect(fixture.nativeElement.textContent.trim()).toBe('OK');
  });

  it('reads amber as still valid and shows an optional detail line', () => {
    const fixture = TestBed.createComponent(StatusBadge);
    fixture.componentRef.setInput('status', 'amber');
    fixture.componentRef.setInput('detail', 'Expires 13 Oct 2026 · 13 days');
    fixture.detectChanges();

    expect(fixture.nativeElement.querySelector('.hs-status')?.textContent?.trim()).toBe('Valid · expires soon');
    expect(fixture.nativeElement.querySelector('.hs-status__detail')?.textContent?.trim()).toBe('Expires 13 Oct 2026 · 13 days');
  });
});
