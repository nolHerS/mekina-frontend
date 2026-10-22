export interface ReservationDraft {
  servicioId: string;
  profesionalId: string;
  fecha: string;
  empiezaEn: string;
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

function isCalendarDate(value: string): boolean {
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) {
    return false;
  }

  const parsed = new Date(`${value}T00:00:00.000Z`);
  return Number.isFinite(parsed.getTime()) && parsed.toISOString().slice(0, 10) === value;
}

export function readReservationDraft(state: unknown): ReservationDraft | null {
  if (!isRecord(state) || !isRecord(state['reservationDraft'])) {
    return null;
  }

  const draft = state['reservationDraft'];
  const fecha = draft['fecha'];
  const empiezaEn = draft['empiezaEn'];
  if (
    !isUuid(draft['servicioId']) ||
    !isUuid(draft['profesionalId']) ||
    typeof fecha !== 'string' ||
    !isCalendarDate(fecha) ||
    typeof empiezaEn !== 'string' ||
    !empiezaEn.startsWith(`${fecha}T`) ||
    !/(?:Z|[+-]\d{2}:\d{2})$/.test(empiezaEn) ||
    !Number.isFinite(Date.parse(empiezaEn))
  ) {
    return null;
  }

  return {
    servicioId: draft['servicioId'],
    profesionalId: draft['profesionalId'],
    fecha,
    empiezaEn,
  };
}

export function hasRegistrationWelcome(state: unknown): boolean {
  return isRecord(state) && state['registrationWelcome'] === true;
}
