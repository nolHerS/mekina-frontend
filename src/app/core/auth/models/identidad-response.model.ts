export interface IdentidadResponse {
  id: string;
  nombre: string;
  correoElectronico: string;
  telefono: string | null;
  roles: string[];
}
