import { ChangeDetectionStrategy, Component, computed, input, output } from '@angular/core';
import { RouterLink } from '@angular/router';
import { MatButtonModule } from '@angular/material/button';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatIconModule } from '@angular/material/icon';
import { OnboardingStep, OnboardingStepKey, StepStatus } from '../../core/models/dashboard';

const STEP_TEXT: Record<OnboardingStepKey, { readonly title: string; readonly text: string }> = {
  markets: { title: 'Choose your export markets', text: 'Pick where you ship: Indonesia, Malaysia and/or the UAE.' },
  team: { title: 'Invite your team', text: 'Add colleagues who look after suppliers and certificates.' },
  products: { title: 'Add your products', text: 'List the products you export.' },
  suppliers: { title: 'Add your suppliers', text: 'Record who supplies each ingredient.' },
  certificates: { title: 'Add certificates', text: "Upload your suppliers' halal certificates (PDF)." },
};

const STATUS_LABEL: Record<StepStatus, string> = { done: 'done', todo: 'to do', coming_soon: 'coming soon' };

@Component({
  selector: 'hs-onboarding-card',
  imports: [RouterLink, MatButtonModule, MatCardModule, MatChipsModule, MatIconModule],
  template: `
    <mat-card appearance="outlined" class="hs-card">
      <mat-card-header>
        <mat-card-title><h2 class="card-title">Getting started</h2></mat-card-title>
        <mat-card-subtitle>{{ doneCount() }} of {{ steps().length }} done</mat-card-subtitle>
      </mat-card-header>
      <mat-card-content>
        <ol class="steps">
          @for (step of steps(); track step.key) {
            <li class="step" [class.step--done]="step.status === 'done'" [class.step--soon]="step.status === 'coming_soon'" [attr.data-test]="'step-' + step.key">
              <mat-icon class="step__icon" [svgIcon]="step.status === 'done' ? 'check' : 'circle'" aria-hidden="true" />
              <div class="step__body">
                <p class="step__title">{{ text[step.key].title }} <span class="visually-hidden">({{ statusLabel[step.status] }})</span></p>
                <p class="step__text">{{ text[step.key].text }}</p>
              </div>
              <div class="step__action">
                @switch (step.status) {
                  @case ('done') { <span class="step__done" aria-hidden="true">Done</span> }
                  @case ('coming_soon') { <mat-chip-set><mat-chip [disableRipple]="true">Coming soon</mat-chip></mat-chip-set> }
                  @default {
                    @if (step.key === 'markets') {
                      @if (canManage()) { <button mat-flat-button type="button" (click)="chooseMarkets.emit()" data-test="choose-markets">Choose</button> }
                      @else { <span class="step__hint">Ask an owner or admin to choose</span> }
                    } @else if (step.key === 'team') {
                      @if (canManage()) { <a mat-stroked-button routerLink="/settings" [queryParams]="{ tab: 'team' }" data-test="invite-team">Invite</a> }
                      @else { <span class="step__hint">Ask an owner or admin to invite colleagues</span> }
                    } @else if (step.key === 'products') {
                      <a mat-stroked-button routerLink="/products" data-test="add-products">Add product</a>
                      @if (canManage()) { <a mat-button routerLink="/import" data-test="import-products">or import a CSV</a> }
                    } @else if (step.key === 'suppliers') {
                      <a mat-stroked-button routerLink="/suppliers" data-test="add-suppliers">Add supplier</a>
                    } @else if (step.key === 'certificates') {
                      <a mat-stroked-button routerLink="/certificates" data-test="add-certificates">Add certificate</a>
                    }
                  }
                }
              </div>
            </li>
          }
        </ol>
      </mat-card-content>
    </mat-card>
  `,
  styles: `
    .card-title { font-size: var(--text-xl); }
    .steps { list-style: none; margin: 0; padding: 0; display: grid; }
    .step { display: grid; grid-template-columns: auto minmax(0, 1fr); gap: var(--space-2) var(--space-3); align-items: start;
      padding-block: var(--space-3); border-bottom: 1px solid var(--color-border); }
    .step:last-child { border-bottom: 0; }
    .step__icon { color: var(--color-text-subtle); }
    .step--done .step__icon { color: var(--color-success-fg); }
    .step__title { font-weight: var(--weight-semibold); }
    .step--done .step__title { color: var(--color-text-muted); }
    .step--soon .step__title, .step--soon .step__text { color: var(--color-text-subtle); }
    .step__text, .step__hint { color: var(--color-text-muted); font-size: var(--text-sm); }
    .step__done { color: var(--color-success-fg); font-weight: var(--weight-semibold); font-size: var(--text-sm); }
    .step__action { grid-column: 2; display: flex; flex-wrap: wrap; gap: var(--space-2); }
    .step__action a, .step__action button { min-height: 44px; width: 100%; }
    @media (min-width: 768px) {
      .step { grid-template-columns: auto minmax(0, 1fr) auto; align-items: center; }
      .step__action { grid-column: 3; }
      .step__action a, .step__action button { width: auto; }
    }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class OnboardingCard {
  readonly steps = input.required<readonly OnboardingStep[]>();
  readonly canManage = input(false);
  readonly chooseMarkets = output<void>();

  protected readonly text = STEP_TEXT;
  protected readonly statusLabel = STATUS_LABEL;
  protected readonly doneCount = computed(() => this.steps().filter((s) => s.status === 'done').length);
}
