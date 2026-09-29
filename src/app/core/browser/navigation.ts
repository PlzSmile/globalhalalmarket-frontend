import { DOCUMENT, Injectable, inject } from '@angular/core';

/** Wrapper so components can send the browser to a URL (e.g. a download) and tests can check it. */
@Injectable({ providedIn: 'root' })
export class BrowserNavigation {
  private readonly document = inject(DOCUMENT);

  assign(url: string): void {
    this.document.location.assign(url);
  }
}
