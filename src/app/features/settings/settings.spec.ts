import { TestBed } from '@angular/core/testing';
import { signal } from '@angular/core';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Settings } from './settings';
import { AuthService } from '../../core/auth/auth.service';

function initialTab(tab: string | null): number {
  TestBed.configureTestingModule({
    providers: [
      { provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(tab ? { tab } : {}) } } },
      { provide: AuthService, useValue: { canManageTeam: signal(true) } },
    ],
  });
  TestBed.overrideComponent(Settings, { set: { template: '', imports: [] } });
  return TestBed.createComponent(Settings).componentInstance['initialTab'];
}

describe('Settings', () => {
  it('opens the tab named in ?tab=', () => {
    expect(initialTab('markets')).toBe(2);
  });

  it('opens Team for ?tab=team and Profile otherwise', () => {
    expect(initialTab('team')).toBe(1);
    TestBed.resetTestingModule();
    expect(initialTab('nonsense')).toBe(0);
  });

  it('opens Activity for ?tab=activity (Phase 7)', () => {
    expect(initialTab('activity')).toBe(5);
  });
});
