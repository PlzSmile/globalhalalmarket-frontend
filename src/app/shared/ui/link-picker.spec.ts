import { TestBed } from '@angular/core/testing';
import { of } from 'rxjs';
import { vi } from 'vitest';
import { LinkPicker } from './link-picker';
import { LinkTarget, NamedRef } from '../../core/models/catalogue';

const RESULTS: readonly NamedRef[] = [{ id: 1, name: 'Gelatin' }, { id: 2, name: 'Gelatin powder' }];

function render(excludeIds: readonly number[] = [], busy = false) {
  const search = vi.fn(() => of(RESULTS));
  const fixture = TestBed.createComponent(LinkPicker);
  fixture.componentRef.setInput('label', 'Add ingredient');
  fixture.componentRef.setInput('search', search);
  fixture.componentRef.setInput('excludeIds', excludeIds);
  fixture.componentRef.setInput('busy', busy);
  fixture.detectChanges();
  const picked: LinkTarget[] = [];
  fixture.componentInstance.picked.subscribe((p) => picked.push(p));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return { fixture, search, picked, picker: fixture.componentInstance as unknown as Record<string, any> };
}

describe('LinkPicker', () => {
  beforeEach(() => vi.useFakeTimers());
  afterEach(() => vi.useRealTimers());

  it('searches 250 ms after typing and hides already linked results', () => {
    const { search, picker } = render([2]);
    picker['text'].setValue('gel');
    vi.advanceTimersByTime(249);
    expect(search).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(search).toHaveBeenCalledWith('gel');
    expect(picker['options']()).toEqual([{ id: 1, name: 'Gelatin' }]);
  });

  it('offers "Create" only when no result matches the typed name', () => {
    const { picker } = render();
    picker['text'].setValue(' GELATIN ');
    vi.advanceTimersByTime(250);
    expect(picker['createName']()).toBeNull();
    picker['text'].setValue('Cocoa  butter');
    vi.advanceTimersByTime(250);
    expect(picker['createName']()).toBe('Cocoa butter');
  });

  it('emits the picked id or the new name, then clears', () => {
    const { picker, picked } = render();
    picker['select']({ id: 1, name: 'Gelatin' });
    picker['text'].setValue('Cocoa butter');
    picker['select']({ create: 'Cocoa butter' });
    expect(picked).toEqual([{ id: 1 }, { name: 'Cocoa butter' }]);
    expect(picker['text'].value).toBe('');
  });

  it('ignores picks while busy', () => {
    const { picker, picked } = render([], true);
    picker['select']({ id: 1, name: 'Gelatin' });
    expect(picked).toEqual([]);
    expect(picker['text'].disabled).toBe(true);
  });
});
