export interface ReservasPropiasResponse {
  reservas: ReservaPropiaResponse[];
  pagina: number;
  limite: number;
  total: number;
}

export interface ReservaPropiaResponse {
  id: string;
  empiezaEn: string;
  terminaEn: string;
  zonaHoraria: string;
  estado: string;
  precioTotal: number;
  duracionTotalMinutos: number;
  servicios: ReservaServicioPropioResponse[];
}

export interface ReservaServicioPropioResponse {
  nombre: string;
  precio: number;
  duracionMinutos: number;
}
