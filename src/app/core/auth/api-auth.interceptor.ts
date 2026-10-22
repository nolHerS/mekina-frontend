import { HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { switchMap } from 'rxjs';
import { API_BASE_URL } from '../api/api.config';
import { CsrfTokenService } from './csrf-token.service';

const BACKEND_ORIGIN = new URL(API_BASE_URL).origin;
const CSRF_METHODS = new Set(['POST', 'PATCH', 'DELETE']);

function isBackendRequest(url: string): boolean {
  try {
    return new URL(url).origin === BACKEND_ORIGIN;
  } catch {
    return false;
  }
}

export const apiAuthInterceptor: HttpInterceptorFn = (request, next) => {
  if (!isBackendRequest(request.url)) {
    return next(request.clone({ withCredentials: false }));
  }

  const credentialledRequest = request.clone({ withCredentials: true });
  if (!CSRF_METHODS.has(request.method.toUpperCase())) {
    return next(credentialledRequest);
  }

  return inject(CsrfTokenService)
    .getToken()
    .pipe(
      switchMap((token) =>
        next(
          credentialledRequest.clone({
            setHeaders: { 'X-CSRF-TOKEN': token },
          }),
        ),
      ),
    );
};
