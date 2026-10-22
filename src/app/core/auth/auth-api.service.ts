import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { inject, Injectable, signal } from '@angular/core';
import {
  Observable,
  catchError,
  finalize,
  of,
  shareReplay,
  tap,
  throwError,
} from 'rxjs';
import { API_BASE_URL } from '../api/api.config';
import { ActualizarPerfilRequest } from './models/actualizar-perfil-request.model';
import { AuthResponse } from './models/auth-response.model';
import { IdentidadResponse } from './models/identidad-response.model';
import { LoginRequest } from './models/login-request.model';
import { RegistroRequest } from './models/registro-request.model';
import { CsrfTokenService } from './csrf-token.service';

export type SessionState =
  | { status: 'loading' }
  | { status: 'authenticated'; identity: IdentidadResponse }
  | { status: 'anonymous' }
  | { status: 'error'; error: unknown };

@Injectable({ providedIn: 'root' })
export class AuthApiService {
  private readonly http = inject(HttpClient);
  private readonly csrfToken = inject(CsrfTokenService);
  private readonly endpoint = `${API_BASE_URL}/api/auth`;
  private readonly sessionStateValue = signal<SessionState>({ status: 'loading' });
  readonly sessionState = this.sessionStateValue.asReadonly();
  private sessionCheck: Observable<IdentidadResponse | null> | null = null;
  private sessionRevision = 0;

  login(request: LoginRequest): Observable<AuthResponse> {
    const body: LoginRequest = {
      correoElectronico: request.correoElectronico,
      contrasena: request.contrasena,
      recordarme: request.recordarme ?? false,
    };

    return this.http.post<AuthResponse>(`${this.endpoint}/login`, body).pipe(
      tap(() => {
        this.invalidateSessionCheck();
        this.csrfToken.invalidate();
        this.sessionStateValue.set({ status: 'loading' });
      }),
    );
  }

  register(request: RegistroRequest): Observable<AuthResponse> {
    const body: RegistroRequest = {
      nombre: request.nombre,
      correoElectronico: request.correoElectronico,
      contrasena: request.contrasena,
      ...(request.telefono !== undefined ? { telefono: request.telefono } : {}),
    };

    return this.http.post<AuthResponse>(`${this.endpoint}/registro`, body).pipe(
      tap(() => {
        this.invalidateSessionCheck();
        this.csrfToken.invalidate();
        this.sessionStateValue.set({ status: 'loading' });
      }),
    );
  }

  updateProfile(
    request: ActualizarPerfilRequest,
  ): Observable<IdentidadResponse> {
    const body: ActualizarPerfilRequest = {
      nombre: request.nombre,
      ...(request.telefono !== undefined
        ? { telefono: request.telefono }
        : {}),
    };

    return this.http.patch<IdentidadResponse>(`${this.endpoint}/me`, body).pipe(
      tap((identity) => {
        this.invalidateSessionCheck();
        this.sessionStateValue.set({ status: 'authenticated', identity });
      }),
    );
  }

  me(): Observable<IdentidadResponse | null> {
    if (this.sessionCheck !== null) {
      return this.sessionCheck;
    }

    const revision = this.sessionRevision;
    let request: Observable<IdentidadResponse | null>;
    this.sessionStateValue.set({ status: 'loading' });

    request = this.http.get<IdentidadResponse>(`${this.endpoint}/me`).pipe(
      tap((identity) => {
        if (revision === this.sessionRevision) {
          this.sessionStateValue.set({ status: 'authenticated', identity });
        }
      }),
      catchError((error: unknown) => {
        if (revision === this.sessionRevision) {
          if (error instanceof HttpErrorResponse && error.status === 401) {
            this.sessionStateValue.set({ status: 'anonymous' });
          } else {
            this.sessionStateValue.set({ status: 'error', error });
          }
        }

        if (error instanceof HttpErrorResponse && error.status === 401) {
          return of(null);
        }

        return throwError(() => error);
      }),
      finalize(() => {
        if (this.sessionCheck === request) {
          this.sessionCheck = null;
        }
      }),
      shareReplay({ bufferSize: 1, refCount: false }),
    );
    this.sessionCheck = request;
    return request;
  }

  logout(): Observable<void> {
    return this.http.post<void>(`${this.endpoint}/logout`, null).pipe(
      tap(() => {
        this.invalidateSessionCheck();
        this.csrfToken.invalidate();
        this.sessionStateValue.set({ status: 'anonymous' });
      }),
    );
  }

  private invalidateSessionCheck(): void {
    this.sessionRevision += 1;
    this.sessionCheck = null;
  }
}
