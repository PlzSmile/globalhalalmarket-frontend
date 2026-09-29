import { TestBed } from '@angular/core/testing';
import { vi } from 'vitest';
import { FilePicker } from './file-picker';

function render(maxBytes = 1000) {
  const fixture = TestBed.createComponent(FilePicker);
  fixture.componentRef.setInput('maxBytes', maxBytes);
  fixture.detectChanges();
  const changes = vi.fn();
  fixture.componentInstance.fileChange.subscribe(changes);
  return { fixture, changes, el: fixture.nativeElement as HTMLElement };
}

describe('FilePicker', () => {
  it('accepts a PDF and shows its name and size', () => {
    const { fixture, changes, el } = render();
    const pdf = new File(['%PDF-1.4'], 'cert.pdf', { type: 'application/pdf' });
    fixture.componentInstance.pick(pdf);
    fixture.detectChanges();
    expect(changes).toHaveBeenCalledWith(pdf);
    expect(el.querySelector('[data-test="file-name"]')?.textContent).toContain('cert.pdf');
  });

  it('refuses other types, empty and oversized files', () => {
    const { fixture, changes, el } = render(10);
    fixture.componentInstance.pick(new File(['x'], 'photo.jpg', { type: 'image/jpeg' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('Choose a PDF file.');
    fixture.componentInstance.pick(new File([''], 'empty.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('The file is empty.');
    fixture.componentInstance.pick(new File(['%PDF-1.4 more than ten bytes'], 'big.pdf', { type: 'application/pdf' }));
    fixture.detectChanges();
    expect(el.textContent).toContain('The file is larger than 10 MB.');
    expect(changes).toHaveBeenLastCalledWith(null);
  });
});
