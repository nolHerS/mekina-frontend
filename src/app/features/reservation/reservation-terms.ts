import { InjectionToken } from '@angular/core';

export type ReservationTerms =
  | { status: 'pending' }
  | { status: 'approved'; text: string; url?: string };

export const RESERVATION_TERMS = new InjectionToken<ReservationTerms>(
  'RESERVATION_TERMS',
  {
    providedIn: 'root',
    factory: () => ({ status: 'pending' }),
  },
);
