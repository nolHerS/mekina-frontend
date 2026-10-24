# Barberia Mekina - handoff HTTP para Angular

**Estado:** contrato derivado del codigo actual del backend.
**Alcance:** guia de integracion para iniciar Angular; no sustituye una
especificacion OpenAPI ni inventa endpoints que no existen.

## 1. Arquitectura y ejecucion

- Java: 25.
- Spring Boot: 4.1.1.
- Base de datos: PostgreSQL 17.
- Migraciones: Flyway, activado, desde
  `classpath:db/migration`; la version actual es V15.
- Hibernate: `ddl-auto: validate`.
- Arquitectura: monolito modular, una API Spring Boot y PostgreSQL.
- Autenticacion: sesion HTTP (`JSESSIONID`), no JWT.

### Arranque local

La API local usa la configuracion de `application.yaml`:

```text
http://localhost:8080
```

La URL se deduce del puerto por defecto de Spring Boot; no hay un puerto
personalizado en el repositorio.

Requisitos y arranque:

```powershell
$env:DB_PASSWORD = Read-Host "DB_PASSWORD"
docker compose up -d postgres
.\mvnw.cmd spring-boot:run
```

Spring Boot no carga `.env` automaticamente. Las pruebas de integracion usan
PostgreSQL 17 efimero mediante Testcontainers y no dependen del volumen local.

En desarrollo Angular debe:

1. Configurar la URL base como `http://localhost:8080`.
2. Enviar credenciales en las peticiones que deban conservar la sesion:
   `withCredentials: true`.
3. Obtener primero el token CSRF.
4. Enviar `X-CSRF-TOKEN` en las peticiones mutables.

La configuracion local mediante `compose.yaml` permite unicamente el origen
exacto `http://localhost:4300`, que es el puerto del servidor Angular local.
Las pruebas de integracion sobrescriben la propiedad con ese mismo origen.

### Produccion

Activar `SPRING_PROFILES_ACTIVE=prod`. El perfil exige:

- `DB_URL`;
- `DB_USERNAME`;
- `DB_PASSWORD`;
- `MEKINA_CORS_ALLOWED_ORIGINS`, una lista separada por comas de origenes
  HTTP(S) exactos, sin rutas ni comodines.

Produccion usa cookies seguras y `forward-headers-strategy: framework`.
El dominio real, TLS, proxy, Coolify, Resend, backups y restauracion aun no
estan validados. Mientras `HttpSession` permanezca en memoria, V1 requiere una
sola instancia del backend; varias instancias sin almacenamiento compartido
de sesiones no estan soportadas.

## 2. Reglas de transporte, sesion y errores

### Sesion y CSRF

- `GET /api/auth/csrf` crea o recupera el token de la sesion y devuelve
  `{ "token": "..." }`.
- En `POST`, `PATCH` y `DELETE`, enviar el token en `X-CSRF-TOKEN`.
- `GET` no requiere CSRF.
- La cookie `JSESSIONID` es `HttpOnly`, `SameSite=Lax` y segura en produccion.
- El login rota el identificador de sesion.
- Logout invalida la sesion y elimina la cookie.
- Logout, cambio de contrasena y recuperacion de contrasena revocan sesiones
  en PostgreSQL.
- Una sesion expirada o revocada responde `401` en los recursos autenticados.
- Angular no debe guardar la cookie, contrasena, token de sesion ni JWT en
  `localStorage`.
- El frontend conserva el token CSRF solo en memoria y comparte el bootstrap
  mientras haya peticiones concurrentes.
- Tras un `403`, no se puede inferir solo por el estado HTTP si el rechazo fue
  de CSRF o de autorizacion. El frontend no cierra la sesion ni reenvia la
  mutacion. En la reserva permite solicitar expresamente un nuevo token; esa
  accion invalida la cache y ejecuta un nuevo `GET /api/auth/csrf`, pero no
  repite el `POST`.
- Una respuesta tardia de un bootstrap invalidado no reemplaza el token
  renovado. La mutacion rechazada no se reintenta automaticamente.

### CORS

CORS permite credenciales unicamente para los origenes configurados. Los
metodos permitidos son `GET`, `POST`, `PATCH`, `DELETE` y `OPTIONS`. Los
encabezados permitidos incluyen `Accept`, `Content-Type` y `X-CSRF-TOKEN`.
El origen de Angular en produccion queda pendiente de decision y no debe
inventarse en el frontend.

### Formatos de error

No existe un `@RestControllerAdvice` global. Cada modulo usa su propio DTO,
normalmente `{ "error": "mensaje" }`:

- `AuthErrorResponse` en autenticacion;
- `ServicioErrorResponse` en servicios;
- `HorarioErrorResponse` en profesionales y horarios;
- `ReservaErrorResponse` en reservas.

Los errores de validacion o JSON no legible suelen devolver `400`; los
recursos inexistentes `404`; conflictos de disponibilidad, duplicados o
concurrencia `409`; autenticacion ausente `401`; permisos insuficientes o
CSRF rechazado `403`.

El rate limiting devuelve `429` con `AuthErrorResponse` y `Retry-After` cuando
la cuota aplicable esta agotada. En la configuracion base local el rate
limiting esta desactivado; debe comprobarse la configuracion efectiva del
entorno.

## 3. Contrato de autenticacion y perfil

Todos los endpoints de escritura de esta seccion requieren CSRF.

| Metodo y ruta | Acceso | Peticion | Exito y errores |
|---|---|---|---|
| `POST /api/auth/registro` | Anonimo | `RegistroRequest`: `nombre` (obligatorio, max 255), `correoElectronico` (email, max 320), `telefono` (opcional, max 50), `contrasena` (6-72) | `201 AuthResponse` (`id`, `nombre`, `correoElectronico`, `roles`); `400` validacion; `409 AuthErrorResponse` por email duplicado |
| `POST /api/auth/login` | Anonimo | `LoginRequest`: `correoElectronico`, `contrasena` | `200 AuthResponse`; `400`; `401 {"error":"Credenciales no válidas"}`; `429` con `Retry-After` |
| `GET /api/auth/csrf` | Anonimo | Sin cuerpo | `200 CsrfResponse {token}` |
| `GET /api/auth/me` | Autenticado | Sin parametros | `200 IdentidadResponse`: `id`, `nombre`, `correoElectronico`, `telefono`, `roles`; `401` si la sesion no es valida |
| `PATCH /api/auth/me` | Autenticado | `ActualizarPerfilRequest`: `nombre` obligatorio max 255, `telefono` opcional max 50; rechaza campos JSON desconocidos | `200 IdentidadResponse`; `400 AuthErrorResponse` |
| `POST /api/auth/logout` | Anonimo o autenticado; opera sobre la sesion actual | Sin cuerpo | `204`; CSRF obligatorio; invalida sesion y cookie |
| `POST /api/auth/cambiar-contrasena` | Autenticado | `CambiarContrasenaRequest`: `contrasenaActual`, `nuevaContrasena` (6-72) | `204`; `400 AuthErrorResponse`; revoca sesiones y cierra la sesion actual |
| `POST /api/auth/recuperar-contrasena` | Anonimo | `SolicitarRecuperacionRequest`: email | `200` vacio para solicitudes aceptadas; `400`; `429`; no revela si existe el email |
| `POST /api/auth/recuperar-contrasena/confirmar` | Anonimo | `ConfirmarRecuperacionRequest`: `token`, `nuevaContrasena` (6-72) | `204`; `400 AuthErrorResponse`; `429`; revoca sesiones al completar |

Ejemplo de respuesta de identidad:

```json
{
  "id": "00000000-0000-0000-0000-000000000001",
  "nombre": "Cliente",
  "correoElectronico": "cliente@example.test",
  "telefono": null,
  "roles": ["CUSTOMER"]
}
```

El endpoint de logout no esta implementado en un controller: lo proporciona
la configuracion de Spring Security.

## 4. Catalogo de servicios

`GET /api/servicios` es publico y devuelve una lista de servicios activos.
`GET /api/servicios/{id}` requiere `BARBER` o `ADMIN`.

`ServicioResponse` contiene `id`, `nombre`, `descripcion`, `precio`,
`duracionMinutos`, `activo`, `creadoEn` y `actualizadoEn`.

| Metodo y ruta | Acceso | Peticion | Exito y errores |
|---|---|---|---|
| `GET /api/servicios` | Anonimo | Ninguna | `200 List<ServicioResponse>` |
| `GET /api/servicios/{id}` | `BARBER` o `ADMIN` | `id` UUID | `200 ServicioResponse`; `404 ServicioErrorResponse` |
| `POST /api/servicios` | `BARBER` o `ADMIN` | `CrearServicioRequest`: `nombre` obligatorio max 255, `descripcion`, `precio >= 0`, `duracionMinutos > 0` | `201 ServicioResponse`; `400 ServicioErrorResponse` |
| `PATCH /api/servicios/{id}` | `BARBER` o `ADMIN` | `ActualizarServicioRequest` con los mismos campos y validaciones | `200 ServicioResponse`; `400` o `404` |
| `POST /api/servicios/{id}/activar` | `BARBER` o `ADMIN` | Sin cuerpo | `200 ServicioResponse`; `400` o `404` |
| `POST /api/servicios/{id}/desactivar` | `BARBER` o `ADMIN` | Sin cuerpo | `200 ServicioResponse`; `400` o `404` |

Las operaciones distintas de los `GET` requieren CSRF.

## 5. Profesionales y horarios

### Profesionales

`ProfesionalResponse` contiene `id`, `usuarioId`, `nombre`,
`correoElectronico`, `telefono` y `activo`.

| Metodo y ruta | Acceso | Peticion | Exito y errores |
|---|---|---|---|
| `GET /api/profesionales` | `BARBER` o `ADMIN` | Ninguna | `200 List<ProfesionalResponse>` |
| `GET /api/profesionales/{id}` | `BARBER` o `ADMIN` | `id` UUID | `200 ProfesionalResponse`; `404 HorarioErrorResponse` |
| `POST /api/profesionales` | `ADMIN` | `CrearProfesionalRequest`: `usuarioId` UUID | `201 ProfesionalResponse`; `400`, `404` o `409 HorarioErrorResponse` |
| `PATCH /api/profesionales/{id}` | `ADMIN` | `ActualizarProfesionalRequest`: `nombre` obligatorio max 255, `telefono` opcional max 50 | `200 ProfesionalResponse`; `400`, `404` o `409` |
| `POST /api/profesionales/{id}/activar` | `ADMIN` | Sin cuerpo | `200 ProfesionalResponse`; errores de dominio como arriba |
| `POST /api/profesionales/{id}/desactivar` | `ADMIN` | Sin cuerpo | `200 ProfesionalResponse`; errores de dominio como arriba |

### Horario semanal

`HorarioSemanalResponse`: `id`, `profesionalId`, `diaSemana`, `empiezaA`,
`terminaA`, `activo`. `diaSemana` es un entero de 1 a 7 y las horas son
`LocalTime`.

| Metodo y ruta | Acceso | Peticion | Exito y errores |
|---|---|---|---|
| `GET /api/horarios-semanales?profesionalId={uuid}` | `BARBER` o `ADMIN` | `profesionalId` opcional | `200 List<HorarioSemanalResponse>`; `403` o `404` |
| `POST /api/horarios-semanales` | `BARBER` o `ADMIN` | `CrearHorarioSemanalRequest`: `profesionalId`, `diaSemana` 1-7, `empiezaA`, `terminaA` | `201 HorarioSemanalResponse`; `400`, `403`, `404`, `409` |
| `PATCH /api/horarios-semanales/{id}` | `BARBER` o `ADMIN` | `ActualizarHorarioSemanalRequest`: `diaSemana`, `empiezaA`, `terminaA` | `200 HorarioSemanalResponse`; `400`, `403`, `404`, `409` |
| `DELETE /api/horarios-semanales/{id}` | `BARBER` o `ADMIN` | `id` UUID | `204`; `403` o `404` |

### Excepciones de horario

`CrearExcepcionHorarioRequest` y `ActualizarExcepcionHorarioRequest` tienen
`profesionalId`, `fechaLocal`, `empiezaA`, `terminaA`, `tipo` y `motivo`.
La respuesta anade `id` y devuelve esos mismos campos como
`ExcepcionHorarioResponse`.

| Metodo y ruta | Acceso | Exito y errores |
|---|---|---|
| `GET /api/excepciones-horario?profesionalId={uuid}` | `BARBER` o `ADMIN`; filtro opcional | `200 List<ExcepcionHorarioResponse>`; `403` o `404` |
| `POST /api/excepciones-horario` | `BARBER` o `ADMIN`; cuerpo anterior | `201 ExcepcionHorarioResponse`; `400`, `403`, `404`, `409` |
| `PATCH /api/excepciones-horario/{id}` | `BARBER` o `ADMIN`; cuerpo anterior | `200 ExcepcionHorarioResponse`; `400`, `403`, `404`, `409` |
| `DELETE /api/excepciones-horario/{id}` | `BARBER` o `ADMIN` | `204`; `403` o `404` |

### Bloqueos

`CrearBloqueoDisponibilidadRequest` contiene `profesionalId`,
`empiezaEn`, `terminaEn` y `motivo`. La respuesta
`BloqueoDisponibilidadResponse` anade `id`.

| Metodo y ruta | Acceso | Exito y errores |
|---|---|---|
| `GET /api/bloqueos-disponibilidad?profesionalId={uuid}` | `BARBER` o `ADMIN`; filtro opcional | `200 List<BloqueoDisponibilidadResponse>`; `403` o `404` |
| `POST /api/bloqueos-disponibilidad` | `BARBER` o `ADMIN`; cuerpo anterior | `201 BloqueoDisponibilidadResponse`; `400`, `403`, `404`, `409` |
| `DELETE /api/bloqueos-disponibilidad/{id}` | `BARBER` o `ADMIN` | `204`; `403` o `404` |

Todas las escrituras de esta seccion requieren CSRF. Las excepciones y
bloqueos con motivo se registran en la auditoria administrativa persistente.
No existe endpoint HTTP para consultar esa auditoria.

## 6. Disponibilidad

`GET /api/disponibilidad` es publico y requiere:

- `profesionalId` UUID;
- `desde` y `hasta` en formato `YYYY-MM-DD`;
- `servicioId` opcional y repetible.

Respuesta `DisponibilidadResponse`:

```json
{
  "profesionalId": "00000000-0000-0000-0000-000000000001",
  "zonaHoraria": "Europe/Madrid",
  "duracionTotalMinutos": 30,
  "desde": "2026-10-20",
  "hasta": "2026-10-22",
  "dias": [
    {
      "fecha": "2026-10-20",
      "inicios": ["2026-10-20T10:00:00+02:00"]
    }
  ]
}
```

Devuelve `400 HorarioErrorResponse` para parametros ausentes o invalidos y
`404 HorarioErrorResponse` si no existe el profesional o servicio aplicable.
La disponibilidad es orientativa hasta confirmar la reserva; el backend
vuelve a validar horario, antelacion y concurrencia.

## 7. Reservas

Las fechas de las reservas se reciben como `OffsetDateTime` ISO-8601. El
backend aplica la zona de negocio `Europe/Madrid`, antelacion minima de dos
horas, inicios de 15 minutos, duracion real de los servicios y restricciones
de solapamiento y limites por cliente.

### Respuestas

`ReservaResponse`: `id`, `profesionalId`, `estado`, `empiezaEn`, `terminaEn`,
`duracionTotalMinutos`, `precioTotal`.

`ReservaPropiaResponse` anade `zonaHoraria` y `servicios`; cada servicio
incluye `nombre`, `precio` y `duracionMinutos`. `ReservaAgendaResponse`
incluye tambien `nombreCliente` y `telefonoCliente`.

| Metodo y ruta | Acceso | Peticion/consulta | Exito y errores |
|---|---|---|---|
| `GET /api/reservas/mias?pagina=0&limite=20` | `CUSTOMER` | Paginacion | `200 ReservasPropiasResponse` (`reservas`, `pagina`, `limite`, `total`); `401/403` |
| `GET /api/reservas/agenda?desde=...&hasta=...&profesionalId=...&pagina=0&limite=20` | `BARBER` o `ADMIN` | `desde` y `hasta` obligatorios; profesional opcional | `200 AgendaReservasResponse`; `400`, `403`, `404` |
| `POST /api/reservas` | `CUSTOMER` | `CrearReservaRequest`: `profesionalId`, `servicioIds` no vacio max 10, `empiezaEn`, `aceptaCondiciones=true`; rechaza JSON desconocido | `201 ReservaResponse`; `400`, `404`, `409` |
| `POST /api/reservas/manuales` | `BARBER` o `ADMIN` | `CrearReservaManualRequest`: `profesionalId` opcional, `nombreCliente`, `telefonoCliente`, `empiezaEn`, `servicioIds` no vacio max 10 | `201 ReservaResponse`; `400`, `404`, `409` |
| `DELETE /api/reservas/{id}` | `CUSTOMER`, solo propietario | `id` UUID | `204`; `400`, `404`, `409` |
| `PATCH /api/reservas/{id}/horario` | `CUSTOMER`, solo propietario | `CambiarHorarioRequest`: `empiezaEn`; rechaza JSON desconocido | `200 ReservaResponse`; `400`, `404`, `409` |
| `PATCH /api/reservas/{id}/completar` | `BARBER` o `ADMIN` | `id` UUID | `204`; errores de estado, propiedad o recurso |
| `PATCH /api/reservas/{id}/no-show` | `BARBER` o `ADMIN` | `id` UUID | `204`; errores de estado, propiedad o recurso |

Las escrituras requieren CSRF. La cancelacion y la reprogramacion online
requieren al menos 24 horas respecto a la reserva original; una
reprogramacion debe cumplir tambien dos horas de antelacion. Una
reprogramacion fallida conserva la reserva original. Las reservas conservan
snapshots historicos de precio, duracion y nombre de los servicios.

### Creacion de reservas desde Angular

El contrato documentado de `POST /api/reservas` enumera `201`, `400`, `404` y
`409` en la tabla anterior. La seccion general de seguridad describe tambien
`401` para autenticacion ausente y `403` para permisos o rechazo CSRF, pero
esos dos estados no estan repetidos en la fila del endpoint. Angular los trata
de forma diferenciada sin presentarlos como una sesion cerrada; la respuesta
exacta de cada uno para este endpoint no se ha verificado contra el backend
real.

El frontend:

- vuelve a comprobar la identidad CUSTOMER y la disponibilidad antes del
  `POST`; la comprobacion de disponibilidad no sustituye la validacion
  autoritativa del backend;
- solo envia `aceptaCondiciones: true` tras una aceptacion explicita de un
  texto configurado como aprobado;
- no reintenta automaticamente ninguna mutacion;
- trata `400`, `401`, `403`, `404` y `409` segun sus significados documentados
  o generales, sin mostrar cuerpos internos;
- trata la perdida de red, los estados HTTP `5xx`, otros estados no
  contemplados y las respuestas de exito que no pueda interpretar como un
  resultado incierto. No muestra confirmacion y bloquea un nuevo envio hasta
  que el usuario declare que comprobo por otro canal que no se creo una
  reserva. Esto no verifica el resultado en el backend.

El frontend incluye la ruta lazy `/mis-reservas`. Antes de solicitar datos
consulta el estado compartido de `AuthApiService` y solo llama al endpoint
para una identidad con rol `CUSTOMER`. La vista no muestra datos durante la
comprobacion, si la sesion es anonima o si el rol no corresponde. Una respuesta
`401` durante la consulta provoca una nueva comprobacion con `/api/auth/me`;
un `403` se conserva como problema de autorizacion, no como sesion cerrada.
La consulta usa `pagina` y `limite` (por defecto 0 y 20; el backend permite
limites de 1 a 50) y presenta campos de la respuesta, agrupando reservas por
si su inicio es pasado o futuro.

La implementación backend pagina primero identificadores únicos de reserva
en una CTE y después carga todos los servicios asociados. La prueba
`paginatesOwnReservationsByUniqueReservationWithAllServices` verifica que una
reserva con varios servicios no se divide entre páginas. Esta evidencia es del
código y las pruebas del backend; no equivale a una prueba de integración
ejecutada desde el frontend contra Docker.

### Cancelación desde «Mis reservas»

Angular implementa `DELETE /api/reservas/{id}` sin cuerpo y solo considera
confirmada la operación ante el estado `204`. El botón solicita confirmación
explícita y se bloquean las acciones mientras hay una mutación pendiente. Tras
el `204`, la lista se vuelve a consultar al servidor; la interfaz no marca la
cita como cancelada de forma optimista.

El backend limita la cancelación al propietario CUSTOMER y a reservas en
estados permitidos con al menos 24 horas de antelación; el backend sigue siendo
la autoridad y puede rechazarla. Angular diferencia `400`, `401`, `403`,
`404` y `409`; un `401` provoca una comprobación de sesión, mientras que un
`403` no cierra la sesión automáticamente.

La pérdida de red, los estados `5xx`, otros errores no reconocidos y una
respuesta de éxito distinta de `204` se tratan como resultado incierto. No se
repite el `DELETE` ni se muestra una cancelación confirmada. Las acciones de
mutación quedan bloqueadas hasta que el usuario solicite una consulta GET
explícita de la lista; esta consulta muestra el estado actual, pero no prueba
por sí sola si el intento previo causó el cambio.

La reprogramación no está implementada en Angular. Aunque el backend documenta
`PATCH /api/reservas/{id}/horario`, `ReservaPropiaResponse` no expone
`profesionalId` ni los identificadores UUID de los servicios que requiere
`GET /api/disponibilidad`. Inferirlos de nombres o de otros datos no sería
seguro. Se requiere un contrato backend verificado que aporte esos
identificadores antes de construir el flujo de reprogramación; no se ha
añadido un método PATCH ni una interfaz parcial.

Ante un resultado incierto de `POST /api/reservas`, la pantalla de reserva
ofrece abrir `/mis-reservas` para revisar las reservas existentes. Esa lista
no permite vincular inequívocamente una reserva con una solicitud concreta;
una coincidencia de fecha/hora no demuestra que el POST previo la haya creado.
El usuario debe comprobar la lista y, si el resultado sigue sin aclararse,
contactar con la barberia antes de volver a intentarlo. La API no documenta
una clave de idempotencia ni una consulta que reconcilie un intento
individual. El bloqueo de reenvio del POST sigue siendo temporal a la pagina y
no sobrevive a una recarga.

Las pruebas frontend usan `HttpTestingController`; no confirman una
integracion real con el backend, cookies, CSRF o PostgreSQL.

El envio en produccion permanece bloqueado mientras no se configure un texto
de condiciones aprobado. El valor predeterminado de Angular es `pending`; no
se debe habilitar con texto ficticio o sin validacion del responsable.

## 8. Healthchecks

Actuator expone unicamente health:

| Metodo y ruta | Acceso | Significado |
|---|---|---|
| `GET /actuator/health/liveness` | Publico | Proceso vivo; no garantiza PostgreSQL, reservas, correo ni proveedores |
| `GET /actuator/health/readiness` | Publico | Incluye `db`; representa disponibilidad basica para operaciones dependientes de PostgreSQL |
| `GET /actuator/health` | Publico | Estado agregado sin detalles de componentes |

Los detalles de infraestructura estan ocultos. Los healthchecks no ejecutan
migraciones ni operaciones destructivas.

## 9. Flujos Angular confirmados

### Sesion

1. `GET /api/auth/csrf` con `withCredentials`.
2. `POST /api/auth/login` con `X-CSRF-TOKEN` y `withCredentials`.
3. Conservar automaticamente `JSESSIONID` mediante el navegador.
4. `GET /api/auth/me` para recuperar la identidad.
5. Repetir el bootstrap CSRF si la sesion cambia o se recibe un rechazo CSRF.
6. `POST /api/auth/logout` con CSRF.

### Cliente

1. `GET /api/servicios`.
2. `GET /api/disponibilidad` con profesional, fechas y servicios.
3. `POST /api/reservas` aceptando las condiciones.
4. `GET /api/reservas/mias`.
5. `PATCH /api/reservas/{id}/horario` o `DELETE /api/reservas/{id}` solo si
   las reglas de antelacion lo permiten.

El paso 4 es un endpoint documentado del backend, no una capacidad integrada
en la interfaz Angular actual. Las pruebas del frontend simulan las
respuestas HTTP y no demuestran creacion ni consulta real de reservas.

### Panel

1. Autenticarse y recuperar `/api/auth/me`.
2. Usar endpoints de agenda, profesionales, horarios, excepciones, bloqueos
   y servicios según el rol.
3. Enviar CSRF en toda escritura.
4. Tratar `409` como conflicto de disponibilidad/estado y no asumir que el
   cambio se aplico.

No estan implementados en este backend endpoints para editar datos publicos
del negocio, consultar auditoria, estadisticas, no-shows historicos,
eliminacion de cuenta ni gestion de permisos de empleados. Angular no debe
crear clientes para esos flujos como si existieran.

## 10. Recomendaciones de integracion Angular

- Separar servicios `AuthApi`, `ServiciosApi`, `DisponibilidadApi`,
  `ReservasApi`, `HorariosApi` y `AdminApi`.
- Centralizar `withCredentials` en un interceptor HTTP.
- Centralizar la obtencion y el envio de `X-CSRF-TOKEN`; no duplicar el token
  en cada componente.
- Usar un interceptor de errores para distinguir `401`, `403`, `409` y `429`.
  Respetar `Retry-After` y no reintentar automaticamente escrituras no
  idempotentes.
- Tratar las validaciones de Angular como ayuda de UX, nunca como control de
  permisos, propiedad, disponibilidad, limites o antelacion.
- Configurar la URL base mediante los entornos de Angular, sin hardcodearla
  en los servicios.
- Probar desde el origen final el intercambio de `JSESSIONID`, CORS,
  credenciales y CSRF antes de fijar el dominio de produccion.

## 11. Pendientes definitivos

### Bloqueos funcionales confirmados

No se ha confirmado un defecto funcional bloqueante para iniciar Angular tras
la correccion de CORS para permitir el encabezado real `X-CSRF-TOKEN`.
El backend supera la suite existente y los contratos anteriores.

### Decisiones o requisitos de negocio

- Aprobar los periodos de retencion del outbox (`SENT`, `FAILED` y
  `CANCELLED`) y revisarlos desde privacidad.
- Aprobar la retencion y el procedimiento operativo de consulta de la
  auditoria administrativa.
- Definir textos legales, privacidad, condiciones y conservacion de datos
  antes del lanzamiento.
- Confirmar el origen final de Angular y la politica de cookies entre
  dominios.
- Mantener V1 en una sola instancia mientras la sesion sea local al proceso.

### Despliegue externo

- Crear y validar una imagen Docker reproducible de la aplicacion; no existe
  una imagen confirmada actualmente.
- Configurar y validar Coolify/VPS con una unica replica, PostgreSQL privado,
  variables de entorno y TLS.
- Confirmar dominio y DNS/TLS con DonDominio.
- Configurar Resend, dominio remitente, limites y pruebas de entrega sin
  asumir que estan resueltos.
- Ejecutar pruebas de staging de login, reservas, concurrencia, cookies,
  healthchecks y migraciones.
- Configurar backups fuera del servidor y probar restauracion.
- Aceptar el limite residual de recordatorios: un mensaje ya aceptado por el
  proveedor no se puede retirar.

Este documento no declara preparado el despliegue real ni el envio real de
correo. Declara el contrato verificable para comenzar el desarrollo Angular.
