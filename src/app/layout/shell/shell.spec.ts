import { TestBed } from '@angular/core/testing';
import { Router, provideRouter } from '@angular/router';
import { signal } from '@angular/core';
import { vi } from 'vitest';
import { Shell, initials } from './shell';
import { AuthService } from '../../core/auth/auth.service';

describe('Shell', () => {
  const auth = {
    user: signal({ id: 1, name: 'Aisha', email: 'aisha@example.com', role: 'owner', email_verified: true, company: { id: 5, name: 'Khan Foods' } }),
    logout: vi.fn().mockResolvedValue(undefined),
  };

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideRouter([]), { provide: AuthService, useValue: auth }] });
  });

  it('shows the real company name', () => {
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.switcher__name').textContent).toContain('Khan Foods');
  });

  it('logs out and goes to the login page', async () => {
    const navigate = vi.spyOn(TestBed.inject(Router), 'navigateByUrl').mockResolvedValue(true);
    const fixture = TestBed.createComponent(Shell);
    await fixture.componentInstance.logout();
    expect(auth.logout).toHaveBeenCalled();
    expect(navigate).toHaveBeenCalledWith('/login');
  });

  it('shows the first letters of the first and last name in the profile button', () => {
    expect(initials('Aisha Khan')).toBe('AK');
    expect(initials('  bilal ahmed haider ')).toBe('BH');
    expect(initials('Aisha')).toBe('A');
    expect(initials(null)).toBe('?');
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('[data-test="avatar"]').textContent.trim()).toBe('A');
  });

  it('makes the sidebar slim and full again from the round button, and remembers it', () => {
    localStorage.removeItem('hs-sidebar-slim');
    const fixture = TestBed.createComponent(Shell);
    const shell = fixture.componentInstance as unknown as { isWide: () => boolean; slimChosen: { set(v: boolean): void } };
    fixture.detectChanges();
    const container: HTMLElement = fixture.nativeElement.querySelector('.shell');
    const toggle: HTMLButtonElement = fixture.nativeElement.querySelector('[data-test="sidebar-toggle"]');
    // jsdom has no wide screen: the rail starts slim and the button lays the full menu over the page
    expect(shell.isWide()).toBe(false);
    expect(container.classList).toContain('is-slim');
    toggle.click();
    fixture.detectChanges();
    expect(container.classList).not.toContain('is-slim');
    expect(container.classList).toContain('is-overlay');
    expect(toggle.getAttribute('aria-expanded')).toBe('true');
    document.dispatchEvent(new KeyboardEvent('keydown', { key: 'Escape' }));
    fixture.detectChanges();
    expect(container.classList).toContain('is-slim');
  });

  it('slides the green pill to the page being opened', async () => {
    const fixture = TestBed.createComponent(Shell);
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.shell__pill')).toBeNull(); // no tracker page open yet
    TestBed.inject(Router).resetConfig([{ path: 'suppliers', children: [] }]);
    await TestBed.inject(Router).navigateByUrl('/suppliers');
    fixture.detectChanges();
    expect(fixture.nativeElement.querySelector('.shell__pill').style.transform).toBe('translateY(100px)');
    const current = fixture.nativeElement.querySelector('.shell__nav a[aria-current="page"]');
    expect(current.textContent).toContain('Suppliers'); // the white label follows the same page as the pill
  });
});
