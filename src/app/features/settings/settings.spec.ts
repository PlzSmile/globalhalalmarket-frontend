import { TestBed } from '@angular/core/testing';
import { ActivatedRoute, convertToParamMap } from '@angular/router';
import { Settings } from './settings';

function initialTab(tab: string | null): number {
  TestBed.configureTestingModule({
    providers: [{ provide: ActivatedRoute, useValue: { snapshot: { queryParamMap: convertToParamMap(tab ? { tab } : {}) } } }],
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
});
