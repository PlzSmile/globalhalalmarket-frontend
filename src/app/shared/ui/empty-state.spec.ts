import { Component } from '@angular/core';
import { TestBed } from '@angular/core/testing';
import { EmptyState } from './empty-state';

@Component({
  imports: [EmptyState],
  template: `<hs-empty-state icon="box" heading="Add your first product" text="Nothing here yet."><button type="button">Go</button></hs-empty-state>`,
})
class Host {}

describe('EmptyState', () => {
  it('shows the heading, text and the projected action', () => {
    const fixture = TestBed.createComponent(Host);
    fixture.detectChanges();
    const el = fixture.nativeElement as HTMLElement;
    expect(el.querySelector('h2')?.textContent).toContain('Add your first product');
    expect(el.textContent).toContain('Nothing here yet.');
    expect(el.querySelector('button')?.textContent).toContain('Go');
  });
});
