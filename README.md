# Banco-backend

Backend REST para gestión de clientes, préstamos, cuotas, auditoría, reportes y notificaciones. Este documento describe TODOS los endpoints disponibles, casos de uso esenciales, contratos de entrada/salida, códigos de estado y recomendaciones de vistas para el frontend.

**Base URL**
- `http://<host>:<port>`
- Salud del servicio: `GET /health` → `{ "status": "ok" }`

**Prefijo API**
- Todos los endpoints están bajo `/api/*`.

**Errores y formato de respuesta**
- Respuestas exitosas: `{ ok: true, result: <datos> }` o campos específicos.
- Errores de validación/reglas: `400 Bad Request` con `{ ok: false, error: <mensaje> }`.
- Recurso no encontrado: `404 Not Found`.
- Conflicto de duplicidad (cédula): `409 Conflict`.
- Errores de servidor en notificaciones: `500 Internal Server Error`.

**Convenciones de datos**
- Fechas: `YYYY-MM-DD`.
- Cédula (`ci`): Numérica.
- Tipos de tasa/interés: `BAJA`, `MEDIA`, `ALTA`.
- Content-Type: `application/json` salvo donde se indique `multipart/form-data`.

**Auditoría automática**
- Muchas rutas aplican middleware de auditoría (`middlewares/auditoria.js`) que registra tabla y operación (`INSERT`/`UPDATE`/`DELETE`). No requiere acción del cliente.

**Módulos**
- Prestatarios: `/api/prestatarios`
- Préstamos: `/api/prestamos`
- Cuotas: `/api/cuotas`
- Reportes: `/api/reportes`
- Notificaciones: `/api/notificaciones`
- Auditoría: `/api/auditoria`

---

**Prestatarios**
- `POST /api/prestatarios`
	- Registrar cliente. Valida duplicidad de cédula.
	- Body JSON ejemplo:
		`{ "ci": 1234567890, "nombres": "Juan", "apellidos": "Pérez", "email": "juan@correo.com", "telefono": "3001234567", "direccion": "Calle 1" }`
	- Respuestas: `201 Created` `{ ok: true, result }`; `409` si cédula duplicada.
	- Posibles errores: `400` por datos inválidos.
- `PUT /api/prestatarios/:ci`
	- Modificar datos del cliente por cédula.
	- Body: campos a actualizar.
	- Respuestas: `200 OK` `{ ok: true, result }` o `400` por validación.
- `DELETE /api/prestatarios/:ci`
	- Eliminar cliente por cédula.
	- Respuestas: `200 OK` `{ ok: true }` o `400` por errores.
- `POST /api/prestatarios/:ci/foto`
	- Subir fotografía del cliente.
	- Soporta `multipart/form-data` con campo `foto` (archivo) o JSON con `foto_base64`.
	- Respuestas: `200 OK` `{ ok: true, result }`; `400` si base64 inválido.
- `GET /api/prestatarios/validar/:ci`
	- Verifica si la cédula está duplicada.
	- Respuesta: `{ duplicada: true|false }`.
- `GET /api/prestatarios/:ci`
	- Obtener datos de un cliente por cédula.
	- Respuestas: `200 OK` `{ ok: true, result }` o `404` si no existe.
- `GET /api/prestatarios`
	- Listar todos los clientes.
- `POST /api/prestatarios/carga`
	- Carga masiva desde contenido CSV/TXT en JSON.
	- Body JSON: `{ "content": "ci,nombres,apellidos,...\n...", "nombre_archivo": "carga.csv" }`.
	- Respuesta: `202 Accepted` `{ ok: true, result }` (incluye resumen de carga/logs).
- `POST /api/prestatarios/carga-masiva`
	- Carga masiva vía `multipart/form-data` con campo `archivo` (CSV/TXT). Alias del anterior.
- `GET /api/prestatarios/obtener-logs-carga`
	- Obtener logs de cargas masivas.
- `GET /api/prestatarios/cargas/logs`
	- Alias para obtener logs de cargas.

**Préstamos**
- `POST /api/prestamos`
	- Crear préstamo. Genera número automático, asigna tasa por tipo y calcula cuotas/total. Controla máximo 2 préstamos activos por prestatario.
	- Body JSON ejemplo:
		`{ "ci": 1234567890, "monto": 1000000, "tipo": "MEDIA", "plazo_meses": 12 }`
	- Respuestas: `201 Created` `{ ok: true, result }`; `400` por validación (p.ej., más de 2 activos).
- `POST /api/prestamos/:idPrestamo/refinanciaciones`
	- Registrar refinanciación de un préstamo.
	- Body: datos de nueva condición (ej. nuevo plazo, tasa, etc.).
	- Respuestas: `201 Created` `{ ok: true, result }` o `400` por reglas.
- `GET /api/prestamos/prestatario/:ci`
	- Listar préstamos de un prestatario por cédula.
- `GET /api/prestamos`
	- Listar todos los préstamos.
- `GET /api/prestamos/:idPrestamo`
	- Obtener préstamo por ID.
	- Respuestas: `200 OK` `{ ok: true, result }` o `404` si no existe.
- `PUT /api/prestamos/:idPrestamo`
	- Actualizar campos permitidos (por ejemplo `estado`, `id_empleado`).
	- Respuestas: `200 OK` `{ ok: true, result }` o `400` por validación.
- `DELETE /api/prestamos/:idPrestamo`
	- Cancelar/eliminar préstamo (marca estado `CANCELADO`).
	- Respuestas: `200 OK` `{ ok: true, result }` o `400` por errores.

**Cuotas**
- `POST /api/cuotas/:idCuota/pagar`
	- Registrar pago de una cuota (valida vencimiento y actualiza saldo/pendientes).
	- Body JSON ejemplo: `{ "fecha_pago": "2025-12-01", "monto_pagado": 85000, "metodo": "EFECTIVO" }`.
	- Respuestas: `201 Created` `{ ok: true, result }` o `400` por reglas de pago.
- `GET /api/cuotas/prestatarios/:id/morosidad`
	- Obtener indicadores de morosidad para un prestatario.
- `POST /api/cuotas/prestatarios/:id/aplicar-penalizacion`
	- Aplicar penalización por morosidad (opcional).
	- Respuestas: `201 Created` `{ ok: true, result }` o `400` si no procede.
- `GET /api/cuotas/prestatarios/:id/resumen-cuotas`
	- Resumen de cuotas (pagadas/pendientes, valores, fechas) por prestatario.
- `GET /api/cuotas/pendientes`
	- Listar cuotas pendientes.
- `GET /api/cuotas/morosas`
	- Listar cuotas morosas.

**Reportes**
- `GET /api/reportes/prestamos`
	- Vista consolidada de préstamos: número, prestatario, total, cuotas, pagadas/pendientes, valores y fechas.
- `GET /api/reportes/morosos`
	- Reporte de morosos y DataCrédito (simulado).
- `GET /api/reportes/refinanciaciones`
	- Reporte de refinanciaciones activas.

**Notificaciones**
- `GET /api/notificaciones/pendientes`
	- Listar notificaciones pendientes de envío.
- `POST /api/notificaciones/enviar`
	- Marcar envío masivo por tipo.
	- Body JSON: `{ "tipo": "PAGO" | "MORA" | "CANCELACION" }`.
	- Respuestas: `202 Accepted` `{ ok: true, result }` o `500` si falla proceso.
- `POST /api/notificaciones/recordatorios-pago`
	- Ejecutar procedimiento de recordatorios de pago.
	- Respuestas: `202 Accepted` o `500`.
- `POST /api/notificaciones/notificar-mora`
	- Ejecutar procedimiento de aviso por mora.
	- Respuestas: `202 Accepted` o `500`.
- `POST /api/notificaciones/notificar-cancelacion`
	- Ejecutar procedimiento de aviso por cancelación.
	- Respuestas: `202 Accepted` o `500`.
- `GET /api/notificaciones`
	- Listar histórico de notificaciones.

**Auditoría**
- `POST /api/auditoria/registrar`
	- Registrar auditoría de operación.
	- Body JSON: `{ "usuario": "u1", "ip": "1.2.3.4", "dominio": "miapp", "tabla": "PRESTAMOS", "operacion": "INSERT", "descripcion": "detalle" }`.
	- Respuesta: `201 Created` `{ ok: true, id_audit }`.
- `POST /api/auditoria/finalizar`
	- Finaliza sesión de auditoría.
	- Body JSON: `{ "id_audit": 123 }`.
	- Respuesta: `200 OK` `{ ok: true, id_audit }`.

---

**Contratos resumidos (modelos esperados)**
- `Prestatario`: `{ ci:number, nombres:string, apellidos:string, email?:string, telefono?:string, direccion?:string, foto?:blob/base64 }`
- `Préstamo`: `{ id?:number, ci:number, monto:number, tipo:'BAJA'|'MEDIA'|'ALTA', plazo_meses:number, estado?:string, total?:number, cuotas?:number }`
- `Cuota`: `{ id:number, id_prestamo:number, fecha_vencimiento:string, monto:number, estado:'PENDIENTE'|'PAGADA'|'MOROSA' }`
- `Notificación`: `{ id:number, tipo:'PAGO'|'MORA'|'CANCELACION', enviado:'S'|'N', destino?:string, mensaje?:string }`
- `Auditoría`: `{ id_audit:number, usuario:string, ip:string, dominio:string, tabla:string, operacion:string, inicio:string, fin?:string }`

**Ejemplos de respuesta**
- Registro de préstamo (201):
	`{ "ok": true, "result": { "id": 1, "numero": "PR-2025-0001", "ci": 1234567890, "monto": 1000000, "tipo": "MEDIA", "plazo_meses": 12, "total": 1150000, "cuotas": 12, "estado": "ACTIVO" } }`
- Pago de cuota (201):
	`{ "ok": true, "result": { "id_cuota": 1, "estado": "PAGADA", "fecha_pago": "2025-12-01", "monto_pagado": 85000, "saldo_restante": 0 } }`

**Colección de pruebas (Postman)**
- Archivo: `docs/api.postman_collection.json`
- Variable `baseUrl`: por defecto `http://localhost:3000`

---

**Casos de Uso Esenciales** (y endpoints relacionados)
- Solicitud de préstamo por parte de un cliente: `POST /api/prestamos`
- Pago oportuno o tardío de cuotas: `POST /api/cuotas/:idCuota/pagar` y consulta `GET /api/cuotas/morosas`
- Clasificación de cliente moroso: `GET /api/cuotas/prestatarios/:id/morosidad`, `GET /api/cuotas/morosas`
- Generación de extracto financiero mensual: `GET /api/cuotas/prestatarios/:id/resumen-cuotas`, `GET /api/reportes/prestamos`
- Carga masiva de nuevos clientes: `POST /api/prestatarios/carga` o `POST /api/prestatarios/carga-masiva`, logs: `GET /api/prestatarios/cargas/logs`
- Registro de refinanciación o nuevo préstamo: `POST /api/prestamos` y `POST /api/prestamos/:idPrestamo/refinanciaciones`
- Envío de correo automático de recordatorio: `POST /api/notificaciones/recordatorios-pago` y `POST /api/notificaciones/enviar`
- Auditoría de usuarios y operaciones realizadas: `POST /api/auditoria/registrar`, `POST /api/auditoria/finalizar`

---

**Recomendación de Vistas del Frontend**
- Gestión de Clientes
	- Listado y búsqueda de prestatarios.
	- Formulario de nuevo/edición de prestatario.
	- Detalle de prestatario con foto (subida archivo o cámara), y validación de cédula.
	- Carga masiva: pantalla para subir CSV/TXT y ver resultado y logs.
- Gestión de Préstamos
	- Formulario de solicitud de préstamo (monto, tipo, plazo) con cálculo de cuotas y validaciones (máx. 2 activos).
	- Listado de préstamos por cliente y detalle de préstamo.
	- Acción de refinanciación: formulario y historial por préstamo.
- Gestión de Cuotas
	- Calendario/listado de cuotas por préstamo/cliente con estado.
	- Pantalla de pago de cuota (captura de monto y método, validación de vencimiento).
	- Indicadores de morosidad por cliente y listado de cuotas morosas/pendientes.
- Reportes
	- Consolidado de préstamos (tabla con filtros y exportación).
	- Reporte de morosos/DataCrédito (simulado).
	- Reporte de refinanciaciones activas.
- Notificaciones
	- Bandeja de notificaciones pendientes e histórico.
	- Acciones para ejecutar envíos masivos por tipo y recordatorios.
- Auditoría y Seguridad
	- Panel de auditoría básica: registro manual de operación y cierre de sesión (si aplica mostrar trazas por usuario/tabla).

---

**Notas para Integración**
- Content-Type según endpoint: usar `application/json` salvo donde se indique `multipart/form-data`.
- Fechas en formato ISO `YYYY-MM-DD`.
- Muchos endpoints generan auditoría automáticamente mediante middleware.

**Buenas prácticas para el frontend**
- Validar cédula con `GET /api/prestatarios/validar/:ci` antes de registrar.
- Mostrar confirmaciones en operaciones 201/202 y manejar errores `{ ok:false, error }`.
- Reintentar procesos de notificación solo si el backend devuelve `500` y no duplicar envíos.
- Para cargas masivas, mostrar el log devuelto y permitir descarga.

**Ejecución**
- Instalar dependencias y ejecutar servidor:
	```powershell
	npm install
	npm run start
	```
