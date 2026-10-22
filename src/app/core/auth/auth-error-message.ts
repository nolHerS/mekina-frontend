import { HttpErrorResponse } from '@angular/common/http';

export function getBackendErrorMessage(error: unknown): string | null {
  if (!(error instanceof HttpErrorResponse)) {
    return null;
  }

  const body: unknown = error.error;
  if (typeof body === 'string' && body.trim() !== '') {
    return body.trim();
  }

  if (typeof body === 'object' && body !== null) {
    if ('error' in body && typeof body.error === 'string') {
      return body.error;
    }

    if ('message' in body && typeof body.message === 'string') {
      return body.message;
    }
  }

  return null;
}

export function getAuthErrorMessage(
  error: unknown,
  operation: 'login' | 'registro',
): string {
  const backendMessage = getBackendErrorMessage(error);
  if (backendMessage !== null) {
    return backendMessage;
  }

  if (error instanceof HttpErrorResponse) {
    switch (error.status) {
      case 0:
        return 'No se pudo conectar con el servicio. Inténtalo de nuevo.';
      case 400:
        return 'Revisa los datos introducidos e inténtalo de nuevo.';
      case 401:
        return 'El correo electrónico o la contraseña no son correctos.';
      case 403:
        return 'No se pudo validar la solicitud. Actualiza la página e inténtalo de nuevo.';
      case 409:
        return 'Ya existe una cuenta con ese correo electrónico.';
      case 429:
        return 'Has realizado demasiados intentos. Inténtalo de nuevo más tarde.';
    }
  }

  return operation === 'login'
    ? 'No se pudo iniciar sesión. Inténtalo de nuevo.'
    : 'No se pudo completar el registro. Inténtalo de nuevo.';
}
