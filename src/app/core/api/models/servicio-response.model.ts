export interface ServicioResponse {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number;
  duracionMinutos: number;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}
