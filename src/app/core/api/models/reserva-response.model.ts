export type EstadoReserva =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

export interface ReservaResponse {
  id: string;
  profesionalId: string;
  estado: EstadoReserva;
  empiezaEn: string;
  terminaEn: string;
  duracionTotalMinutos: number;
  precioTotal: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === 'object' && value !== null;
}

function isUuid(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(
      value,
    )
  );
}

function isOffsetDateTime(value: unknown): value is string {
  return (
    typeof value === 'string' &&
    /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(?::\d{2}(?:\.\d+)?)?(?:Z|[+-]\d{2}:\d{2})$/.test(
      value,
    ) &&
    Number.isFinite(Date.parse(value))
  );
}

const RESERVATION_STATES: readonly EstadoReserva[] = [
  'PENDING',
  'CONFIRMED',
  'COMPLETED',
  'CANCELLED',
  'NO_SHOW',
];

function isReservationState(value: unknown): value is EstadoReserva {
  return (
    typeof value === 'string' &&
    RESERVATION_STATES.some((state) => state === value)
  );
}

export function isReservaResponse(value: unknown): value is ReservaResponse {
  if (!isRecord(value)) {
    return false;
  }

  return (
    isUuid(value['id']) &&
    isUuid(value['profesionalId']) &&
    isReservationState(value['estado']) &&
    isOffsetDateTime(value['empiezaEn']) &&
    isOffsetDateTime(value['terminaEn']) &&
    typeof value['duracionTotalMinutos'] === 'number' &&
    Number.isInteger(value['duracionTotalMinutos']) &&
    value['duracionTotalMinutos'] > 0 &&
    typeof value['precioTotal'] === 'number' &&
    Number.isFinite(value['precioTotal']) &&
    value['precioTotal'] >= 0
  );
}
