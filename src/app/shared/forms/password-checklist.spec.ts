import { Component, signal } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { provideHttpClientTesting } from '@angular/common/http/testing';
import { PasswordChecklist } from './password-checklist';

@Component({
  imports: [PasswordChecklist],
  template: `<hs-password-checklist [password]="password()" [confirmation]="confirmation()" />`,
})
class Host {
  readonly password = signal<string | null>('');
  readonly confirmation = signal('');
}

describe('PasswordChecklist', () => {
  beforeEach(() => TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] }));

  it('ticks the length and shows the strength while typing', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.textContent).toContain('Strength: not set');
    expect(el.querySelector('[data-test="pc-length"]')?.classList.contains('ok')).toBe(false);

    fixture.componentInstance.password.set('Orchard 7 lemon trees');
    fixture.detectChanges();
    expect(el.textContent).toContain('Strength: strong');
    expect(el.textContent).toContain('(21/12)');
    expect(el.querySelector('[data-test="pc-length"]')?.classList.contains('ok')).toBe(true);
    expect(el.querySelector('[data-test="pc-match"]')).toBeNull();
  });

  it('shows whether both passwords match once the second is typed', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.password.set('orchardlemon');
    fixture.componentInstance.confirmation.set('orchardlemo');
    fixture.detectChanges();
    const match = () => (fixture.nativeElement as HTMLElement).querySelector('[data-test="pc-match"]');
    expect(match()?.classList.contains('ok')).toBe(false);

    fixture.componentInstance.confirmation.set('orchardlemon');
    fixture.detectChanges();
    expect(match()?.classList.contains('ok')).toBe(true);
  });

  it('copes with a reset form (null value)', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.componentInstance.password.set(null);
    fixture.detectChanges();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Strength: not set');
  });
});
