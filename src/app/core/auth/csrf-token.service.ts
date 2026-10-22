import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable, finalize, map, of, shareReplay, tap } from 'rxjs';
import { API_BASE_URL } from '../api/api.config';
import { CsrfResponse } from './models/csrf-response.model';

@Injectable({ providedIn: 'root' })
export class CsrfTokenService {
  private readonly http = inject(HttpClient);
  private readonly endpoint = `${API_BASE_URL}/api/auth/csrf`;
  private token: string | null = null;
  private tokenRequest: Observable<string> | null = null;
  private refreshRequest: Observable<string> | null = null;

  getToken(): Observable<string> {
    if (this.token !== null) {
      return of(this.token);
    }

    if (this.tokenRequest === null) {
      let request: Observable<string>;
      request = this.http.get<CsrfResponse>(this.endpoint).pipe(
        map((response) => response.token),
        tap((token) => {
          if (this.tokenRequest === request) {
            this.token = token;
          }
        }),
        finalize(() => {
          if (this.tokenRequest === request) {
            this.tokenRequest = null;
          }
        }),
        shareReplay({ bufferSize: 1, refCount: false }),
      );
      this.tokenRequest = request;
    }

    return this.tokenRequest;
  }

  invalidate(): void {
    this.token = null;
    this.tokenRequest = null;
    this.refreshRequest = null;
  }

  refreshToken(): Observable<string> {
    if (this.refreshRequest !== null) {
      return this.refreshRequest;
    }

    this.invalidate();
    let request: Observable<string>;
    request = this.getToken().pipe(
      finalize(() => {
        if (this.refreshRequest === request) {
          this.refreshRequest = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.refreshRequest = request;
    return request;
  }
}
