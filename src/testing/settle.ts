import { ComponentFixture } from '@angular/core/testing';

/** Change detection (runs ngOnInit), let pending promises/observables finish, change detection again. */
export async function settle<T>(fixture: ComponentFixture<T>): Promise<void> {
  fixture.detectChanges();
  await new Promise((resolve) => setTimeout(resolve));
  fixture.detectChanges();
}
