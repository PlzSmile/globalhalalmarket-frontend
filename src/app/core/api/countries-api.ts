import { Injectable, inject } from '@angular/core';
import { HttpClient } from '@angular/common/http';
import { Observable, map, shareReplay } from 'rxjs';
import { ApiItem } from '../models/auth';
import { Country } from '../models/catalogue';

/** Reference data: loaded once per app session and kept in memory (CLAUDE.md rule 4). */
@Injectable({ providedIn: 'root' })
export class CountriesApi {
  private readonly http = inject(HttpClient);
  private readonly countries$ = this.http.get<ApiItem<readonly Country[]>>('/api/v1/reference/countries').pipe(
    map((r) => r.data),
    shareReplay({ bufferSize: 1, refCount: false }),
  );

  list(): Observable<readonly Country[]> {
    return this.countries$;
  }
}
