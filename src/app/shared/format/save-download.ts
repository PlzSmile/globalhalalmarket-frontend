import { HttpResponse } from '@angular/common/http';

/** The file name from Content-Disposition (attachment; filename="x.zip"), or the fallback. */
export function downloadName(response: HttpResponse<Blob>, fallback: string): string {
  const header = response.headers.get('Content-Disposition') ?? '';
  const match = /filename\*?=(?:UTF-8'')?"?([^";]+)"?/i.exec(header);
  return match ? decodeURIComponent(match[1].trim()) : fallback;
}

/** Saves a downloaded file the way a normal link would (the request itself carried the session cookie). */
export function saveDownload(response: HttpResponse<Blob>, fallback: string): void {
  const blob = response.body;
  if (!blob) {
    return;
  }
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = downloadName(response, fallback);
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}
