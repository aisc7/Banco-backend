# Banco-backend — README 2.0 (API Contract y Guía de Implementación)

Este documento es la referencia completa y actualizada del backend: contratos de API por endpoint, requisitos de seguridad, validaciones, códigos de error, ejemplos de consumo (PowerShell) y la cobertura frente a los requerimientos 4.2 y Casos de Uso. Está pensado para que el equipo de frontend implemente todas las vistas con confianza.

Base URL: `http://<host>:<port>` (por defecto `http://localhost:3000`)
Prefijo API: todas las rutas bajo `/api/*`
Salud: `GET /health` → `{ "status": "ok" }`

Variables de entorno mínimas
- `DB_USER`, `DB_PASS`, `DB_HOST`, `DB_PORT`, `DB_SERVICE` — Oracle.
- `PORT` — por defecto `3000`.
- `JWT_SECRET` — firma JWT.
- `JWT_EXPIRY` — ej. `1h`.
- `BCRYPT_SALT_ROUNDS` — ej. `10`.
- `SOLICITUDES_SEQ_NAME` — secuencia opcional para `SOLICITUDES_PRESTAMOS`.
- `CUOTAS_SEQ_NAME` — secuencia opcional para `CUOTAS`.
- `NODE_ENV` — `development`/`production` (en dev, las cuotas se pueden generar con vencimientos por minutos).
- `CUOTAS_MINUTES_BASE` — en dev, minutos base para simular vencimiento (por defecto `3`).

Convenciones
- Fechas: `YYYY-MM-DD` (salvo que el paquete PL/SQL reciba/retorne `DATE`).
- Cédula (`ci`): numérica.
- Content-Type: `application/json` salvo `multipart/form-data` donde se indique.
- Respuestas: este backend usa 2 formatos:
  - `{ ok: true|false, result?: any, error?: string }`
  - `{ success: true|false, data?: any, message?: string }`

Autenticación y Autorización
- Login: `POST /api/auth/login` con `{ username, password }` → JWT.
- Header en rutas protegidas: `Authorization: Bearer <token>`.
- Roles: `EMPLEADO`, `PRESTATARIO` (y `ADMIN` para ciertas rutas administrativas).
- Middlewares:
  - `auth` valida JWT.
  - `requireRole('ROL')` restringe por rol.
  - `allowEmployeeOrOwner(fn)` permite EMPLEADO o dueño (el callback `fn(req)` debe resolver `id_prestatario` dueño).
  - `auditoria('TABLA','OPERACION')` adjunta contexto para auditoría.

Notas de seguridad importantes (revisión actual del código)
- Varios endpoints no están protegidos por `auth`/`requireRole` en las rutas. Ver cada sección “Seguridad” y “Gaps detectados” para las recomendaciones de cierre.
- Si integras frontend, asume que debes enviar JWT en todo endpoint que dice “Requiere auth”, incluso si el código actual omite el middleware (se corregirá en la API).


## 1) Auth

POST /api/auth/login
- Seguridad: pública.
- Body: `{ "username": string, "password": string }`.
- 200: `{ success: true, data: { token: string }, message: "Autenticado" }`.
- 400: campos faltantes.
- 401: credenciales inválidas.

POST /api/auth/register-prestatario
- Seguridad: pública (en proyecto académico). Frontend debe validar palabra secreta.
- Body ejemplo (obligatorios dentro de `prestatario`):
```json
{
  "username": "cliente_nuevo",
  "password": "1234",
  "prestatario": {
    "ci": 1002635472,
    "nombre": "Isabella",
    "apellido": "Suarez",
    "direccion": "Cra 3C #32A 12",
    "email": "suarezisa34@gmail.com",
    "telefono": "3001234567",
    "fecha_nacimiento": "2000-01-01",
    "estado_cliente": "ACTIVO",
    "usuario_registro": "frontend"
  }
}
```
- 201: `{ success: true, data: { user, prestatario }, message }`.
- 400: validación de payload.
- 409: cédula o username duplicado.

POST /api/auth/register-empleado
- Seguridad: pública (académico). Frontend debe validar palabra secreta.
- Body ejemplo:
```json
{ "username": "empleado_nuevo", "password": "1234", "empleado": { "nombre": "Ana", "apellido": "Suarez", "cargo": "Contabilidad", "salario": null, "edad": null } }
```
- 201: `{ success: true, data: { user, empleado }, message }`.
- 400 | 409 según validación/duplicidad.

POST /api/auth/users
- Seguridad: requiere `auth` + `requireRole('ADMIN')`.
- Body: `{ username, password, role? }`.
- 201: `{ success: true, data, message }`.


## 2) Prestatarios

POST /api/prestatarios
- Seguridad: pública.
- Body obligatorio: `{ ci, nombre, apellido, direccion, email, telefono, fecha_nacimiento, estado_cliente, usuario_registro }`.
- 201: `{ ok: true, result: { inserted: true } }`.
- 400: validación.
- 409: cédula duplicada (constraint Oracle).

PUT /api/prestatarios/:ci
- Seguridad: `auth` + `allowEmployeeOrOwner`.
- Body: cualquiera de `nombre, apellido, direccion, email, telefono, fecha_nacimiento, estado_cliente`.
- 200: `{ ok: true, result: { updated: true } }`.
- 400: sin campos / cédula inexistente.

DELETE /api/prestatarios/:ci
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- 200: `{ ok: true, result: { deleted: true } }`.

POST /api/prestatarios/:ci/foto
- Seguridad: `auth` + `allowEmployeeOrOwner`.
- Subida:
  - `multipart/form-data` con campo `foto` (archivo) o
  - `application/json` con `{ "foto_base64": "data:image/jpeg;base64,..." }` o sin prefijo `data:`.
- 200: `{ ok: true, result: { updated: true } }`.

GET /api/prestatarios/validar/:ci
- Seguridad: pública.
- 200: `{ duplicada: boolean }`.

GET /api/prestatarios/:ci
- Seguridad: `auth` + `allowEmployeeOrOwner`.
- 200: `{ ok: true, result: { id_prestatario, ci, ... } }`.
- 404: no encontrado.

GET /api/prestatarios
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- 200: `{ ok: true, result: [...] }`.

GET /api/prestatarios/morosos
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- 200: `{ ok: true, result: [{ id_prestatario, ci, nombre, cuotas_vencidas, ... }] }`.

POST /api/prestatarios/carga | /carga-masiva | /upload-masivo
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- Envío:
  - JSON: `{ content: "csv_o_txt", usuario?: string, nombre_archivo?: string }`.
  - o `multipart/form-data` con `archivo`.
- 202: `{ ok: true, result: { total, aceptados, rechazados, detalles, id_log_pk } }`.
- Formato CSV esperado (9 columnas): `ci,nombre,apellido,direccion,email,telefono,fecha_nacimiento,estado_cliente,usuario_registro`.

GET /api/prestatarios/obtener-logs-carga (alias: /cargas/logs)
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- 200: `{ ok: true, result: [{ id_log_pk, nombre_archivo, fecha_carga, usuario, registros_validos, registros_rechazados, detalles: [...] }] }`.

Gaps detectados (Prestatarios)
- Falta endpoint para “visualizar foto” (GET foto por `ci` o `id_prestatario`).
- Los endpoints de alta/baja/modificación ya registran auditoría via middleware, pero la persistencia automática del log (ver Auditoría) está pendiente.


## 3) Empleados

IMPORTANTE: actualmente estas rutas no tienen `auth/requireRole` en el router; deben protegerse para uso administrativo.

POST /api/empleados
- Seguridad deseada: `auth` + `requireRole('EMPLEADO')`.
- 201: crea empleado. Body flexible: `{ nombre, apellido, cargo?, salario?, edad? }`.

GET /api/empleados
- Seguridad deseada: `auth` + `requireRole('EMPLEADO')`.

GET /api/empleados/:id
- Seguridad deseada: `auth` + `requireRole('EMPLEADO')`.

PUT /api/empleados/:id
- Seguridad deseada: `auth` + `requireRole('EMPLEADO')`.

DELETE /api/empleados/:id
- Seguridad deseada: `auth` + `requireRole('EMPLEADO')`.


## 4) Préstamos

POST /api/prestamos
- Seguridad: `auth`.
- Rol PRESTATARIO: el servidor fuerza `id_prestatario` del token e infiere `tipo_interes` por `nro_cuotas` (`<=12:BAJA`, `<=24:MEDIA`, `>24:ALTA`).
- Rol EMPLEADO: puede crear para cualquier `id_prestatario` enviado; debe indicar `tipo_interes` si quiere sobreescribir.
- Body mínimo: `{ id_prestatario?, monto, nro_cuotas, tipo_interes? }`.
- 201: `{ ok: true, result: { id_prestamo } }` (creado vía `PAK_PRESTAMOS.PRO_CREAR_PRESTAMO`).
- 400: validación / error del paquete (incluye regla “máximo 2 ACTIVO” si el paquete la aplica).

POST /api/prestamos/:idPrestamo/refinanciaciones
- Seguridad: debería requerir `auth` (actualmente no está protegido en router).
- Body: `{ nro_cuotas }`.
- 201: `{ ok: true, result: { id_solicitud_refinanciacion } }` (PL/SQL `PRO_REGISTRAR_REFINANCIACION`).

GET /api/prestamos/prestatario/:ci
- Seguridad: `auth` + `allowEmployeeOrOwner`.
- 200: `{ ok: true, result: { prestatario: { id_prestatario, ci }, prestamos: [...], cuotas: [...] } }`.

GET /api/prestamos
- Seguridad: `auth` + `requireRole('EMPLEADO')`.

GET /api/prestamos/mis-prestamos
- Seguridad: `auth` + `requireRole('PRESTATARIO')`.

GET /api/prestamos/:idPrestamo
- Seguridad: `auth` + `allowEmployeeOrOwner`.

PUT /api/prestamos/:idPrestamo
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- Body soportado: `{ estado }`.

DELETE /api/prestamos/:idPrestamo
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- Efecto: marca `ESTADO='CANCELADO'`.


## 5) Cuotas

POST /api/cuotas/:idCuota/pagar
- Seguridad: `auth` + `allowEmployeeOrOwner`.
- Body usado por el backend: `{ fecha_pago?: 'YYYY-MM-DD' }`.
  - Nota: campos como `monto_pagado`/`metodo` no se usan en el código actual; el PL/SQL puede calcular/validar internamente.
- 201: `{ ok: true, result: { cuota, prestamo } }`.
- 400: regla/trigger (p.ej. “no permitir pago tardío”).

GET /api/cuotas/prestatarios/:id/morosidad
- Seguridad: debería requerir `auth` (actualmente pública en router).
- 200: `{ ok: true, result: { id_prestatario, total_morosidad } }` (`FUN_CALC_MOROSIDAD`).

POST /api/cuotas/prestatarios/:id/aplicar-penalizacion
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- 201: `{ ok: true, result: { id_prestatario, aplicado: true } }`.

GET /api/cuotas/prestatarios/:id/resumen-cuotas
- Seguridad: `auth` + `allowEmployeeOrOwner`.
- 200: `{ ok: true, result: { id_prestatario, resumen: [...] } }` (OUT cursor PL/SQL).

GET /api/cuotas/pendientes | /morosas
- Seguridad: `auth` + `requireRole('EMPLEADO')`.

GET /api/cuotas/prestamo/:idPrestamo
- Seguridad: `auth` + `allowEmployeeOrOwner`.

GET /api/cuotas
- Seguridad: `auth` + `requireRole('EMPLEADO')`.

POST /api/cuotas/dev/marcar-vencidas
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- Solo dev: marca vencidas por fecha.

GET /api/cuotas/prestatarios/:id/estado-moroso
- Seguridad: `auth` + `allowEmployeeOrOwner`.
- 200: `{ ok: true, result: { id_prestatario, vencidasImpagas, estado: 'MOROSO'|'ACTIVO' } }` (derivado UI: `>=2` vencidas impagas → `MOROSO`).


## 6) Reportes

IMPORTANTE: actualmente las rutas no están protegidas; deberían requerir `EMPLEADO`.

GET /api/reportes/prestamos
- Seguridad deseada: `auth` + `requireRole('EMPLEADO')`.
- 200: `{ ok: true, result: [...] }` (TABLE function `PAK_REPORTES.FUN_RESUMEN_PRESTAMOS`).

GET /api/reportes/morosos
- Seguridad deseada: `auth` + `requireRole('EMPLEADO')`.

GET /api/reportes/refinanciaciones
- Seguridad deseada: `auth` + `requireRole('EMPLEADO')`.

Faltantes (para 4.2 y Casos de Uso):
- `GET /api/reportes/extracto/:idPrestatario` — extracto mensual (no implementado aún).
- `GET /api/reportes/datacredito` — simulado (existe en modelo/servicio, falta exponer ruta).


## 7) Notificaciones

IMPORTANTE: las rutas actuales están públicas; deberían requerir `EMPLEADO`.

GET /api/notificaciones/pendientes
- 200: `{ ok: true, result: [{ id_notificacion, id_prestatario, id_cuota, tipo, mensaje }] }`.

POST /api/notificaciones/enviar
- Body: `{ "tipo": "PAGO"|"MORA"|"CANCELACION" }`.
- 202: `{ ok: true, result: { tipo, enviado: true } }` (marca como enviadas vía `PAK_NOTIFICACIONES.PRO_ENVIAR_NOTIFICACIONES_MASIVAS`).

POST /api/notificaciones/recordatorios-pago | /notificar-mora | /notificar-cancelacion
- 202: `{ ok: true }` (simulación de jobs).

GET /api/notificaciones
- 200: histórico completo.

Faltantes:
- Endpoint para enviar notificación ad-hoc a un cliente con `{ id_prestatario, asunto, cuerpo }` (lo que sugiere el README original). Hoy solo hay envío masivo por tipo.


## 8) Auditoría

IMPORTANTE: middleware `auditoria()` adjunta contexto, pero la persistencia automática está en “placeholder”. Existen endpoints para registrar/finalizar auditoría con `PAK_AUDITORIA`.

POST /api/auditoria/registrar
- Body: `{ usuario, ip, dominio, tabla, operacion, descripcion? }`.
- 201: `{ ok: true, id_audit }`.

POST /api/auditoria/finalizar
- Body: `{ id_audit }`.
- 200: `{ ok: true, id_audit }` (marca `FECHA_SALIDA` y permite `DURACION_SESION`).

GET /api/auditoria/logs?usuario=&operacion=&tabla=&limit=&offset=
- 200: `{ ok: true, result: [{ ID_AUDIT_PK, USUARIO, IP, DOMINIO, FECHA_ENTRADA, FECHA_SALIDA, TABLA_AFECTADA, OPERACION, DURACION_SESION, DESCRIPCION }] }`.

Recomendaciones:
- Proteger `/api/auditoria/*` con `auth` + `requireRole('EMPLEADO')`.
- Integrar la persistencia automática en el middleware (registrar ENTRADA/SALIDA por request y calcular duración).


## 9) Solicitudes de Préstamo

POST /api/solicitudes
- Seguridad: `auth`.
- Rol PRESTATARIO: usa `id_prestatario` del token.
- Rol EMPLEADO: debe enviar `id_prestatario`.
- Body: `{ monto, nro_cuotas, id_empleado? }`.
- Validaciones: monto > 0; nro_cuotas entero > 0.
- 201: `{ ok: true, result: { id_solicitud_prestamo, estado: 'PENDIENTE' } }`.

GET /api/solicitudes/mis-solicitudes
- Seguridad: `auth` + `requireRole('PRESTATARIO')`.

GET /api/solicitudes?estado=&id_prestatario=
- Seguridad: `auth` + `requireRole('EMPLEADO')`.

PUT /api/solicitudes/:id/aprobar
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- Efecto: valida máximo 2 préstamos ACTIVO → marca solicitud `ACEPTADA` → crea préstamo y sus cuotas en una única transacción.
- 200: `{ ok: true, result: { solicitud: { id_solicitud, estado }, prestamo: { id_prestamo } } }`.

PUT /api/solicitudes/:id/rechazar
- Seguridad: `auth` + `requireRole('EMPLEADO')`.
- Body: `{ motivo? }`.
- 200: `{ ok: true, result: { solicitud: { id_solicitud, estado: 'RECHAZADA', motivo? } } }`.


## 10) Ejemplos PowerShell

Login y llamada protegida
```powershell
$body = @{ username = 'empleado1'; password = 'soyempleado' } | ConvertTo-Json
$resp = Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/auth/login' -ContentType 'application/json' -Body $body
$token = $resp.data.token
$headers = @{ Authorization = "Bearer $token" }
$prestamos = Invoke-RestMethod -Method Get -Uri 'http://localhost:3000/api/prestamos' -Headers $headers
$prestamos | ConvertTo-Json -Depth 6 | Write-Output
```

Crear solicitud (cliente)
```powershell
$cliBody = @{ monto = 5000000; nro_cuotas = 12 } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/solicitudes' -Headers @{ Authorization = "Bearer $clienteToken" } -ContentType 'application/json' -Body $cliBody
```

Pagar cuota
```powershell
$pay = @{ fecha_pago = (Get-Date).ToString('yyyy-MM-dd') } | ConvertTo-Json
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/cuotas/123/pagar' -Headers @{ Authorization = "Bearer $token" } -ContentType 'application/json' -Body $pay
```

Carga masiva (multipart)
```powershell
$Form = @{ archivo = Get-Item '.\\prestatarios.csv' }
Invoke-RestMethod -Method Post -Uri 'http://localhost:3000/api/prestatarios/carga-masiva' -Headers @{ Authorization = "Bearer $token" } -Form $Form
```


## 11) Cobertura de Requerimientos (4.2)

Módulo 1: Gestión de Clientes (Prestatarios)
- Registro/modificación/eliminación: OK (con auditoría middleware; ver nota Auditoría).
- Subida y visualización de foto: subida OK (BLOB/base64). FALTA endpoint de visualización.
- Control de duplicidad CI: OK (`/validar/:ci` + constraint Oracle).
- Carga masiva (TXT/CSV): OK vía API (`/carga-*`), valida estructura y registra logs (`LOG_CARGA_CLIENTES`, `CARGA_CLIENTES_DETALLE`). Opción SQLLoader: NO implementada explícitamente (opcional para demo).

Módulo 2: Gestión de Préstamos
- Número de préstamo automático: OK (RETURNING/paquete PL/SQL).
- Tasa de interés: OK (inferida para PRESTATARIO; para EMPLEADO debe indicarse si se desea sobreescribir).
- Cálculo total y cuotas: OK (manual en aprobación de solicitudes o por paquete PL/SQL).
- Máximo 2 activos: OK en flujo de aprobación; para `POST /api/prestamos` depende del paquete (recomendado validar y mapear mensaje).
- Refinanciaciones: OK (endpoint existente; falta proteger con `auth`).

Módulo 3: Gestión de Cuotas
- Cálculo fechas/montos: OK (generación transaccional; en dev por minutos).
- Trigger validación pago oportuno: OK (regla en DB; backend propaga error 400).
- Actualización de saldo/cuotas pendientes: OK (paquetes en DB).
- Morosidad y penalizaciones: OK (endpoints `morosidad`, `aplicar-penalizacion`, vistas `pendientes/morosas`).

Módulo 4: Auditoría y Seguridad
- LOG_AUDITORIA (usuario, IP, dominio, entrada/salida, tabla, operación, duración):
  - Paquete y endpoints: OK.
  - Persistencia automática por middleware para cada request: PENDIENTE (placeholder en modelo).
- Seguridad (JWT/roles): OK en general; hay rutas sin middleware que deben protegerse (ver “Seguridad por ruta”).

Módulo 5: Informes y Reportes
- Vista consolidada: OK (`/api/reportes/prestamos`).
- Reporte de morosos: OK (`/api/reportes/morosos`).
- Reporte de refinanciaciones activas: OK (`/api/reportes/refinanciaciones`).
- Extracto mensual: PENDIENTE (agregar endpoint y lógica).
- DataCrédito (simulado): MODELO/SERVICIO OK; falta exponer ruta.

Módulo 6: Notificaciones y Comunicación
- Envío masivo (simulado): OK por tipo (`/enviar`, `recordatorios-pago`, `notificar-*`).
- Recordatorios y mora: OK.
- Extractos por correo: PENDIENTE (no hay endpoint específico).


## 12) Casos de Uso Esenciales (estado)

1. Solicitud de préstamo por cliente: OK (`POST /api/solicitudes`).
2. Pago oportuno/tardío: OK (`POST /api/cuotas/:idCuota/pagar`; tardío bloqueado por trigger con 400).
3. Clasificación de cliente moroso: OK (endpoint derivado `/prestatarios/:id/estado-moroso` y vistas morosas; badge UI cuando `>=2`).
4. Extracto financiero mensual: PENDIENTE (endpoint de extracto y/o query por periodo).
5. Carga masiva de nuevos clientes: OK (`/api/prestatarios/carga-*` + logs).
6. Registro de refinanciación: OK (`POST /api/prestamos/:id/refinanciaciones`, proteger con `auth`).
7. Envío de recordatorio por correo: OK (jobs simulados / `enviar` por tipo). Envío ad-hoc: PENDIENTE.
8. Auditoría de usuarios/operaciones: OK por endpoints; PENDIENTE auto-logs por middleware.


## 13) Vistas necesarias (Frontend)

Autenticación
- Login: `{ username, password }` → guarda token, decodifica payload (role, `id_prestatario`). Maneja 401/403.

Dashboard EMPLEADO
- Prestatarios: listado, detalle por CI, crear/editar/eliminar, carga masiva, validar duplicidad, ver morosos, subir foto.
- Préstamos: listado global, detalle, actualizar estado, cancelar.
- Solicitudes: listado con filtros, aprobar/rechazar (crea préstamo + cuotas).
- Cuotas: vistas `pendientes`, `morosas`, por préstamo; marcar vencidas (dev).
- Reportes: consolidado, morosos, refinanciaciones, DataCrédito (cuando se exponga ruta), extracto (cuando se implemente).
- Notificaciones: pendientes, enviar masivas por tipo, histórico.
- Auditoría: tabla de logs con filtros.

Dashboard PRESTATARIO
- Mis datos: ver/editar datos, subir foto.
- Mis préstamos: listado propio (`/mis-prestamos`), detalle con cuotas.
- Pago de cuota: acción “Pagar” (seleccionando fecha), manejar error 400 en tardío.
- Mis solicitudes: crear (monto/nro_cuotas), ver estado.
- Estado moroso: mostrar badge derivado (>=2 vencidas impagas).

Utilidades / Hooks en frontend
- `useAuth()` — login/logout y persistencia de token.
- `fetcher(url, options)` — añade `Authorization` y parsea respuestas `{ ok }`/`{ success }`.
- Servicios por dominio (auth, prestatarios, empleados, prestamos, cuotas, solicitudes, reportes, notificaciones, auditoria).


## 14) Seguridad por ruta (Checklist para refactor rápido)

Agregar `auth` + `requireRole('EMPLEADO')` en:
- `src/routes/empleados.routes.js` (todas).
- `src/routes/reportes.routes.js` (todas).
- `src/routes/notificaciones.routes.js` (todas).
- `src/routes/auditoria.routes.js` (todas) — al menos para listar.
- `src/routes/prestamos.routes.js` → `POST /:id/refinanciaciones`.
- `src/routes/cuotas.routes.js` → `GET /prestatarios/:id/morosidad`.


## 15) Extensiones sugeridas (para completar requerimientos)

- Reportes
  - `GET /api/reportes/extracto/:idPrestatario?desde=YYYY-MM-DD&hasta=YYYY-MM-DD`.
  - `GET /api/reportes/datacredito` (exponer lo ya implementado en modelo/servicio).
- Notificaciones
  - `POST /api/notificaciones/enviar-unica` con `{ id_prestatario, asunto, cuerpo }` (simulación vía tabla NOTIFICACIONES).
- Prestatarios
  - `GET /api/prestatarios/:ci/foto` (devolver `image/*` o `application/octet-stream`; alternativa: base64 json `{ data }`).
- Auditoría
  - Persistir automáticamente ENTRADA/SALIDA en middleware y calcular duración por request; o envolver handlers para registrar `PAK_AUDITORIA`.


## 16) Contratos resumidos (Frontend)

- Errores
  - 400: validación/reglas de negocio (usar `error`/`message`).
  - 401: sin token o token inválido → redirigir a login.
  - 403: sin rol/permisos → mensaje de permisos.
  - 404: recurso no encontrado.
  - 409: duplicidad (CI/username).
- Respuestas
  - Preferir `ok/success` para verificar rápidamente y luego acceder a `result/data`.
- Fechas/montos
  - Fechas `YYYY-MM-DD`. Montos positivos; `nro_cuotas` entero positivo.
- Interés sugerido
  - `<=12:BAJA`, `<=24:MEDIA`, `>24:ALTA` (aplica por defecto a PRESTATARIO).


## 17) Simulación rápida de vencimientos (dev)

- Crear un préstamo y esperar minutos base (`CUOTAS_MINUTES_BASE=3`) para ver cuotas `VENCIDA`.
- Alternativa SQL manual (Oracle) para adelantar vencimientos (ver README principal).
- `POST /api/cuotas/dev/marcar-vencidas` para marcar vencidas inmediatamente en dev.
