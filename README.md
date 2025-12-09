# Banco-backend

Backend REST para gestión de clientes, préstamos, cuotas, auditoría, reportes y notificaciones.

Este README amplía la documentación existente con detalles útiles para el equipo de frontend: cómo autenticarse, comportamiento de autorización, contratos de las rutas más importantes, ejemplos (PowerShell), variables de entorno necesarias, la lógica de negocio implementada y las pruebas que se han ejecutado.

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

Coloca estas variables en un `.env` en la raíz o en tu entorno de ejecución.

**Autenticación y autorización**

- Login: `POST /api/auth/login` con body `{ "username": "...", "password": "..." }`.
  - Respuesta exitosa: `{ success: true, data: { token: "<JWT>" }, message: "Autenticado" }`.
  - El token es un JWT con payload: `{ id, username, role, id_prestatario?, id_empleado?, iat, exp }`.
- Roles soportados en el backend (mayores relevantes):

  - `EMPLEADO`: puede listar y operar sobre solicitudes y préstamos de forma global (acciones administrativas).
  - `PRESTATARIO`: usuario cliente. Debe poder crear solicitudes de préstamo, ver y pagar sus propias cuotas y ver sus préstamos.

- Uso del token: enviar header `Authorization: Bearer <token>` en todas las peticiones a rutas protegidas.

## Registro de usuarios (prestatarios y empleados)

Además del login, el backend expone endpoints para realizar un registro completo que crea:

1. El registro de dominio (`PRESTATARIOS` o `EMPLEADOS`).
2. El usuario en la tabla `USUARIOS`, con `username`, `password_hash` (bcrypt), `role` e ID de la entidad asociada.

> Nota: estos endpoints no requieren autenticación en este proyecto académico; el frontend añade una “palabra secreta” y validaciones adicionales en la UI.

### `POST /api/auth/register-prestatario`

- Crea un prestatario en `PRESTATARIOS` y un usuario asociado en `USUARIOS` con rol `PRESTATARIO`.
- Body esperado (ejemplo):

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

- Respuesta exitosa (`201 Created`):

```json
{
  "success": true,
  "data": {
    "user": {
      "username": "cliente_nuevo",
      "role": "PRESTATARIO",
      "id_prestatario": 42
    },
    "prestatario": {
      "id_prestatario": 42,
      "ci": 1002635472,
      "nombre": "Isabella",
      "apellido": "Suarez",
      "direccion": "Cra 3C #32A 12",
      "email": "suarezisa34@gmail.com",
      "telefono": "3001234567",
      "fecha_nacimiento": "2000-01-01",
      "estado_cliente": "ACTIVO",
      "fecha_registro": "2024-01-01 10:00:00",
      "usuario_registro": "frontend"
    }
  },
  "message": "Prestatario y usuario creados correctamente."
}
```

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

**Consejos para el frontend**

- Guardar token en memoria (o `localStorage`/secure cookie según política) y enviarlo en `Authorization` header.
- Gestionar `401` redirigiendo a login; gestionar `403` mostrando mensaje de permisos insuficientes.
- Validar datos antes de enviarlos: cédula numérica, fechas en `YYYY-MM-DD`, montos positivos.
- Mostrar resultados de auditoría/errores devueltos por la API al usuario en los flujos administrativos.

**Colección de pruebas (Postman)**

- Archivo: `docs/api.postman_collection.json` (usar variable `baseUrl: http://localhost:3000`).

---

Si quieres que genere además:

- Un archivo `docs/e2e-tests.ps1` con los pasos que ejecuté (login empleado/cliente, listar, crear préstamo, pagar cuota), lo genero y pruebo automáticamente en tu entorno.
- Un ejemplo de componente React para login + uso de token.

Dime cuál de estas opciones prefieres y lo agrego.
