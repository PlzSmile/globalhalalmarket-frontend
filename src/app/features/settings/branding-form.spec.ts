import { TestBed } from '@angular/core/testing';
import { Subject, of } from 'rxjs';
import { vi } from 'vitest';
import { MatIconRegistry } from '@angular/material/icon';
import { FakeMatIconRegistry } from '@angular/material/icon/testing';
import { BrandingForm, logoProblem } from './branding-form';
import { MeApi } from '../../core/api/me-api';
import { AuthService } from '../../core/auth/auth.service';
import { CompanyDetail } from '../../core/models/auth';
import { settle } from '../../../testing/settle';

const company: CompanyDetail = {
  id: 1, name: 'Khan Foods Ltd',
  branding: { logo_url: null, contact_email: 'quality@khan.test', phone: null, website: null, address: '1 High Street, Leeds' },
};

describe('logoProblem', () => {
  it('accepts PNG, JPG and WebP up to 1 MB only (never SVG)', () => {
    expect(logoProblem({ type: 'image/png', size: 200_000 })).toBeNull();
    expect(logoProblem({ type: 'image/webp', size: 1024 * 1024 })).toBeNull();
    expect(logoProblem({ type: 'image/svg+xml', size: 2_000 })).toContain('PNG, JPG or WebP');
    expect(logoProblem({ type: 'image/jpeg', size: 1024 * 1024 + 1 })).toContain('1 MB');
  });
});

describe('BrandingForm', () => {
  function setup(updated: CompanyDetail = { ...company, name: 'Khan Foods UK Ltd' }, uploadLogo = vi.fn(() => of(company))) {
    const updateBranding = vi.fn(() => of(updated));
    const setUser = vi.fn();
    TestBed.configureTestingModule({
      imports: [BrandingForm],
      providers: [
        { provide: MeApi, useValue: { company: () => of(company), updateBranding, uploadLogo } },
        { provide: AuthService, useValue: { user: () => ({ id: 1, name: 'A', email: 'a@khan.test', role: 'owner', email_verified: true, company: { id: 1, name: 'Khan Foods Ltd' } }), setUser } },
        { provide: MatIconRegistry, useClass: FakeMatIconRegistry },
      ],
    });
    const fixture = TestBed.createComponent(BrandingForm);
    fixture.componentRef.setInput('mode', 'setup');
    return { fixture, updateBranding, setUser, uploadLogo };
  }

  it('loads the details and saves them with empty fields as null', async () => {
    const { fixture, updateBranding, setUser } = setup();
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    await settle(fixture);
    const form = fixture.componentInstance['form'];
    expect(form.getRawValue().contact_email).toBe('quality@khan.test');
    form.controls.name.setValue('Khan Foods UK Ltd');

    await fixture.componentInstance.save();

    expect(updateBranding).toHaveBeenCalledWith({ name: 'Khan Foods UK Ltd', contact_email: 'quality@khan.test', phone: null, website: null, address: '1 High Street, Leeds' });
    expect(setUser).toHaveBeenCalled(); // the new company name shows in the menu at once
    expect(saved).toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).toContain('Save and continue');
  });

  it('does not send an invalid email', async () => {
    const { fixture, updateBranding } = setup();
    await settle(fixture);
    fixture.componentInstance['form'].controls.contact_email.setValue('not-an-email');
    await fixture.componentInstance.save();
    expect(updateBranding).not.toHaveBeenCalled();
  });

  it('a new reply-to email is saved at once, with no code to confirm', async () => {
    const { fixture } = setup({ ...company, branding: { ...company.branding!, contact_email: 'orders@khan.test' } });
    const saved = vi.fn();
    fixture.componentInstance.saved.subscribe(saved);
    await settle(fixture);
    fixture.componentInstance['form'].controls.contact_email.setValue('orders@khan.test');

    await fixture.componentInstance.save();
    await settle(fixture);
    expect(saved).toHaveBeenCalled();
    expect((fixture.nativeElement as HTMLElement).textContent).not.toContain('code');
  });

  it('shows a progress bar while the logo uploads', async () => {
    const upload = new Subject<CompanyDetail>();
    const { fixture } = setup(undefined, vi.fn(() => upload));
    await settle(fixture);
    const file = new File([new Uint8Array(10)], 'logo.png', { type: 'image/png' });
    const input = { files: [file], value: 'logo.png' } as unknown as HTMLInputElement;

    const done = fixture.componentInstance.chooseLogo(input);
    await settle(fixture);
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('mat-progress-bar')).not.toBeNull();
    expect(el.textContent).toContain('Uploading your logo');

    upload.next({ ...company, branding: { ...company.branding!, logo_url: '/brand-logo/abc.png' } });
    upload.complete();
    await done;
    await settle(fixture);
    expect(el.querySelector('mat-progress-bar')).toBeNull();
    expect(el.querySelector('.logo__preview img')?.getAttribute('src')).toBe('/brand-logo/abc.png');
  });
});
