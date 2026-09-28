import { TestBed } from '@angular/core/testing';
import { provideRouter } from '@angular/router';
import { vi } from 'vitest';
import { OnboardingCard } from './onboarding-card';
import { OnboardingStep } from '../../core/models/dashboard';

const STEPS: readonly OnboardingStep[] = [
  { key: 'markets', status: 'todo' },
  { key: 'team', status: 'todo' },
  { key: 'products', status: 'coming_soon' },
  { key: 'suppliers', status: 'coming_soon' },
  { key: 'certificates', status: 'coming_soon' },
];

function render(canManage: boolean, steps: readonly OnboardingStep[] = STEPS) {
  TestBed.configureTestingModule({ providers: [provideRouter([])] });
  const fixture = TestBed.createComponent(OnboardingCard);
  fixture.componentRef.setInput('steps', steps);
  fixture.componentRef.setInput('canManage', canManage);
  fixture.detectChanges();
  return { fixture, el: fixture.nativeElement as HTMLElement };
}

describe('OnboardingCard', () => {
  it('shows all five steps and how many are done', () => {
    const { el } = render(true, [{ key: 'markets', status: 'done' }, ...STEPS.slice(1)]);
    for (const title of ['Choose your export markets', 'Invite your team', 'Add your products', 'Add your suppliers', 'Request certificates']) {
      expect(el.textContent).toContain(title);
    }
    expect(el.textContent).toContain('1 of 5 done');
    expect(el.querySelector('[data-test="step-markets"]')?.textContent).toContain('Done');
  });

  it('gives owners and admins actions, and emits chooseMarkets', () => {
    const { fixture, el } = render(true);
    const choose = vi.fn();
    fixture.componentInstance.chooseMarkets.subscribe(choose);
    (el.querySelector('[data-test="choose-markets"]') as HTMLButtonElement).click();
    expect(choose).toHaveBeenCalled();
    expect(el.querySelector('[data-test="invite-team"]')?.getAttribute('href')).toContain('/settings?tab=team');
  });

  it('tells members to ask an owner or admin, with no buttons', () => {
    const { el } = render(false);
    expect(el.querySelector('[data-test="choose-markets"]')).toBeNull();
    expect(el.querySelector('[data-test="invite-team"]')).toBeNull();
    expect(el.textContent).toContain('Ask an owner or admin to choose');
  });

  it('links the products and suppliers steps when they are to do, for every role', () => {
    const steps: readonly OnboardingStep[] = [
      { key: 'markets', status: 'done' }, { key: 'team', status: 'done' },
      { key: 'products', status: 'todo' }, { key: 'suppliers', status: 'todo' }, { key: 'certificates', status: 'coming_soon' },
    ];
    const { el } = render(false, steps);
    expect(el.querySelector('[data-test="add-products"]')?.getAttribute('href')).toContain('/products');
    expect(el.querySelector('[data-test="add-suppliers"]')?.getAttribute('href')).toContain('/suppliers');
  });

  it('marks later steps as Coming soon without actions', () => {
    const { el } = render(true);
    const products = el.querySelector('[data-test="step-products"]') as HTMLElement;
    expect(products.textContent).toContain('Coming soon');
    expect(products.querySelector('button, a')).toBeNull();
  });
});
