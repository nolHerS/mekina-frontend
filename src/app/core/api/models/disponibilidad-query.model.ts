export interface DisponibilidadQuery {
  profesionalId: string;
  desde: string;
  hasta: string;
  servicioIds: readonly string[];
}
