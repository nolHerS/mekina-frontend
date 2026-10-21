export interface DisponibilidadDiaResponse {
  fecha: string;
  inicios: string[];
}

export interface DisponibilidadResponse {
  profesionalId: string;
  zonaHoraria: string;
  duracionTotalMinutos: number;
  desde: string;
  hasta: string;
  dias: DisponibilidadDiaResponse[];
}
