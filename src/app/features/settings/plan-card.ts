import { ChangeDetectionStrategy, Component, OnInit, inject, signal } from '@angular/core';
import { DatePipe } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { firstValueFrom } from 'rxjs';
import { MeApi } from '../../core/api/me-api';
import { CompanyAccess } from '../../core/models/auth';

/** Phase 6c: the company's plan and when free access ends (offers and grants are set in the admin panel). */
@Component({
  selector: 'hs-plan-card',
  imports: [DatePipe, MatCardModule],
  template: `
    @if (access(); as a) {
      <mat-card appearance="outlined" class="hs-card">
        <mat-card-header><mat-card-title>Plan</mat-card-title></mat-card-header>
        <mat-card-content>
          @if (a.plan_label && a.free) {
            <p class="plan__line">Free {{ a.plan_label }} plan@if (a.free_until) { until {{ a.free_until | date: 'd MMMM y' }}}</p>
            @if (a.free_until) { <p class="plan__hint">We email you 14 and 3 days before it ends.</p> }
          } @else if (a.plan_label && a.free_until) {
            <p class="plan__line">Your free {{ a.plan_label }} plan ended on {{ a.free_until | date: 'd MMMM y' }}.</p>
          } @else {
            <p class="plan__line">Early access</p>
            <p class="plan__hint">Free while we are in early access.</p>
          }
        </mat-card-content>
      </mat-card>
    }
  `,
  styles: `
    .plan__line { margin: 0; font-weight: var(--weight-medium); }
    .plan__hint { margin: var(--space-1) 0 0; font-size: var(--text-sm); color: var(--color-text-muted); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class PlanCard implements OnInit {
  private readonly api = inject(MeApi);
  protected readonly access = signal<CompanyAccess | null>(null);

  async ngOnInit(): Promise<void> {
    try {
      this.access.set((await firstValueFrom(this.api.company())).access ?? null);
    } catch {
      // The plan is information only; the rest of the page still works.
    }
  }
}
