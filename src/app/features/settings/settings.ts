import { ChangeDetectionStrategy, Component, inject } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { MatTabsModule } from '@angular/material/tabs';
import { ProfileTab } from './profile-tab';

@Component({
  selector: 'hs-settings',
  imports: [MatTabsModule, ProfileTab],
  template: `
    <h1 class="page-title">Settings</h1>
    <mat-tab-group [selectedIndex]="initialTab" mat-stretch-tabs="false" animationDuration="0ms">
      <mat-tab label="Profile"><hs-profile-tab /></mat-tab>
    </mat-tab-group>
  `,
  styles: `
    .page-title { font-size: var(--text-2xl); margin: 0 0 var(--space-4); }
    :host ::ng-deep .settings-grid { display: grid; gap: var(--space-4); padding-top: var(--space-4); max-width: var(--container-narrow); }
    :host ::ng-deep .settings-form { display: grid; gap: var(--space-2); justify-items: start; }
    :host ::ng-deep .settings-form mat-form-field { width: 100%; }
  `,
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class Settings {
  protected readonly initialTab = inject(ActivatedRoute).snapshot.queryParamMap.get('tab') === 'team' ? 1 : 0;
}
