export const CUSTOMER_BOOKINGS_PATH = '/mis-reservas' as const;

export function readPostAuthReturnTo(
  state: unknown,
): typeof CUSTOMER_BOOKINGS_PATH | null {
  if (typeof state !== 'object' || state === null || !('returnTo' in state)) {
    return null;
  }

  return state.returnTo === CUSTOMER_BOOKINGS_PATH
    ? CUSTOMER_BOOKINGS_PATH
    : null;
}
