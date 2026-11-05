import { TestBed } from '@angular/core/testing';
import { provideHttpClient } from '@angular/common/http';
import { HttpTestingController, provideHttpClientTesting } from '@angular/common/http/testing';
import { LiveChanges } from './live-changes';

describe('LiveChanges', () => {
  let live: LiveChanges;
  let http: HttpTestingController;

  beforeEach(() => {
    TestBed.configureTestingModule({ providers: [provideHttpClient(), provideHttpClientTesting()] });
    live = TestBed.inject(LiveChanges);
    http = TestBed.inject(HttpTestingController);
  });

  async function answer(version: string): Promise<void> {
    const done = live.check();
    http.expectOne('/api/v1/changes').flush({ data: { version } });
    await done;
  }

  it('emits only when the company data version changes, never on the first check', async () => {
    let changes = 0;
    live.changed.subscribe(() => changes++);

    await answer('v1'); // first check: remember it
    await answer('v1'); // same: nothing to do
    expect(changes).toBe(0);
    await answer('v2'); // someone changed something
    expect(changes).toBe(1);
    await answer('v2');
    expect(changes).toBe(1);
  });

  it('ignores a failed check and tries again next time', async () => {
    let changes = 0;
    live.changed.subscribe(() => changes++);
    await answer('v1');
    const failed = live.check();
    http.expectOne('/api/v1/changes').flush('down', { status: 503, statusText: 'Unavailable' });
    await failed;
    await answer('v2');
    expect(changes).toBe(1);
  });

  it('forgets the version when stopped (a new login starts fresh)', async () => {
    let changes = 0;
    live.changed.subscribe(() => changes++);
    await answer('v1');
    live.stop();
    await answer('v9'); // first check after stop: remembered, not a change
    expect(changes).toBe(0);
    http.verify();
  });
});
