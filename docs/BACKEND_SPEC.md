# Barbería Mekina — Especificación funcional de la V1

**Estado:** borrador consolidado de requisitos  
**Versión:** 1.0  
**Idioma inicial:** español  
**Zona horaria de la barbería:** `Europe/Madrid`

> Este documento recoge las decisiones acordadas para la primera versión
> (V1). No sustituye una revisión legal ni las decisiones técnicas que
> dependan de inspeccionar el frontend existente. El frontend se deja pendiente
> de revisar la web actual de Lovable antes de decidir si se reutiliza o
> se rehace.

---

## 1. Objetivo y alcance

Desarrollar el backend de reservas de Barbería Mekina con Java y Spring
Boot, PostgreSQL y Flyway. La V1 permitirá a los clientes consultar
servicios y disponibilidad, reservar y gestionar sus citas, y al barbero
administrar la agenda y los datos operativos desde un panel privado.

La solución se planteará como un **monolito modular**, no como
microservicios. Aunque inicialmente haya un único barbero, el diseño no
debe impedir añadir más profesionales en el futuro.

### Incluido en la V1

-   Catálogo público de servicios.
-   Consulta pública de disponibilidad.
-   Registro e inicio de sesión de clientes.
-   Reservas, modificaciones y cancelaciones con las reglas definidas en
    este documento.
-   Panel privado para el barbero y funciones administrativas
    autorizadas.
-   Gestión de horarios, excepciones, vacaciones y bloqueos.
-   Gestión de servicios y precios.
-   Historial de citas y ausencias.
-   Emails operativos y de seguridad.
-   Auditoría de operaciones administrativas excepcionales.
-   Copias de seguridad, monitorización básica y registros técnicos
    seguros.
-   Pruebas automáticas de reglas críticas y validación manual antes del
    despliegue.

### Fuera del alcance de la V1

-   Pagos online.
-   Registro de pagos en el local.
-   SMS.
-   Promociones y emails de marketing.
-   Analítica no esencial, cookies publicitarias y seguimiento no
    necesario.
-   Sistema interno de tickets de soporte.
-   Sanciones automáticas por ausencias.
-   Multidioma en el lanzamiento: solo español, aunque el sistema debe
    poder internacionalizarse después.
-   Estadísticas avanzadas de negocio, comparativas complejas o
    contabilidad.

---

## 2. Tecnología y arquitectura

### Tecnología acordada

-   Java 25.
-   Spring Boot.
-   Maven Wrapper para construir y ejecutar el proyecto.
-   PostgreSQL.
-   Flyway para migraciones de esquema.
-   Docker para la infraestructura.
-   VPS con Docker y Coolify para producción.
-   Desarrollo local y producción separados.

### Reglas técnicas importantes

-   Hibernate debe validar el esquema, no crear ni modificar tablas
    automáticamente (`ddl-auto: validate`).
-   Las tablas y cambios de esquema se gestionan mediante migraciones
    Flyway.
-   No incluir contraseñas, tokens ni secretos en el repositorio.
-   Las variables sensibles se suministran mediante variables de entorno
    o secretos del entorno de despliegue.
-   Las reservas deben protegerse contra solapamientos y solicitudes
    simultáneas en la lógica de aplicación y en PostgreSQL.
-   Las operaciones de cambio de cita deben ser transaccionales y
    atómicas.
-   El diseño debe mantener módulos de negocio separados dentro de un
    único backend.

### Módulos lógicos sugeridos

-   `services`: catálogo y configuración de servicios.
-   `schedules`: horario habitual, excepciones, vacaciones y bloqueos.
-   `bookings`: reservas, cambios, cancelaciones y estados.
-   `customers`: perfiles e historial de clientes.
-   `security`: autenticación, sesiones, roles y recuperación de
    contraseña.
-   `notifications`: emails y reintentos.
-   `admin`: operaciones de gestión y auditoría.
-   `common`: utilidades compartidas, errores y configuración
    transversal.

Los nombres son una propuesta organizativa; pueden ajustarse durante la
implementación sin alterar las reglas de negocio.

---

## 3. Usuarios, roles y autenticación

### Roles

El sistema debe contemplar estos roles:

-   **Cliente:** consultar y gestionar sus propias reservas.
-   **Barbero:** consultar el calendario y las reservas; crear citas
    manuales y gestionar sus estados; administrar servicios, precios,
    horarios, vacaciones y bloqueos; consultar fichas e historial de
    clientes; y consultar estadísticas del negocio.
-   **Administrador:** dispone de las capacidades del barbero y, además,
    puede gestionar los datos públicos del negocio, las cuentas y los
    permisos de empleados, y ejecutar operaciones excepcionales sujetas
    a autorización, motivo obligatorio y auditoría.

El barbero no podrá modificar los datos públicos del negocio ni gestionar
cuentas o permisos de empleados. Los permisos se comprobarán siempre en el
backend; no basta con ocultar opciones en el frontend.

### Cuenta de cliente

Para registrarse, el cliente facilitará:

-   Nombre.
-   Email.
-   Teléfono.
-   Contraseña.

Reglas acordadas:

-   No exigir verificación obligatoria del email al registrarse.
-   Permitir contraseñas de al menos 6 caracteres, sin obligar a mezclar
    mayúsculas, números y símbolos.
-   Permitir contraseñas numéricas, aunque se recomendará elegir una
    contraseña más larga y difícil de adivinar.
-   Bloquear contraseñas demasiado comunes cuando sea viable.
-   Aplicar límites a intentos de inicio de sesión y creación de
    cuentas.
-   Almacenar contraseñas usando un algoritmo de hash seguro; nunca en
    texto plano.
-   Mantener la sesión iniciada de forma segura en el dispositivo para
    no pedir la contraseña en cada visita.
-   Permitir recuperar la contraseña mediante un enlace de un solo uso y
    con caducidad enviado por email.
-   No revelar si una dirección de email está registrada al responder a
    solicitudes de recuperación.
-   No asociar una reserva a una cuenta existente basándose únicamente
    en el número de teléfono.

### Cuenta administrativa

-   No habrá registro público de administradores.
-   La cuenta inicial se creará mediante un procedimiento seguro de
    configuración.
-   El acceso al panel tendrá una ruta o pantalla diferenciada.
-   La separación visual no sustituye la autorización del backend.
-   La cuenta administrativa tendrá contraseña segura, límites de
    intentos, sesiones protegidas y recuperación controlada.
-   La V1 no exige segundo factor obligatorio, pero la arquitectura
    puede permitir añadirlo posteriormente.

### Sesiones y privacidad de reservas

-   Cada cliente solo podrá consultar, cancelar o modificar sus propias
    citas.
-   La propiedad de cada cita se verificará en el backend en todas las
    operaciones.
-   La interfaz nunca será la única barrera de autorización.

---

## 4. Catálogo de servicios

Cada servicio tendrá, como mínimo:

-   Nombre.
-   Descripción.
-   Precio fijo en euros.
-   Duración en minutos.
-   Estado activo/inactivo.

Reglas:

-   El catálogo será público.
-   Las personas podrán consultar nombre, descripción, duración y precio
    sin iniciar sesión.
-   El cliente podrá seleccionar varios servicios para una misma cita.
-   El precio total será la suma de los servicios elegidos.
-   La duración total será la suma de sus duraciones.
-   No habrá un margen adicional obligatorio entre citas.
-   Los horarios de inicio disponibles se ofrecerán en intervalos de 15
    minutos; esto no cambia la duración real de los servicios.
-   Si un servicio deja de ofrecerse, se desactivará en vez de
    eliminarse físicamente si ya está asociado a citas históricas.
-   El panel permitirá crear, editar, activar y desactivar servicios.

### Precio y duración históricos

Al reservar, se guardará una copia del precio y de la duración de cada
servicio seleccionado. Si más adelante cambia el catálogo, las citas
existentes conservarán sus valores originales.

---

## 5. Horarios y disponibilidad

### Horario habitual

-   El barbero configurará desde el panel un horario semanal habitual.
-   El horario podrá editarse por día de la semana.
-   El panel permitirá gestionar excepciones, vacaciones, festivos y
    cierres puntuales.
-   Se podrá cerrar un día completo o bloquear un intervalo horario.
-   Los horarios públicos informativos deberán mantenerse coherentes con
    el horario configurado que determina la disponibilidad reservable.
-   El horario inicial se configurará desde el panel antes de abrir las
    reservas al público.

### Zona horaria

-   Usar `Europe/Madrid`.
-   Gestionar automáticamente los cambios de hora oficiales.
-   Guardar y comparar fechas de forma coherente, evitando errores en
    los cambios de horario de verano e invierno.

### Cálculo de disponibilidad

-   Mostrar solo los inicios disponibles para los servicios
    seleccionados.
-   El cliente elige primero uno o varios servicios y después el día y
    la hora.
-   Solo se muestran días dentro de los próximos 30 días, contando desde
    la fecha/hora local de la barbería.
-   La reserva debe hacerse con al menos 2 horas de antelación.
-   Los inicios posibles se ofrecen cada 15 minutos.
-   La duración real del conjunto de servicios determina cuánto tiempo
    se ocupa.
-   Una cita puede comenzar justo cuando termina la anterior.
-   No se mostrarán datos de otros clientes al consultar la
    disponibilidad.
-   La disponibilidad mostrada en pantalla es orientativa hasta que el
    backend confirma la reserva; el servidor vuelve a comprobarla al
    guardar.

### Prevención de solapamientos

-   No se puede confirmar más de una reserva que ocupe el mismo
    intervalo del barbero.
-   La protección debe funcionar también si dos clientes envían la
    solicitud simultáneamente.
-   La regla se debe garantizar mediante transacciones y mecanismos
    adecuados en PostgreSQL, no solo mediante una comprobación previa en
    Java. El mecanismo concreto se definirá al diseñar el esquema y se
    cubrirá con pruebas de concurrencia.

---

## 6. Reservas y reglas de negocio

### Creación de una reserva

-   La cuenta es obligatoria para confirmar una reserva.
-   Se permite explorar servicios y disponibilidad sin iniciar sesión.
-   Las reservas online se confirman automáticamente cuando se guardan
    correctamente.
-   La reserva debe guardar los servicios seleccionados, sus precios y
    duraciones históricas, el precio total y la duración total.
-   Debe guardarse el registro de aceptación de las condiciones de
    reserva.
-   Si falla el email de confirmación, la reserva sigue confirmada.

### Límites por cliente

-   Máximo de **3 citas futuras** por cliente.
-   Máximo de **1 cita por cliente y día**.
-   Se aplican ambos límites en el backend.
-   Las comprobaciones deben protegerse frente a solicitudes
    simultáneas.

### Modificación

-   El cliente podrá modificar una cita cuando falten al menos 24 horas
    para la hora original de la cita.
-   El nuevo horario debe respetar también la antelación mínima de 2
    horas.
-   La modificación debe realizarse como una sola operación atómica.
-   Si el nuevo horario no está disponible o la operación falla, se
    conserva la cita original.
-   No se debe cancelar la cita original antes de garantizar que el
    cambio se puede completar.

### Cancelación

-   El cliente puede cancelar online cuando falten al menos 24 horas
    para la cita.
-   Si faltan menos de 24 horas, la aplicación bloquea la cancelación
    online e indica que debe contactar con la barbería.
-   Una cancelación válida libera inmediatamente el hueco, siempre que
    siga siendo elegible según las reglas de disponibilidad.
-   Se conserva el registro de la cita cancelada.

### Citas creadas por el barbero

-   El barbero podrá introducir citas solicitadas por teléfono o
    presencialmente.
-   Las citas manuales quedarán confirmadas por defecto.
-   Para una cita manual bastará con registrar el nombre y el teléfono del
    cliente; no será obligatorio que tenga una cuenta online.
-   Si el cliente ya tiene una cuenta, el barbero podrá vincular la cita a
    esa cuenta. La vinculación será opcional y nunca se realizará solo por
    coincidencia automática del teléfono: el barbero deberá seleccionar y
    confirmar explícitamente la cuenta correcta.
-   Las citas manuales sin cuenta conservarán una ficha de contacto
    independiente, con las garantías de privacidad y acceso aplicables.
-   El barbero podrá bloquear tramos horarios por motivos personales u
    operativos.
-   Las operaciones excepcionales estarán sujetas a permisos, requerirán
    un motivo y quedarán registradas en auditoría.

### Estados de una cita

Estados previstos:

-   Pendiente.
-   Confirmada.
-   Completada.
-   Cancelada.
-   No presentado.

Las reservas online y las citas manuales quedan confirmadas por defecto
al crearse correctamente. El estado pendiente queda disponible para los
flujos que lo necesiten, pero no es el estado habitual de una reserva
online.

### Historial

-   Conservar citas canceladas y completadas.
-   Registrar las ausencias.
-   Mantener los cambios de estado necesarios para el historial y la
    auditoría, sin borrar físicamente las citas canceladas.
-   No aplicar sanciones automáticas.
-   El barbero podrá decidir manualmente si restringe futuras reservas
    de un cliente con ausencias repetidas, con permisos y registro de
    auditoría cuando corresponda.

---

## 7. Panel privado

### Calendario y citas

El panel tendrá:

-   Vista diaria y semanal del calendario.
-   Acceso al detalle de cada cita.
-   Gestión de estados de citas.
-   Creación de citas manuales.
-   Cancelación y modificación de citas conforme a los permisos.
-   Bloqueo de intervalos y días completos.

### Servicios y configuración

El personal autorizado podrá:

-   Crear y editar servicios.
-   Cambiar precios y duraciones.
-   Activar o desactivar servicios.
-   Configurar el horario semanal.
-   Gestionar vacaciones, festivos y excepciones.
-   Editar datos públicos de la barbería.

### Ficha de cliente

La ficha mostrará:

-   Nombre.
-   Email.
-   Teléfono.
-   Historial de citas.
-   Ausencias registradas.

No se incluirán notas internas, etiquetas ni perfiles avanzados de
clientes en la V1.

### Estadísticas

Incluir un resumen sencillo por periodo de:

-   Citas completadas.
-   Citas canceladas.
-   Ausencias.

No se requiere un módulo de contabilidad ni estadísticas avanzadas.

### Datos públicos editables

Un administrador podrá gestionar desde el panel:

-   Dirección.
-   Teléfono.
-   Horarios públicos.
-   Enlaces a redes sociales, si están configurados.

---

## 8. Emails y notificaciones

### Emails incluidos

Solo se enviarán emails operativos y de seguridad:

-   Confirmación de reserva.
-   Cambios de cita.
-   Cancelaciones.
-   Recordatorio de cita.
-   Recuperación de contraseña.

No se enviarán promociones ni emails de marketing en la V1.

### Recordatorios

-   Enviar un recordatorio 24 horas antes de la cita.
-   Si una cita se crea cuando ya no quedan 24 horas, no enviar un
    recordatorio tardío.
-   Si se modifica o cancela una cita, actualizar o cancelar el
    recordatorio pendiente correspondiente.

### Fallos y reintentos

-   Un fallo de email no cancela ni revierte una reserva.
-   Los envíos pendientes deben registrarse de forma persistente.
-   Reintentar automáticamente los envíos fallidos.
-   El mecanismo debe sobrevivir a reinicios del servidor.
-   No duplicar innecesariamente los mensajes en caso de reintento.
-   El proveedor de email debe poder sustituirse sin rehacer la lógica
    de reservas.
-   Se buscará inicialmente un proveedor con plan gratuito adecuado,
    verificando límites, condiciones y fiabilidad antes del lanzamiento.
    Esta es la opción elegida para la V1; el proveedor concreto queda por seleccionar.

---

## 9. Privacidad y condiciones

-   Mostrar política de privacidad y aviso legal.
-   Mostrar las condiciones de reserva y registrar su aceptación.
-   Solicitar consentimiento expreso cuando sea legalmente necesario.
-   Mantener el consentimiento de privacidad separado de cualquier
    consentimiento de marketing.
-   No enviar marketing en la V1.
-   No usar analítica no esencial ni seguimiento publicitario en la V1.
-   Permitir solicitar la eliminación de la cuenta desde el perfil, con
    confirmación.
-   Borrar o anonimizar los datos cuando proceda.
-   Conservar únicamente los datos que sea necesario mantener por
    obligaciones legales u otra base legítima aplicable.
-   Definir una política de conservación y revisarla legalmente antes
    del lanzamiento.
-   La eliminación de una cuenta no debe borrar automáticamente
    registros que deban conservarse legalmente.
-   Recoger únicamente los datos personales necesarios para prestar el
    servicio.

La política de privacidad, el aviso legal, las condiciones de reserva y
los plazos concretos de conservación deben revisarse para la actividad
real de la barbería antes de publicar la web.

---

## 10. Errores y operaciones excepcionales

-   Mostrar mensajes claros a los clientes, sin detalles internos de
    Java, SQL, tokens ni infraestructura.
-   Cuando una operación no pueda completarse, explicar que no se ha
    completado y permitir volver a intentarlo cuando sea seguro.
-   Si falla una modificación, conservar la reserva original.
-   Si falla un email, conservar la reserva y reintentar el envío.
-   Las operaciones administrativas excepcionales requerirán permisos,
    motivo obligatorio y auditoría.
-   El soporte se realizará mediante el teléfono o email público de la
    barbería.
-   No se implementará un sistema interno de tickets.

---

## 11. Infraestructura y operaciones

### Despliegue

-   VPS con Docker y Coolify.
-   Backend y PostgreSQL autogestionados.
-   Entorno de desarrollo local separado de producción.
-   No probar cambios destructivos directamente en producción.
-   Mantener los secretos fuera del repositorio.

### Base de datos y migraciones

-   PostgreSQL será la fuente de persistencia.
-   Flyway gestionará las migraciones.
-   Hibernate validará el esquema (`ddl-auto: validate`).
-   No usar generación automática de esquema como sustituto de las
    migraciones.
-   Las restricciones críticas de reservas deben reforzarse en la base
    de datos cuando corresponda.

### Copias de seguridad

-   Copias de seguridad diarias.
-   Almacenamiento fuera del servidor principal.
-   Definir posteriormente la política de retención.
-   Probar periódicamente la restauración de las copias.

### Monitorización y logs

-   Comprobar disponibilidad de la aplicación y de PostgreSQL.
-   Registrar errores y eventos importantes.
-   No registrar contraseñas, tokens, credenciales ni datos personales
    innecesarios.
-   No mostrar detalles sensibles en mensajes públicos de error.

---

## 12. Pruebas y criterios de aceptación

Antes del lanzamiento deben existir pruebas automáticas para las reglas
críticas, además de comprobaciones manuales.

### Reservas y disponibilidad

-   No se permiten reservas solapadas.
-   Dos solicitudes simultáneas para el mismo hueco no pueden confirmar
    ambas.
-   Se respetan los 30 días de horizonte.
-   Se respetan las 2 horas de antelación mínima.
-   Los inicios se ofrecen en intervalos de 15 minutos.
-   La duración real de los servicios se respeta.
-   Los cierres, vacaciones y bloqueos impiden reservar en sus
    intervalos.
-   Una cancelación válida libera el hueco.
-   La modificación es atómica y conserva la cita original si falla.
-   Se respetan los límites de 3 citas futuras y 1 cita por cliente y
    día.

### Seguridad

-   Un cliente no puede consultar ni modificar citas ajenas.
-   Los endpoints administrativos requieren permisos adecuados.
-   No hay registro público de administradores.
-   Los intentos de inicio de sesión están limitados.
-   La recuperación de contraseña utiliza enlaces seguros, temporales y
    de un solo uso.
-   Los mensajes de recuperación no revelan si una cuenta existe.
-   No se guardan contraseñas en texto plano.
-   Los errores no exponen información interna sensible.

### Emails

-   Se envía confirmación tras una reserva correcta.
-   El fallo del email no revierte la reserva.
-   Los envíos fallidos se reintentan.
-   El recordatorio se programa para 24 horas antes y no se envía tarde.
-   Los recordatorios se actualizan al modificar o cancelar una cita.

### Operaciones

-   Las migraciones Flyway se ejecutan correctamente en un entorno
    limpio.
-   Las copias de seguridad pueden restaurarse.
-   Los logs no contienen secretos.
-   Se verifica manualmente el flujo completo antes del despliegue.

### Lanzamiento

1.  Desplegar en un entorno de pruebas.
2.  Validar los flujos con el barbero.
3.  Corregir incidencias.
4.  Comprobar copias de seguridad, restauración y configuración de
    emails.
5.  Abrir la aplicación al público.

---

## 13. Frontend e integración con Lovable

**Decisión provisional de la V1:** partir de la web existente en Lovable y
reutilizarla conectándola al nuevo backend Java, siempre que la revisión
técnica confirme que es viable. No rehacer el frontend desde cero sin una
razón funcional o técnica clara.

Antes de cerrar el contrato de API:

- Inspeccionar las pantallas, flujos y código disponibles en Lovable.
- Identificar qué partes pueden reutilizarse y cuáles necesitan cambios.
- Diseñar una API clara y documentada, desacoplada de la tecnología de frontend.
- Si la revisión demuestra que reutilizar Lovable no es viable, evaluar
  alternativas, incluido Angular, antes de cambiar la decisión.

La revisión técnica sigue pendiente; la opción de partida acordada es
reutilizar la web actual, no dejar el frontend completamente sin decidir.

---

## 14. Decisiones pendientes de concretar durante la implementación

No son nuevos bloques funcionales; son detalles operativos que deben
cerrarse antes del lanzamiento o al diseñar la solución técnica:

-   Revisar la web de Lovable para confirmar qué pantallas y flujos pueden
    reutilizarse con el backend Java.
-   Seleccionar un proveedor de email que tenga un plan gratuito adecuado
    y comprobar sus límites, condiciones y fiabilidad reales antes del lanzamiento.
-   Definir el procedimiento seguro de creación inicial de la cuenta
    administrativa.
-   Establecer la política concreta de retención de copias de seguridad.
-   Establecer la política legal de conservación de datos y los textos
    legales.
-   Definir los datos exactos de configuración inicial de la barbería:
    servicios, precios, duraciones, horarios, dirección, teléfono y
    redes sociales.
-   Determinar los plazos de retención de logs y auditoría.
-   Definir el mecanismo técnico de sesión persistente según el frontend
    y el despliegue.
-   Concretar los mecanismos de integridad en PostgreSQL para impedir
    solapamientos y límites concurrentes.

---

## 15. Orden de implementación sugerido

Implementar en fases pequeñas, con pruebas y commits separados:

1.  **Configuración y base de datos:** estructura de paquetes,
    configuración por entorno, Flyway y migración inicial.
2.  **Servicios:** catálogo público y gestión administrativa de
    servicios.
3.  **Horarios y disponibilidad:** horario semanal, excepciones, cierres
    y cálculo de huecos.
4.  **Seguridad:** cuentas, contraseñas, sesiones, recuperación y roles.
5.  **Reservas:** creación, concurrencia, límites, modificaciones,
    cancelaciones y estados.
6.  **Panel y clientes:** calendario, citas manuales, ficha de cliente e
    historial.
7.  **Emails:** confirmaciones, cambios, recordatorios, cola persistente
    y reintentos.
8.  **Privacidad y auditoría:** aceptación de condiciones, solicitudes
    de eliminación y registro de operaciones excepcionales.
9.  **Operaciones:** Docker, Coolify, copias de seguridad,
    monitorización y logs.
10. **Validación final:** pruebas automáticas, revisión manual, prueba
    con el barbero y lanzamiento.

No implementar todas las fases en un único cambio. Cada fase debe
compilar, tener pruebas apropiadas y quedar revisada antes de continuar.

---

## 16. Principios que no deben romperse

1.  La disponibilidad visible no garantiza la reserva: el backend debe
    volver a validarla al confirmar.
2.  Nunca deben existir dos reservas confirmadas que ocupen el mismo
    intervalo del barbero.
3.  Los límites de reservas deben comprobarse de forma segura frente a
    concurrencia.
4.  Una modificación fallida nunca debe hacer perder la cita original.
5.  Un fallo de email no debe cancelar una reserva.
6.  Los clientes solo acceden a sus propias citas.
7.  Los permisos administrativos se verifican en el backend.
8.  Los precios y duraciones históricos no cambian cuando se edita el
    catálogo.
9.  Los datos sensibles no se guardan en el repositorio ni se escriben
    en logs.
10. Las migraciones de base de datos se gestionan con Flyway.
11. Las copias de seguridad deben poder restaurarse.
12. No se añaden pagos online, SMS, marketing ni analítica no esencial a
    la V1 sin una decisión explícita posterior.

---

**Resultado esperado de la V1:** una aplicación de reservas utilizable
en producción, con catálogo público, disponibilidad fiable, cuentas y
permisos seguros, gestión diaria desde el panel, emails operativos,
historial, protección de datos y un proceso de despliegue recuperable.
