import { ValidatorFn } from '@angular/forms';

export const nonWhitespaceValidator: ValidatorFn = (control) => {
  const value: unknown = control.value;
  return typeof value === 'string' && value.length > 0 && value.trim().length === 0
    ? { required: true }
    : null;
};

export const emailFormatValidator: ValidatorFn = (control) => {
  const value: unknown = control.value;
  if (typeof value !== 'string' || value.length === 0) {
    return null;
  }

  return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(value) ? null : { email: true };
};
