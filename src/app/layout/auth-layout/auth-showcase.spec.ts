import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { MatIconRegistry } from '@angular/material/icon';
import { FakeMatIconRegistry } from '@angular/material/icon/testing';
import { AuthShowcase } from './auth-showcase';

describe('AuthShowcase', () => {
  function setup(compact: boolean) {
    TestBed.configureTestingModule({
      imports: [AuthShowcase],
      providers: [provideHttpClient(), provideHttpClientTesting(), { provide: MatIconRegistry, useClass: FakeMatIconRegistry }],
    });
    const fixture = TestBed.createComponent(AuthShowcase);
    fixture.componentRef.setInput('compact', compact);
    fixture.detectChanges();
    TestBed.inject(HttpTestingController).expectOne('/api/v1/highlights').flush({ data: {
      bodies: 3,
      markets: [{ name: 'BPJPH', recognised: 12 }, { name: 'JAKIM', recognised: 8 }, { name: 'MoIAT', recognised: 5 }],
      changes: [{ body: 'Test Halal Board', country: 'Spain', market: 'MoIAT', label: 'Renewed', tone: 'success', date: '2026-11-10', url: 'https://globalhalalmarket.com/bodies/test' }],
    } });
    fixture.detectChanges();
    return fixture.nativeElement as HTMLElement;
  }

  it('shows the market counts and the latest list changes', () => {
    const el = setup(false);
    expect([...el.querySelectorAll('.card__num')].map((n) => n.textContent?.trim())).toEqual(['12', '8', '5']);
    expect(el.textContent).toContain('Test Halal Board');
    expect(el.querySelector('.change__tag--success')?.textContent).toContain('Renewed');
    expect(el.querySelector('.net')?.getAttribute('aria-label')).toContain('Indonesia (BPJPH), 12 recognised bodies');
    expect(el.querySelectorAll('.net__link').length).toBe(3);
  });

  it('compact strip shows only the three counts', () => {
    const el = setup(true);
    expect(el.querySelectorAll('.strip li').length).toBe(3);
    expect(el.textContent).toContain('8');
    expect(el.textContent).not.toContain('Test Halal Board');
  });
});
