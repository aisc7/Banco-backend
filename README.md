# Banco-backend

Backend REST para gestión de clientes, préstamos, cuotas, auditoría, reportes, empleados y notificaciones.

Este README amplía la documentación existente con detalles útiles para el equipo de frontend: cómo autenticarse, comportamiento de autorización, contratos de las rutas más importantes, ejemplos (PowerShell), variables de entorno necesarias, la lógica de negocio implementada y las pruebas que se han ejecutado.

Nota: para una especificación completa y contrato por endpoint, revisa `docs/README-2.0.md` (API Contract y Guía de Implementación).

**Base URL**

- `http://<host>:<port>`
- Salud del servicio: `GET /health` → `{ "status": "ok" }`

**Prefijo API**

- Todos los endpoints están bajo `/api/*`.

**Formato de respuesta y errores**

- Respuestas exitosas frecuentemente: `{ ok: true, result: <datos> }` o `{ success: true, data: <datos>, message: <texto> }` según controlador.
- Errores de validación/reglas: `400 Bad Request` con `{ ok: false, error: <mensaje> }` o `{ success:false, data:null, message: <texto> }`.
- `401 Unauthorized` → falta token o token inválido.
- `403 Forbidden` → token válido pero sin permisos para la acción.
- `404 Not Found` → recurso no encontrado.
- `409 Conflict` → conflicto de duplicidad (p.ej., cédula).

**Convenciones**

- Fechas: `YYYY-MM-DD`.
- Cédula (`ci`): numérica.
- Content-Type: `application/json` salvo donde se indique `multipart/form-data`.

**Variables de entorno (mínimas necesarias)**

- `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_SERVICE` → configuración de Oracle (ver `src/config/oracle.js`).
- `PORT` → puerto donde corre la API (por defecto `3000`).
- `JWT_SECRET` → clave para firmar tokens JWT (asegurar que no incluya caracteres problemáticos o espacios extra).
- `JWT_EXPIRY` → tiempo de expiración del token (ej. `1h`).
- `BCRYPT_SALT_ROUNDS` → rounds para `bcrypt` (ej. `10`).
 - `SOLICITUDES_SEQ_NAME` → nombre de la secuencia usada para `SOLICITUDES_PRESTAMOS.id_solicitud_prestamo`. Si no se define, el backend intentará usar un trigger `BEFORE INSERT` + `RETURNING` para obtener el ID.

Coloca estas variables en un `.env` en la raíz o en tu entorno de ejecución.

**Autenticación y autorización**

- Login: `POST /api/auth/login` con body `{ "username": "...", "password": "..." }`.
  - Respuesta exitosa: `{ success: true, data: { token: "<JWT>" }, message: "Autenticado" }`.
  - El token es un JWT con payload: `{ id, username, role, id_prestatario?, id_empleado?, iat, exp }`.
- Roles soportados en el backend (mayores relevantes):

  - `EMPLEADO`: puede listar y operar sobre solicitudes y préstamos de forma global (acciones administrativas).
  - `PRESTATARIO`: usuario cliente. Debe poder crear solicitudes de préstamo, ver y pagar sus propias cuotas y ver sus préstamos.

- Uso del token: enviar header `Authorization: Bearer <token>` en todas las peticiones a rutas protegidas.

## Endpoints (completos)

Base: `http://localhost:3000`

### Auth (`src/routes/auth.routes.js`)
- `POST /api/auth/login` → Login. Body `{ username, password }`. Responde `{ success, data: { token }, message }`.
- `POST /api/auth/register-prestatario` → Crear prestatario + usuario (rol PRESTATARIO). Body: ver sección de registro.
- `POST /api/auth/register-empleado` → Crear empleado + usuario (rol EMPLEADO). Body: ver sección de registro.

### Prestatarios (`src/routes/prestatarios.routes.js`)
- `GET /api/prestatarios` (EMPLEADO) → Lista todos los prestatarios.
- `GET /api/prestatarios/:id` (EMPLEADO o dueño mediante `allowEmployeeOrOwner`) → Detalle por `id_prestatario`.
- `POST /api/prestatarios` (EMPLEADO) → Crear prestatario (si no usas el registro desde `auth`).
- `PUT /api/prestatarios/:id` (EMPLEADO) → Actualizar prestatario.
- `DELETE /api/prestatarios/:id` (EMPLEADO) → Eliminar/inhabilitar prestatario.
- `POST /api/prestatarios/upload-photo/:id` (EMPLEADO o dueño) → Subir foto (multipart/form-data).
 - `POST /api/prestatarios/upload-masivo` (EMPLEADO) → Carga masiva desde CSV/JSON (alias de `/carga-masiva`).
 - `GET /api/prestatarios/morosos` (EMPLEADO) → Lista prestatarios con cuotas vencidas impagas.

### Empleados (`src/routes/empleados.routes.js`)
- `GET /api/empleados` (EMPLEADO) → Lista empleados.
- `GET /api/empleados/:id` (EMPLEADO) → Detalle empleado.
- `POST /api/empleados` (EMPLEADO) → Crear empleado (alternativo al registro por `auth`).
- `PUT /api/empleados/:id` (EMPLEADO) → Actualizar empleado.
- `DELETE /api/empleados/:id` (EMPLEADO) → Eliminar/inhabilitar empleado.

### Préstamos (`src/routes/prestamos.routes.js`)
- `GET /api/prestamos` (EMPLEADO) → Lista global de préstamos.
- `GET /api/prestamos/mis-prestamos` (PRESTATARIO) → Lista préstamos del prestatario autenticado.
- `GET /api/prestamos/prestatario/:ci` (EMPLEADO o dueño via `allowEmployeeOrOwner`) → Lista por cédula (CI). Nota: usar CI real, no `id_prestatario`.
- `GET /api/prestamos/:idPrestamo` (EMPLEADO o dueño via `allowEmployeeOrOwner`) → Detalle préstamo.
- `POST /api/prestamos` (PRESTATARIO o EMPLEADO) → Crear solicitud/préstamo. Body `{ id_prestatario?, monto, nro_cuotas, tipo_interes? }`. Si es PRESTATARIO, se fuerza su propio `id_prestatario` y se infiere `tipo_interes` según cuotas.
- `PUT /api/prestamos/:idPrestamo` (EMPLEADO) → Actualizar (e.g., `estado`).
- `DELETE /api/prestamos/:idPrestamo` (EMPLEADO) → Cancelar (marca `ESTADO='CANCELADO'`).
- `POST /api/prestamos/:idPrestamo/refinanciaciones` → Registrar refinanciación (PL/SQL `PAK_PRESTAMOS.PRO_REGISTRAR_REFINANCIACION`). Body `{ nro_cuotas }`.

Campos principales (tabla PRESTAMOS): `ID_PRESTAMO`, `ID_SOLICITUD_PRESTAMO`, `ID_PRESTATARIO`, `TOTAL_PRESTADO`, `NRO_CUOTAS`, `INTERES`, `FECHA_EMISION`, `FECHA_VENCIMIENTO`, `ESTADO`.

### Cuotas (`src/routes/cuotas.routes.js`)
- `GET /api/cuotas` (EMPLEADO) → Lista global de cuotas.
- `GET /api/cuotas/prestamo/:idPrestamo` (EMPLEADO o dueño via `allowEmployeeOrOwner`) → Lista cuotas por préstamo.
- `GET /api/cuotas/:idCuota` (EMPLEADO o dueño) → Detalle cuota.
- `POST /api/cuotas/:idCuota/pagar` (EMPLEADO o PRESTATARIO dueño) → Registrar pago. Body `{ fecha_pago, monto_pagado, metodo }`. Valida estado y vencimiento.

### Solicitudes de préstamo (`src/routes/solicitudes.routes.js`)
- `POST /api/solicitudes` (PRESTATARIO o EMPLEADO) → Crear solicitud de préstamo. Body `{ monto, nro_cuotas, id_empleado? }`. Si es PRESTATARIO, se usa su `id_prestatario` del token.
- `GET /api/solicitudes/mis-solicitudes` (PRESTATARIO) → Lista solicitudes del prestatario autenticado.
- `PUT /api/solicitudes/:id/aprobar` (EMPLEADO) → Aprueba solicitud y crea préstamo basado en `monto` y `nro_cuotas`.
- `PUT /api/solicitudes/:id/rechazar` (EMPLEADO) → Rechaza solicitud. Body `{ motivo? }`.

### Reportes (`src/routes/reportes.routes.js`)
- `GET /api/reportes/prestamos` (EMPLEADO) → Reporte global de préstamos.
- `GET /api/reportes/prestatarios` (EMPLEADO) → Reporte global de prestatarios.
- `GET /api/reportes/extracto/:idPrestatario` (EMPLEADO o dueño) → Extracto financiero mensual del cliente.

### Notificaciones (`src/routes/notificaciones.routes.js`)
- `GET /api/notificaciones` (EMPLEADO) → Lista notificaciones.
- `GET /api/notificaciones/prestatario/:id` (EMPLEADO o dueño) → Notificaciones por prestatario.
- `POST /api/notificaciones/enviar` (EMPLEADO) → Enviar correo de recordatorio. Body `{ id_prestatario, asunto, cuerpo }`.

### Auditoría (`src/routes/auditoria.routes.js`)
- `GET /api/auditoria/logs` (EMPLEADO) → Listar LOG_AUDITORIA con filtros y paginación. Query params: `usuario?`, `accion?`, `tabla?`, `desde?`, `hasta?`, `page?`, `pageSize?`.

### Salud
- `GET /health` → `{ status: 'ok' }`

Observaciones de seguridad y middlewares:
- `auth` obliga JWT en `Authorization: Bearer <token>`.
- `requireRole('EMPLEADO'|'PRESTATARIO')` bloquea por rol.
- `allowEmployeeOrOwner` permite EMPLEADO o el dueño del recurso (por `id_prestatario`).
- `auditoria('TABLA','ACCION')` registra operaciones de mutación.

## Casos de Uso Esenciales (conexión a endpoints)

1. Solicitud de préstamo por parte de un cliente
  - Flujo: PRESTATARIO logueado → `POST /api/prestamos` con `{ monto, nro_cuotas }`. El backend asigna `id_prestatario` del token e infiere `tipo_interes`.
  - Validación: máximo 2 préstamos `ACTIVO` por prestatario (reglas de negocio en PL/SQL).

2. Pago oportuno o tardío de cuotas
  - Flujo: dueño del préstamo o EMPLEADO → `POST /api/cuotas/:idCuota/pagar` `{ fecha_pago, monto_pagado, metodo }`.
  - Reglas: valida estado/vencimiento; actualiza saldo/estado.

3. Clasificación de cliente moroso
  - Flujo: consultar cuotas vencidas y estado del cliente.
  - Endpoints: `GET /api/cuotas/prestamo/:idPrestamo` + `GET /api/prestamos/mis-prestamos` (cliente) o `GET /api/prestamos` (empleado).
  - Criterios sugeridos en frontend: moroso si tiene cuotas vencidas impagas a la fecha actual.

4. Generación de extracto financiero mensual
  - Flujo: `GET /api/reportes/extracto/:idPrestatario`.
  - Entradas: mes/año (si el backend los soporta como query params; si no, generar por rango desde/hasta en frontend).

5. Carga masiva de nuevos clientes
  - Flujo: EMPLEADO sube archivo y llama a `POST /api/prestatarios` por lote (o implementar un endpoint de carga masiva si se añade).
  - Alternativo: usar `POST /api/auth/register-prestatario` repetidamente.

6. Registro de refinanciación o nuevo préstamo
  - Nuevo préstamo: `POST /api/prestamos`.
  - Refinanciación: `POST /api/prestamos/:idPrestamo/refinanciaciones` `{ nro_cuotas }`.

7. Envío de correo automático de recordatorio
  - Flujo: EMPLEADO → `POST /api/notificaciones/enviar`.
  - Plantillas: gestionar en frontend/servidor según necesidad; el backend recibe `asunto/cuerpo`.

8. Auditoría de usuarios y operaciones realizadas
  - Flujo: `GET /api/auditoria/logs` con filtros.
  - Mutaciones relevantes usan middleware de auditoría.

## Ejemplos de Postman (rápidos)

- Login (obtener token): `POST http://localhost:3000/api/auth/login` Body `{ "username": "empleado1", "password": "soyempleado" }`
- Mis préstamos: `GET http://localhost:3000/api/prestamos/mis-prestamos` Header `Authorization: Bearer <token_de_prestatario>`
- Préstamos por cédula: `GET http://localhost:3000/api/prestamos/prestatario/1723456789` Header `Authorization: Bearer <token_de_empleado>`
- Pagar cuota: `POST http://localhost:3000/api/cuotas/123/pagar` Body `{ "fecha_pago": "2025-12-01", "monto_pagado": 85000, "metodo": "EFECTIVO" }` Header `Authorization: Bearer <token>`
- Auditoría: `GET http://localhost:3000/api/auditoria/logs?usuario=ana&accion=UPDATE&page=1&pageSize=20` Header `Authorization: Bearer <token_de_empleado>`
 - Crear solicitud: `POST http://localhost:3000/api/solicitudes` Body `{ "monto": 5000000, "nro_cuotas": 12 }` Header `Authorization: Bearer <token_de_prestatario>`
 - Aprobar solicitud: `PUT http://localhost:3000/api/solicitudes/123/aprobar` Header `Authorization: Bearer <token_de_empleado>`
 - Rechazar solicitud: `PUT http://localhost:3000/api/solicitudes/123/rechazar` Body `{ "motivo": "No cumple riesgo" }` Header `Authorization: Bearer <token_de_empleado>`

## Prompt para V0 (frontend Next.js)

Objetivo: Implementar un frontend en Next.js que consuma correctamente todos los endpoints del backend que corre en `http://localhost:3000`. Debe manejar autenticación JWT, roles (EMPLEADO/PRESTATARIO), control de acceso, formularios de creación/actualización, y vistas de consulta y reportes, cubriendo los Casos de Uso Esenciales.

Indicaciones:
- Base URL: `http://localhost:3000`.
- Prefijo: `/api/*`.
- Header común en rutas protegidas: `Authorization: Bearer <token>`.
- Manejar `401` redirigiendo a login; `403` mostrando mensaje de permisos insuficientes.

Vistas mínimas:
- Login: formulario `{ username, password }` → guarda token/JWT payload.
- Dashboard EMPLEADO: accesos a `prestatarios`, `prestamos`, `cuotas`, `reportes`, `notificaciones`, `auditoría`.
- Dashboard PRESTATARIO: botones a “Mis préstamos”, “Mis cuotas”, actualizar datos, subir foto.
- Solicitud de préstamo (cliente): formulario `{ monto, nro_cuotas }` → POST `/api/prestamos`.
- Pago de cuota: tabla de cuotas del préstamo con acción “Pagar” → POST `/api/cuotas/:idCuota/pagar`.
- Extracto mensual: selector de cliente/mes/año → GET `/api/reportes/extracto/:idPrestatario`.
- Carga masiva: uploader de CSV/XLSX → invoca creación de prestatarios en lote (repite `POST /api/prestatarios` o `POST /api/auth/register-prestatario`).
- Refinanciación: formulario `{ nro_cuotas }` → POST `/api/prestamos/:idPrestamo/refinanciaciones`.
- Notificaciones: enviar email → POST `/api/notificaciones/enviar`.
- Auditoría: tabla con filtros → GET `/api/auditoria/logs`.
 - Solicitudes: crear y gestionar → `POST /api/solicitudes`, `GET /api/solicitudes/mis-solicitudes`, `PUT /api/solicitudes/:id/aprobar`, `PUT /api/solicitudes/:id/rechazar`.

API hooks/utilidades:
- `useAuth()`: login/logout, persistencia token, decodificar JWT para `role`, `id_prestatario`.
- `fetcher(url, options)`: añade `Authorization` si hay token, maneja JSON/errores.
- Servicios:
  - `auth.login`, `auth.registerPrestatario`, `auth.registerEmpleado`
  - `prestatarios.list/get/create/update/delete/uploadPhoto`
  - `empleados.list/get/create/update/delete`
  - `prestamos.list`, `prestamos.mis`, `prestamos.byCI`, `prestamos.get`, `prestamos.create`, `prestamos.update`, `prestamos.delete`, `prestamos.refinanciacion`
  - `solicitudes.create`, `solicitudes.mine`, `solicitudes.approve`, `solicitudes.reject`
  - `cuotas.list`, `cuotas.byPrestamo`, `cuotas.get`, `cuotas.pagar`
  - `reportes.prestamos`, `reportes.prestatarios`, `reportes.extracto`
  - `notificaciones.list`, `notificaciones.byPrestatario`, `notificaciones.enviar`
  - `auditoria.logs`

Estados y validaciones:
- Fechas: `YYYY-MM-DD`.
- Cédula: numérica.
- Montos: positivos; validar `nro_cuotas` y sugerir `tipo_interes`.
- Manejar respuestas `{ ok: true, result }` y `{ success: true, data }`.

Pruebas E2E (mínimas):
- Login EMPLEADO y PRESTATARIO.
- Mis préstamos para PRESTATARIO.
- Pago de cuota exitoso y tardío (mostrar estado).
- Generar extracto mensual.
- Cargar 3 prestatarios desde archivo y verificar listado.
- Crear refinanciación.
- Enviar notificación.
- Ver logs de auditoría con filtro por usuario.

Consideraciones de CORS y puerto:
- El backend corre en `http://localhost:3000`. Configura Next.js para consumir ese origen y, si usas fetch desde el navegador, asegúrate de que no haya bloqueo de CORS.

Entrega esperada:
- Páginas Next.js y servicios integrados a estos endpoints, con manejo de JWT, roles y casos de uso, listos para demo local.

## Registro de usuarios (prestatarios y empleados)

Además del login, el backend expone endpoints para realizar un registro completo que crea:

1. El registro de dominio (`PRESTATARIOS` o `EMPLEADOS`).
2. El usuario en la tabla `USUARIOS`, con `username`, `password_hash` (bcrypt), `role` e ID de la entidad asociada.

> Nota: estos endpoints no requieren autenticación en este proyecto académico; el frontend añade una “palabra secreta” y validaciones adicionales en la UI.

### `POST /api/auth/register-prestatario`

- Crea un prestatario en `PRESTATARIOS` y un usuario asociado en `USUARIOS` con rol `PRESTATARIO`.

- Errores típicos:
  - `400 Bad Request` → campos requeridos faltantes.
  - `409 Conflict` → cédula ya registrada o nombre de usuario duplicado.

### `POST /api/auth/register-empleado`

- Crea un empleado en `EMPLEADOS` y un usuario asociado en `USUARIOS` con rol `EMPLEADO`.
- Body esperado (ajusta campos opcionales según tu modelo de empleados):

```json
{
  "username": "empleado_nuevo",
  "password": "1234",
  "empleado": {
    "nombre": "Ana",
    "apellido": "Suarez",
    "cargo": "Contabilidad",
    "salario": null,
    "edad": null
  }
}
```

- Respuesta exitosa (`201 Created`):

```json
{
  "success": true,
  "data": {
    "user": {
      "username": "empleado_nuevo",
      "role": "EMPLEADO",
      "id_empleado": 7
    },
    "empleado": {
      "id_empleado": 7,
      "nombre": "Ana",
      "apellido": "Suarez",
      "cargo": "Contabilidad",
      "salario": null,
      "edad": null
    }
  },
  "message": "Empleado y usuario creados correctamente."
}
```

- Errores típicos:
  - `400 Bad Request` → campos obligatorios de empleado o credenciales incompletos.
  - `409 Conflict` → nombre de usuario duplicado (u otra constraint de duplicidad en empleados).

**Lógica de negocio principal**

- Máximo 2 préstamos activos por prestatario: al crear un préstamo, se valida que el prestatario no tenga más de 2 préstamos en estado `ACTIVO`.
- Cálculo de préstamo: al crear un préstamo se calcula `total` e `interés` según `tipo` (`BAJA`/`MEDIA`/`ALTA`) y se generan las `cuotas` con fecha de vencimiento y monto.
- Pagos de cuota: `POST /api/cuotas/:idCuota/pagar` valida vencimiento/estado y marca la cuota como `PAGADA`, actualizando saldos/estados correspondientes.
- Auditoría automática: la mayoría de los endpoints que hacen `INSERT`/`UPDATE`/`DELETE` registran la operación en la tabla de auditoría mediante el middleware `src/middlewares/auditoria.js`.

**Requisitos en la base de datos (NOTAS importantes para integradores)**

- Tabla `USUARIOS`: el sistema espera una tabla que contenga `username`, `password_hash`, `role`, `id_prestatario` (o `id_empleado` si aplica). El password se guarda usando `bcrypt`.
- Para la entidad `EMPLEADOS`, el INSERT depende de que exista una secuencia/trigger o que el `id_empleado` sea provisto. Si ves `ORA-01400`, crea la secuencia y trigger para `id_empleado` o modifica el INSERT para recibir el id.

Ejemplo SQL (si usas Oracle y necesitas la secuencia/trigger):

```sql
CREATE SEQUENCE seq_empleados START WITH 1 INCREMENT BY 1;
CREATE OR REPLACE TRIGGER trg_empleados_bi
BEFORE INSERT ON empleados
FOR EACH ROW
BEGIN
  IF :NEW.id_empleado IS NULL THEN
	SELECT seq_empleados.NEXTVAL INTO :NEW.id_empleado FROM dual;
  END IF;
END;
/
-- Tabla usuarios ejemplo (simplificada)
CREATE TABLE usuarios (
  id_usuario NUMBER PRIMARY KEY,
  username VARCHAR2(100) UNIQUE,
  password_hash VARCHAR2(255),
  role VARCHAR2(50),
  id_prestatario NUMBER
);
```

Genera las contraseñas con `bcrypt` y actualízalas en la DB; el backend usa `bcrypt.compare` para validar.

**Endpoints más relevantes (resumen para frontend)**

- `POST /api/auth/login` — Login, recibe `{ username, password }` y devuelve `{ token }`.
- `GET /api/prestamos` — Lista todos los préstamos (requiere `EMPLEADO`).
- `GET /api/prestamos/prestatario/:ci` — Lista préstamos de un prestatario por cédula (requiere autenticación; prestatario ve sus propios préstamos).
- `POST /api/prestamos` — Crear préstamo (normalmente lo hace un prestatario solicitando el crédito; la aprobación puede requerir un `EMPLEADO`).
- `PUT /api/prestamos/:idPrestamo` — Actualizar préstamo (e.g., `estado`, `id_empleado`).
- `POST /api/cuotas/:idCuota/pagar` — Registrar pago de cuota (autenticado; prestatario solo puede pagar sus cuotas).

Hay más endpoints (prestatarios, notificaciones, reportes, auditoría). Ver `src/routes/` para la lista completa y contratos.

**Ejemplos de uso (PowerShell)**

1. Login empleado

```powershell
$body = @{ username = 'empleado1'; password = 'soyempleado' } | ConvertTo-Json
$resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/login' -ContentType 'application/json' -Body $body
$token = $resp.data.token
Write-Output $token
```

2. Petición protegida con token (empleado)

```powershell
$headers = @{ Authorization = "Bearer $token" }
$all = Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/prestamos' -Headers $headers
$all | ConvertTo-Json -Depth 6 | Write-Output
```

3. Petición sin token (debe devolver 401)

```powershell
try { Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/prestamos' -ContentType 'application/json' } catch { Write-Output $_.Exception.Message }
```

4. Pago de cuota (cliente)

```powershell
$cliPayload = @{ fecha_pago = (Get-Date).ToString('yyyy-MM-dd'); monto_pagado = 85000; metodo = 'EFECTIVO' } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri "http://localhost:3000/api/cuotas/123/pagar" -Headers @{ Authorization = "Bearer $clienteToken" } -ContentType 'application/json' -Body $cliPayload
```

**Protecciones implementadas y comportamiento probado**

- Rutas protegidas: middleware verifica `Authorization` header con `Bearer <token>`.
- Rol/propiedad:
  - Sin token → `401 Unauthorized`.
  - Token válido pero sin rol/permisos → `403 Forbidden`.
  - `EMPLEADO` puede listar y ver todos los préstamos: `GET /api/prestamos` → `200 OK` (probado).
  - `PRESTATARIO` (cliente) obtiene `403` al intentar listar todos los préstamos (probado).

**Pruebas ejecutadas (resumen reproducible)**

- El servidor estaba corriendo en `localhost:3000` durante las pruebas.
- Test 1 — GET `/api/prestamos` sin token → `401 Unauthorized` (correcto).
- Test 2 — POST `/api/auth/login` con `empleado1` / `soyempleado` → devuelve token JWT (correcto).
- Test 3 — POST `/api/auth/login` con `cliente1` / `soyprestatario` → devuelve token JWT (correcto).
- Test 4 — GET `/api/prestamos` con token de `EMPLEADO` → `200 OK` + lista de préstamos (correcto).
- Test 5 — GET `/api/prestamos` con token de `PRESTATARIO` → `403 Forbidden` (correcto — el sistema impide listar globalmente a prestatarios).

Si quieres, puedo añadir ejemplos concretos de payloads para ganar-estado (aprobar/rechazar préstamos), o un pequeño script de test e2e para PowerShell/Postman.

