# Contrato de integración frontend Angular - Backend Mekina

## 1. Alcance y estado del documento

Este documento describe el backend que existe actualmente en el repositorio. Es una referencia para un futuro frontend Angular; no es una especificación de endpoints que todavía no existan.

Los ejemplos se derivan de los `record` DTO y de los controllers actuales. Los UUID, fechas, importes y nombres usados son ficticios. Cuando una capacidad aparece en `BACKEND_SPEC.md` pero no tiene endpoint implementado, se marca como **pendiente**.

La API no publica actualmente OpenAPI/Swagger. Antes de congelar el contrato para producción conviene añadir una revisión de contrato HTTP que confirme mensajes, CORS y errores globales.

## 2. Arquitectura y convenciones actuales

### 2.1 Stack y módulos

- Java 25 (`pom.xml`).
- Spring Boot 4.1.1.
- Maven Wrapper (`mvnw.cmd` en Windows).
- PostgreSQL 17 en desarrollo/pruebas de integración.
- Flyway; las migraciones actuales llegan a V10.
- Hibernate con `spring.jpa.hibernate.ddl-auto=validate`; Hibernate no crea ni actualiza el esquema.
- Sesiones HTTP y cookies, no JWT.
- Arquitectura de monolito modular:
  - `security`: autenticación, sesión, roles y recuperación.
  - `servicios`: catálogo público.
  - `disponibilidad`: cálculo de huecos.
  - `horarios`: horario semanal, excepciones y bloqueos.
  - `reservas`: reservas, agenda y estados.
  - `correo`: outbox y proveedor Resend.

Los controllers están bajo `api`, los DTO HTTP bajo `api.dto`, la lógica bajo `application`, el modelo bajo `domain` y la persistencia bajo `infrastructure.persistence`.

### 2.2 Base URL y formato

Todos los endpoints usan el prefijo `/api`. La URL base depende del despliegue; no está fijada en el código para Angular.

Los DTO se serializan con nombres `camelCase`, coincidentes con los nombres Java:

- `OffsetDateTime`: texto ISO-8601 con offset, por ejemplo `2026-10-20T11:15:00+02:00`.
- `LocalDate`: `YYYY-MM-DD`.
- `LocalTime`: `HH:mm:ss` (el parser Java acepta el formato ISO de hora).
- `UUID`: texto con guiones.
- `BigDecimal`: número JSON decimal, por ejemplo `18.50`; representa euros. No usar `float`/`double` en el modelo Angular.
- `boolean`: JSON booleano.

La zona de negocio es `Europe/Madrid`, incluidos cambios estacionales. Las respuestas de disponibilidad y reservas incluyen `zonaHoraria` en los DTO que la necesitan. Los inicios enviados al backend deben incluir offset; el frontend debe mostrar y construir horas en `Europe/Madrid`, no convertirlas silenciosamente a la zona del dispositivo.

### 2.3 Seguridad de transporte y cookies

La aplicación usa sesión HTTP (`JSESSIONID`) y el token CSRF de Spring Security almacenado en la sesión mediante `HttpSessionCsrfTokenRepository`. La configuración activa:

- `HttpOnly` para la cookie de sesión.
- `SameSite=Lax`.
- `Secure=true` por defecto; el perfil `local` lo cambia a `false`.
- HSTS y `X-Frame-Options: DENY`.

En desarrollo Angular debe enviar credenciales (`withCredentials: true`) en las peticiones que necesiten mantener la sesión. En producción el backend debe publicarse bajo HTTPS. No se ha configurado CORS explícito en el código; un frontend servido desde otro origen necesitará una decisión/configuración de despliegue antes de funcionar con cookies.

## 3. Autenticación, sesión y CSRF

### 3.1 Roles

Los roles serializados son `CUSTOMER`, `BARBER` y `ADMIN`. Spring Security los usa como `ROLE_CUSTOMER`, `ROLE_BARBER` y `ROLE_ADMIN` internamente.

| Capacidad | `CUSTOMER` | `BARBER` | `ADMIN` |
|---|---:|---:|---:|
| Catálogo y disponibilidad pública | Sí | Sí | Sí |
| Registro/login/recuperación | Sí | Sí | Sí |
| Crear reserva online | Sí | No por esta regla de seguridad | No por esta regla de seguridad |
| Consultar sus reservas | Sí | No | No |
| Consultar agenda | No | Sí | Sí |
| Crear reserva manual | No | Sí | Sí |
| Completar/no-show | No | Sí | Sí |
| Gestionar horarios, excepciones y bloqueos | No | Sí | Sí |
| Gestionar servicios | No hay endpoints actuales | No hay endpoints actuales | No hay endpoints actuales |

La tabla refleja los matchers actuales, no una propuesta de permisos futura.

### 3.2 Obtener CSRF

`GET /api/auth/csrf` es público.

Respuesta `200`:

```json
{ "token": "token-csrf-no-real" }
```

El token se obtiene como `CsrfToken` de Spring y debe enviarse en la cabecera `X-CSRF-TOKEN` en las peticiones mutables: `POST`, `PATCH` y `DELETE`. El nombre exacto procede de `HttpSessionCsrfTokenRepository`; el frontend debe conservar la cookie de sesión y enviar credenciales.

Flujo recomendado:

1. Inicializar una petición con `GET /api/auth/csrf`, con `withCredentials: true`.
2. Guardar el campo `token`.
3. Añadir `X-CSRF-TOKEN: <token>` a cada petición mutable.
4. Si la sesión cambia o el servidor devuelve un rechazo CSRF, volver a obtener el token y reintentar solo cuando la operación sea segura para repetir.

### 3.3 Registro

`POST /api/auth/registro` es público respecto a autenticación, pero sigue protegido por CSRF por ser una petición mutable. El cliente debe seguir el flujo de obtención del token anterior.

Request:

```json
{
  "nombre": "Cliente de prueba",
  "correoElectronico": "cliente@example.test",
  "telefono": "600000000",
  "contrasena": "secreto123"
}
```

Validaciones:

- `nombre`: obligatorio, máximo 255 caracteres.
- `correoElectronico`: obligatorio, email válido, máximo 320.
- `telefono`: opcional, máximo 50.
- `contrasena`: obligatoria, entre 6 y 72 caracteres.

Respuesta `201`:

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "nombre": "Cliente de prueba",
  "correoElectronico": "cliente@example.test",
  "roles": ["CUSTOMER"]
}
```

Errores:

- `400`: `{ "error": "..." }` para validación o JSON inválido.
- `409`: `{ "error": "No se puede completar el registro" }` si el email ya está registrado. El mensaje no confirma detalles de la cuenta.

### 3.4 Login

`POST /api/auth/login` es público respecto a autenticación, pero sigue protegido por CSRF por ser una petición mutable.

Request:

```json
{
  "correoElectronico": "cliente@example.test",
  "contrasena": "secreto123"
}
```

Respuesta `200`: el mismo formato de `AuthResponse` del registro. El servidor crea/fija la sesión HTTP y guarda el contexto de seguridad.

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "nombre": "Cliente de prueba",
  "correoElectronico": "cliente@example.test",
  "roles": ["CUSTOMER"]
}
```

Errores:

- `400`: `{ "error": "El campo correoElectronico no es válido" }` u otro error de validación.
- `401`: `{ "error": "Credenciales no válidas" }`.

El frontend no debe guardar contraseña, token de sesión ni un JWT en `localStorage`; la autenticación depende de la cookie.

### 3.5 Usuario actual

`GET /api/auth/me` requiere autenticación.

Respuesta `200`:

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "nombre": "Cliente de prueba",
  "correoElectronico": "cliente@example.test",
  "telefono": "600000000",
  "roles": ["CUSTOMER"]
}
```

Si la sesión no existe, ha expirado o el usuario ya no es válido:

- `401`, normalmente sin un cuerpo JSON garantizado por el entry point de Spring.
- Si existe una sesión pero la autorización no corresponde, el servidor puede devolver `403`.

`GET /api/auth/me` debe ser la fuente de verdad para el estado autenticado al arrancar Angular.

### 3.6 Actualizar perfil

`PATCH /api/auth/me` requiere autenticación y CSRF.

Request:

```json
{
  "nombre": "Cliente actualizado",
  "telefono": "611111111"
}
```

`nombre` es obligatorio y tiene máximo 255 caracteres. `telefono` es opcional y tiene máximo 50. El DTO rechaza propiedades JSON desconocidas.

Respuesta `200`: `IdentidadResponse`, igual que `/api/auth/me`.

Errores:

- `400`: `{ "error": "..." }`.
- `401`: sesión no válida/expirada.
- `403`: ausencia de autorización o CSRF rechazado.

### 3.7 Logout

`POST /api/auth/logout` está permitido para público y lo maneja Spring Security. Requiere el token CSRF por ser una operación POST. Respuesta correcta: `204 No Content`. Invalida la sesión y elimina `JSESSIONID`; la configuración actual no usa `CookieCsrfTokenRepository`, por lo que Angular debe conservar el token obtenido desde `/api/auth/csrf` junto con la sesión.

### 3.8 Cambio y recuperación de contraseña

`POST /api/auth/cambiar-contrasena` requiere autenticación y CSRF.

```json
{
  "contrasenaActual": "secreto123",
  "nuevaContrasena": "nuevoSecreto123"
}
```

Respuesta correcta: `204`. La sesión actual se invalida; Angular debe volver a mostrar el login. Un error de validación devuelve `400` con `{ "error": "..." }`.

`POST /api/auth/recuperar-contrasena` es público respecto a autenticación, pero sigue protegido por CSRF:

```json
{ "correoElectronico": "cliente@example.test" }
```

Respuesta correcta: `200` sin cuerpo. El backend mantiene una respuesta pública que no debe revelar si el email existe. La entrega depende de la outbox de correo; un frontend no debe mostrar que el destinatario existe.

`POST /api/auth/recuperar-contrasena/confirmar` es público respecto a autenticación, pero sigue protegido por CSRF:

```json
{
  "token": "token-recibido-en-el-enlace",
  "nuevaContrasena": "nuevoSecreto123"
}
```

Respuesta correcta: `204`. El token es de un solo uso y tiene caducidad. Un token inválido, consumido o expirado se devuelve como `400` con `{ "error": "..." }`. No loguear ni persistir el token en Angular más tiempo del necesario.

## 4. Catálogo y disponibilidad

### 4.1 Servicios activos

`GET /api/servicios` es público.

Respuesta `200`:

```json
[
  {
    "id": "00000000-0000-0000-0000-000000000010",
    "nombre": "Corte",
    "descripcion": "Corte de cabello",
    "precio": 18.50,
    "duracionMinutos": 30,
    "activo": true,
    "creadoEn": "2026-10-01T10:00:00+02:00",
    "actualizadoEn": "2026-10-01T10:00:00+02:00"
  }
]
```

Solo devuelve servicios activos. No existe actualmente endpoint HTTP para crear, editar, activar, desactivar o borrar servicios, aunque esas capacidades estén previstas en la especificación funcional.

### 4.2 Disponibilidad

`GET /api/disponibilidad` es público. Los parámetros obligatorios son:

- `profesionalId`: UUID.
- `desde`: fecha ISO `YYYY-MM-DD`.
- `hasta`: fecha ISO `YYYY-MM-DD`.
- Uno o más `servicioId`, repetido en la query string.

Ejemplo:

```text
/api/disponibilidad?profesionalId=00000000-0000-0000-0000-000000000100&desde=2026-10-20&hasta=2026-10-22&servicioId=00000000-0000-0000-0000-000000000010&servicioId=00000000-0000-0000-0000-000000000011
```

Respuesta `200`:

```json
{
  "profesionalId": "00000000-0000-0000-0000-000000000100",
  "zonaHoraria": "Europe/Madrid",
  "duracionTotalMinutos": 60,
  "desde": "2026-10-20",
  "hasta": "2026-10-22",
  "dias": [
    {
      "fecha": "2026-10-20",
      "inicios": [
        "2026-10-20T10:00:00+02:00",
        "2026-10-20T10:15:00+02:00"
      ]
    }
  ]
}
```

Reglas verificadas en `DisponibilidadService`:

- Horizonte público máximo de 30 fechas.
- `desde` no puede ser anterior al día actual de `Europe/Madrid`.
- `hasta` no puede superar el día 30 del horizonte.
- Debe seleccionarse entre 1 y 10 servicios, sin repetirlos.
- Los servicios y el profesional deben existir y estar activos.
- Los inicios se generan en incrementos de 15 minutos.
- Se excluyen horario habitual cerrado, excepciones cerradas, bloqueos y reservas confirmadas.
- Se aplica una antelación mínima de 2 horas.
- La duración total es la suma real de las duraciones; no se redondea.

Errores:

- `400`: `{ "error": "..." }` con fecha, UUID, rango o selección inválida.
- `404`: `{ "error": "El profesional no existe o no está activo" }` o equivalente para servicios.

El frontend debe volver a consultar disponibilidad antes de confirmar una reserva. La respuesta no garantiza que el hueco siga libre cuando llegue el POST concurrente.

## 5. Reservas

### 5.1 Crear reserva online

`POST /api/reservas` requiere `CUSTOMER` y CSRF.

```json
{
  "profesionalId": "00000000-0000-0000-0000-000000000100",
  "servicioIds": [
    "00000000-0000-0000-0000-000000000010",
    "00000000-0000-0000-0000-000000000011"
  ],
  "empiezaEn": "2026-10-20T10:00:00+02:00",
  "aceptaCondiciones": true
}
```

Validaciones de borde:

- Profesional obligatorio.
- Entre 1 y 10 servicios, todos UUID y no nulos.
- Inicio obligatorio como `OffsetDateTime`.
- `aceptaCondiciones` debe ser `true`.
- Se rechazan propiedades JSON desconocidas.

Reglas de negocio adicionales:

- Profesional y servicios deben estar activos.
- El inicio debe estar en `Europe/Madrid`, en un incremento de 15 minutos y con al menos 2 horas de antelación.
- Debe caber la duración total dentro del horario disponible.
- Máximo de 3 reservas futuras por cliente y máximo de 1 por cliente y día.
- Las carreras de disponibilidad están protegidas en PostgreSQL; si otro cliente gana el hueco, se devuelve conflicto.
- Se guardan snapshots históricos de nombre, precio y duración.

Respuesta `201`:

```json
{
  "id": "00000000-0000-0000-0000-000000000200",
  "profesionalId": "00000000-0000-0000-0000-000000000100",
  "estado": "CONFIRMED",
  "empiezaEn": "2026-10-20T10:00:00+02:00",
  "terminaEn": "2026-10-20T11:00:00+02:00",
  "duracionTotalMinutos": 60,
  "precioTotal": 30.00
}
```

Errores:

- `400`: request inválido o regla de negocio no válida.
- `401`: no autenticado.
- `403`: no es `CUSTOMER` o CSRF rechazado.
- `404`: profesional/servicio inexistente o inactivo.
- `409`: `{ "error": "La reserva ya no está disponible" }` ante solapamiento, límite concurrente o conflicto.

Una reserva confirmada no se revierte si falla su email; el envío se registra aparte en la outbox.

### 5.2 Mis reservas

`GET /api/reservas/mias` requiere `CUSTOMER`.

Query opcional:

- `pagina`, por defecto `0`.
- `limite`, por defecto `20`; el tamaño máximo aceptado por el servicio es 50.

Respuesta `200`:

```json
{
  "reservas": [
    {
      "id": "00000000-0000-0000-0000-000000000200",
      "empiezaEn": "2026-10-20T10:00:00+02:00",
      "terminaEn": "2026-10-20T11:00:00+02:00",
      "zonaHoraria": "Europe/Madrid",
      "estado": "CONFIRMED",
      "precioTotal": 30.00,
      "duracionTotalMinutos": 60,
      "servicios": [
        { "nombre": "Corte", "precio": 18.50, "duracionMinutos": 30 }
      ]
    }
  ],
  "pagina": 0,
  "limite": 20,
  "total": 1
}
```

La respuesta usa snapshots históricos, no el catálogo actual. El backend verifica ownership; el frontend no debe intentar consultar reservas de otro cliente cambiando un ID.

### 5.3 Cancelar

`DELETE /api/reservas/{id}` requiere `CUSTOMER` y CSRF. Respuesta correcta: `204 No Content`.

Solo se pueden cancelar reservas propias en estado `PENDING` o `CONFIRMED` cuando faltan al menos 24 horas para el inicio. La cancelación efectiva libera el hueco y crea la notificación correspondiente en la outbox.

Errores: `400` por ID inválido/regla de datos, `401`, `403`, `404` si no existe/no pertenece al cliente y `409` si el estado o el plazo ya no permiten cancelar.

### 5.4 Reprogramar

`PATCH /api/reservas/{id}/horario` requiere `CUSTOMER` y CSRF.

```json
{ "empiezaEn": "2026-10-22T12:00:00+02:00" }
```

La reserva original debe estar en `PENDING` o `CONFIRMED` y faltar al menos 24 horas. El nuevo horario debe cumplir la antelación mínima de 2 horas, zona/offset válidos, granularidad y disponibilidad. Si el nuevo horario falla, la reserva original se conserva.

Respuesta `200`: `ReservaResponse` con el nuevo inicio y fin. Si el nuevo inicio es el mismo instante, devuelve la reserva sin crear un cambio.

Errores: `400`, `401`, `403`, `404` y `409` (`"La reserva no se puede modificar"` o `"El horario seleccionado ya no está disponible"`).

### 5.5 Agenda y operaciones del barbero

`GET /api/reservas/agenda` requiere `BARBER` o `ADMIN`.

Parámetros:

- `desde` y `hasta`: `OffsetDateTime` ISO obligatorios.
- `profesionalId`: opcional para `BARBER`; obligatorio para `ADMIN`.
- `pagina`, por defecto `0`.
- `limite`, por defecto `20`, máximo 50.

Respuesta:

```json
{
  "profesionalId": "00000000-0000-0000-0000-000000000100",
  "zonaHoraria": "Europe/Madrid",
  "reservas": [
    {
      "id": "00000000-0000-0000-0000-000000000200",
      "empiezaEn": "2026-10-20T10:00:00+02:00",
      "terminaEn": "2026-10-20T11:00:00+02:00",
      "zonaHoraria": "Europe/Madrid",
      "estado": "CONFIRMED",
      "nombreCliente": "Cliente de prueba",
      "telefonoCliente": "600000000",
      "precioTotal": 30.00,
      "duracionTotalMinutos": 60,
      "servicios": [
        { "nombre": "Corte", "precio": 18.50, "duracionMinutos": 30 }
      ]
    }
  ],
  "pagina": 0,
  "limite": 20,
  "total": 1
}
```

El intervalo debe ser válido, tener fin posterior al inicio y no superar 31 días. Un `ADMIN` debe indicar el profesional; un `BARBER` no puede seleccionar otro profesional.

`PATCH /api/reservas/{id}/completar` y `PATCH /api/reservas/{id}/no-show` requieren `BARBER` o `ADMIN`, CSRF y devuelven `204`. No se permite que el cliente ejecute estas transiciones.

`POST /api/reservas/manuales` requiere `BARBER` o `ADMIN`, CSRF:

```json
{
  "profesionalId": "00000000-0000-0000-0000-000000000100",
  "nombreCliente": "Cliente presencial",
  "telefonoCliente": "600000000",
  "empiezaEn": "2026-10-20T10:00:00+02:00",
  "servicioIds": ["00000000-0000-0000-0000-000000000010"]
}
```

Las reservas manuales no requieren cuenta online y no deben vincularse automáticamente por teléfono o email. El DTO no contiene un email de destinatario. El resultado es `201` con `ReservaResponse`. El controller permite que `ADMIN` seleccione profesional; el comportamiento exacto de selección para `BARBER` debe validarse en pruebas antes de construir una pantalla compleja.

## 6. Horarios, excepciones y bloqueos

Estos endpoints existen para el panel del barbero, aunque no forman parte de la reserva pública.

### Horario semanal

Base `/api/horarios-semanales`, todos requieren `BARBER` o `ADMIN`; las escrituras requieren CSRF.

- `GET /api/horarios-semanales?profesionalId=<uuid>` devuelve una lista de:

```json
{
  "id": "00000000-0000-0000-0000-000000000300",
  "profesionalId": "00000000-0000-0000-0000-000000000100",
  "diaSemana": 1,
  "empiezaA": "09:00:00",
  "terminaA": "17:00:00",
  "activo": true
}
```

- `POST /api/horarios-semanales` recibe `profesionalId`, `diaSemana` (1-7), `empiezaA` y `terminaA`; devuelve `201`.
- `PATCH /api/horarios-semanales/{id}` recibe `diaSemana`, `empiezaA` y `terminaA`; devuelve el DTO actualizado.
- `DELETE /api/horarios-semanales/{id}` desactiva y devuelve `204`.

Errores del módulo: `400` `{ "error": "..." }`, `403` `{ "error": "..." }`, `404` y `409` por conflictos.

### Excepciones

Base `/api/excepciones-horario`, lectura/escritura para `BARBER` o `ADMIN`.

Request de creación/actualización:

```json
{
  "profesionalId": "00000000-0000-0000-0000-000000000100",
  "fechaLocal": "2026-12-24",
  "empiezaA": "09:00:00",
  "terminaA": "13:00:00",
  "tipo": "CLOSED",
  "motivo": "Horario especial"
}
```

`GET` devuelve una lista de `ExcepcionHorarioResponse`; `POST` devuelve `201`; `PATCH /{id}` devuelve el DTO; `DELETE /{id}` devuelve `204`. Los campos de hora pueden ser nulos para una apertura/cierre de día completo según la lógica de dominio. Los valores de `tipo` verificables son los del enum `TipoExcepcionHorario`, al menos `OPEN` y `CLOSED`.

### Bloqueos de disponibilidad

Base `/api/bloqueos-disponibilidad`, lectura/escritura para `BARBER` o `ADMIN`.

Request:

```json
{
  "profesionalId": "00000000-0000-0000-0000-000000000100",
  "empiezaEn": "2026-12-24T09:00:00+01:00",
  "terminaEn": "2026-12-24T13:00:00+01:00",
  "motivo": "Cerrado"
}
```

- `GET /api/bloqueos-disponibilidad?profesionalId=<uuid>` devuelve una lista.
- `POST /api/bloqueos-disponibilidad` devuelve `201`.
- `DELETE /api/bloqueos-disponibilidad/{id}` devuelve `204`.

El módulo devuelve `400`, `403`, `404` o `409` con `{ "error": "..." }` según validación, permisos, recurso inexistente o solapamiento.

## 7. Errores y comportamiento de Angular

Los módulos implementan respuestas de error con una propiedad `error` en varios casos:

```json
{ "error": "La reserva ya no está disponible" }
```

Sin embargo, el entry point de autenticación de Spring puede responder `401` sin JSON y un error de CSRF/servidor puede usar el formato estándar de Spring. El interceptor Angular debe:

1. Tratar `401` como sesión ausente/expirada, limpiar el estado local y redirigir al login solo para rutas privadas.
2. Tratar `403` como permiso insuficiente o CSRF rechazado; no asumir automáticamente que significa sesión expirada.
3. Mostrar `error.error` cuando sea texto JSON; usar un mensaje genérico si la respuesta no tiene ese formato.
4. Tratar `409` como conflicto de disponibilidad/estado y refrescar disponibilidad o detalle antes de permitir reintentar.
5. No reintentar automáticamente `POST`, `PATCH` o `DELETE` después de un timeout sin una estrategia de idempotencia de frontend.
6. No mostrar stack traces, SQL, tokens ni mensajes internos.

## 8. Modelos orientativos para Angular

```ts
type Role = 'CUSTOMER' | 'BARBER' | 'ADMIN';

interface AuthResponse {
  id: string;
  nombre: string;
  correoElectronico: string;
  roles: Role[];
}

interface IdentidadResponse extends AuthResponse {
  telefono: string | null;
}

interface CsrfResponse {
  token: string;
}

interface Servicio {
  id: string;
  nombre: string;
  descripcion: string | null;
  precio: number; // tratar como decimal de euros; evitar cálculos binarios de precisión
  duracionMinutos: number;
  activo: boolean;
  creadoEn: string;
  actualizadoEn: string;
}

interface DisponibilidadDia {
  fecha: string; // YYYY-MM-DD
  inicios: string[]; // OffsetDateTime ISO
}

interface Disponibilidad {
  profesionalId: string;
  zonaHoraria: string;
  duracionTotalMinutos: number;
  desde: string;
  hasta: string;
  dias: DisponibilidadDia[];
}

type EstadoReserva =
  | 'PENDING'
  | 'CONFIRMED'
  | 'COMPLETED'
  | 'CANCELLED'
  | 'NO_SHOW';

interface ReservaServicio {
  nombre: string;
  precio: number;
  duracionMinutos: number;
}

interface Reserva {
  id: string;
  empiezaEn: string;
  terminaEn: string;
  zonaHoraria: string;
  estado: EstadoReserva;
  precioTotal: number;
  duracionTotalMinutos: number;
  servicios: ReservaServicio[];
}

interface ErrorResponse {
  error: string;
}
```

Para `ReservaResponse` de creación/reprogramación, el backend no incluye `zonaHoraria` ni la lista de servicios; el modelo debe permitir esa respuesta reducida:

```ts
interface ReservaMutationResponse {
  id: string;
  profesionalId: string;
  estado: EstadoReserva;
  empiezaEn: string;
  terminaEn: string;
  duracionTotalMinutos: number;
  precioTotal: number;
}
```

## 9. Mapa de pantallas y capacidades

| Área Angular | Endpoint existente | Estado | Observaciones |
|---|---|---|---|
| Web pública/catálogo | `GET /api/servicios` | Implementado | Solo servicios activos; no CRUD público. |
| Login | `/login`; `GET /api/auth/csrf`, `POST /api/auth/login`, `GET /api/auth/me` | Implementado | Confirma la sesión antes de navegar; `recordarme` desactivado por defecto. |
| Registro | `/registro`; `GET /api/auth/csrf`, `POST /api/auth/registro`, `GET /api/auth/me` | Implementado | Navega a `/reservar` solo tras confirmar la sesión; ofrece login si no se confirma. |
| Sesión actual | `GET /api/auth/me` | Implementado | `401` si no hay sesión. |
| Logout | `POST /api/auth/logout` | Implementado por Spring Security | Requiere CSRF; devuelve `204`. |
| Perfil | `PATCH /api/auth/me` | Implementado | No permite cambiar email ni roles. |
| Cambio de contraseña | `POST /api/auth/cambiar-contrasena` | Implementado | Invalida la sesión actual. |
| Recuperación | `POST /api/auth/recuperar-contrasena`, `POST /api/auth/recuperar-contrasena/confirmar` | Implementado | Depende de correo/outbox; respuesta pública no revela existencia. |
| Selección de servicios/horario | `GET /api/servicios`, `GET /api/disponibilidad` | Implementado | Reconsultar antes de reservar. |
| Crear reserva online | `POST /api/reservas` | Implementado | Solo `CUSTOMER`; conflicto `409`. |
| Área del cliente | `GET /api/reservas/mias` | Implementado | Paginación y ownership en backend. |
| Cancelar/reprogramar | `DELETE /api/reservas/{id}`, `PATCH /api/reservas/{id}/horario` | Implementado | Plazo mínimo de 24 horas para la cita original. |
| Agenda barbero/admin | `GET /api/reservas/agenda` | Implementado | Intervalo máximo 31 días; reglas distintas para BARBER/ADMIN. |
| Reserva manual | `POST /api/reservas/manuales` | Parcial | Existe para personal; no hay email manual en el DTO y debe revisarse la selección de profesional. |
| Completar/no-show | `PATCH /api/reservas/{id}/completar`, `PATCH /api/reservas/{id}/no-show` | Implementado | Solo BARBER/ADMIN. |
| Horario semanal | `/api/horarios-semanales` | Implementado | CRUD/desactivación para BARBER/ADMIN. |
| Excepciones | `/api/excepciones-horario` | Implementado | CRUD para BARBER/ADMIN. |
| Bloqueos | `/api/bloqueos-disponibilidad` | Implementado | Consulta, creación y borrado para BARBER/ADMIN. |
| CRUD de servicios del panel | No existe | Pendiente | `ServicioController` solo expone `GET /api/servicios`. |
| Gestión de profesionales | No existe endpoint público documentado | Pendiente | El frontend necesita conocer el UUID del profesional por configuración o futuro endpoint. |
| Administración de usuarios/roles | No existe | Pendiente | Previsto funcionalmente, no disponible por HTTP. |
| Estadísticas e historial avanzado | No existe | Pendiente | No construir pantallas que dependan de ellos. |

## 10. Recomendación de integración Angular

Organizar el frontend por capacidades, no por una única clase global:

- `core/auth`: sesión, CSRF, interceptor de cookies/errores y guards de UX.
- `core/http`: URL base por entorno e interceptor de errores.
- `catalogo`: servicios.
- `disponibilidad`: consulta y transformación de fechas.
- `reservas`: creación, listado, cancelación y reprogramación.
- `agenda`: agenda y operaciones del personal.
- `perfil`: usuario actual y cambio de contraseña.
- `shared/models`: interfaces equivalentes a los DTO.

Configurar la URL base mediante `environment` de Angular, nunca hardcodearla en cada servicio. La configuración de desarrollo debe apuntar a un backend con perfil local y cookies compatibles; producción debe usar HTTPS y un origen/CORS revisado explícitamente.

El interceptor funcional añade `withCredentials` y el token CSRF a las escrituras dirigidas al backend. Los guards solo mejoran la navegación: la autorización real sigue estando en Spring Security.

La capa HTTP inicial de autenticación ya está implementada en `src/app/core/auth`: `AuthApiService` expone login, registro, consulta de sesión y logout; `CsrfTokenService` conserva el token únicamente en memoria; y el interceptor funcional registrado en `app.config.ts` limita las credenciales al origen del backend, adjunta CSRF a `POST`, `PATCH` y `DELETE`, y no reintenta escrituras. El estado de sesión también permanece en memoria y `/api/auth/me` es su fuente de verdad.

## 11. Pendientes y límites de esta primera versión

- No se ha verificado un despliegue con Angular ni una configuración CORS entre dos orígenes.
- No existe contrato OpenAPI generado.
- No se ha documentado un endpoint de listado de profesionales; el UUID es necesario para disponibilidad y reservas.
- No existen endpoints de CRUD de servicios, usuarios, permisos, configuración pública ni estadísticas.
- Los mensajes exactos de errores de todos los servicios deben estabilizarse si van a formar parte de un contrato frontend.
- Debe comprobarse con pruebas E2E el intercambio de la cookie `JSESSIONID`, la persistencia del token CSRF de sesión y el nombre de la cabecera desde el origen final.
- La API no expone explícitamente un endpoint de detalle de reserva por ID; el cliente debe usar `/api/reservas/mias` y la agenda según su rol.
- El documento no incluye endpoints de correo/outbox porque son infraestructura interna y no deben exponerse al frontend.
