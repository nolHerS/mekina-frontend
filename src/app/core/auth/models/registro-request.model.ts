export interface RegistroRequest {
  nombre: string;
  correoElectronico: string;
  telefono?: string | null;
  contrasena: string;
}
