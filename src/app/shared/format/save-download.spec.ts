import { HttpHeaders, HttpResponse } from '@angular/common/http';
import { vi } from 'vitest';
import { downloadName, saveDownload } from './save-download';

function response(disposition: string | null): HttpResponse<Blob> {
  const headers = disposition === null ? new HttpHeaders() : new HttpHeaders({ 'Content-Disposition': disposition });
  return new HttpResponse({ body: new Blob(['x']), headers });
}

describe('save-download', () => {
  it('takes the file name from Content-Disposition, quoted or not, else the fallback', () => {
    expect(downloadName(response('attachment; filename="audit-pack-bs-1-jakim-2026-10-24.zip"'), 'x.zip')).toBe('audit-pack-bs-1-jakim-2026-10-24.zip');
    expect(downloadName(response('attachment; filename=audit-pack.zip'), 'x.zip')).toBe('audit-pack.zip');
    expect(downloadName(response(null), 'fallback.zip')).toBe('fallback.zip');
  });

  it('saves the file through a temporary link', () => {
    const createUrl = vi.fn(() => 'blob:demo');
    Object.assign(URL, { createObjectURL: createUrl, revokeObjectURL: vi.fn() });
    const click = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => undefined);

    saveDownload(response('attachment; filename="pack.zip"'), 'x.zip');

    expect(createUrl).toHaveBeenCalled();
    expect(click).toHaveBeenCalledTimes(1);
    click.mockRestore();
  });
});
