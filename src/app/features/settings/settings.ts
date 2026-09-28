import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { MarketsTab } from './markets-tab';
import { ProfileTab } from './profile-tab';
import { TeamTab } from './team-tab';

const TABS = ['profile', 'team', 'markets'] as const;

@Component({
  selector: 'hs-settings',
  imports: [MatTabsModule, ProfileTab, TeamTab, MarketsTab],
  template: `
    <h1 class="page-title">Settings</h1>
    <mat-tab-group [selectedIndex]="initialTab" mat-stretch-tabs="false" animationDuration="0ms">
      <mat-tab label="Profile"><hs-profile-tab /></mat-tab>
      <mat-tab label="Team"><hs-team-tab /></mat-tab>
      <mat-tab label="Markets"><hs-markets-tab /></mat-tab>
    </mat-tab-group>
  `,
  styles: `
    .page-title { font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
    :host ::ng-deep .settings-grid { display: grid; gap: var(--space-4); padding-top: var(--space-4); max-width: var(--container-narrow); }
    :host ::ng-deep .settings-form { display: grid; gap: var(--space-2); justify-items: start; }
    :host ::ng-deep .settings-form mat-form-field { width: 100%; }
    :host ::ng-deep .team__invite { margin-inline-start: auto; min-height: 44px; }
    :host ::ng-deep .team__role { min-width: 8rem; }
    :host ::ng-deep .team__invites { list-style: none; margin: 0; padding: 0; display: grid; gap: var(--space-3); }
    :host ::ng-deep .team__invite-row { display: flex; flex-wrap: wrap; align-items: center; justify-content: space-between; gap: var(--space-2);
      padding-block: var(--space-2); border-bottom: 1px solid var(--color-border); }
    :host ::ng-deep .team__invite-actions { display: flex; gap: var(--space-2); }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  /** ?tab=profile|team|markets opens that tab (links from the dashboard); anything else opens Profile. */
  protected readonly initialTab = Math.max(0, TABS.indexOf(inject(ActivatedRoute).snapshot.queryParamMap.get('tab') as (typeof TABS)[number]));
}
