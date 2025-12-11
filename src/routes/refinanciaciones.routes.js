// Banco-backend/src/routes/refinanciaciones.routes.js
const express = require('express');

const router = express.Router();

const controller = require('../controllers/refinanciaciones.controller');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const auditoria = require('../middlewares/auditoria');

/**
 * BASE: /api/refinanciaciones
 *
 * Rutas nuevas con namespace /solicitudes para que coincidan
 * con lo que usa el frontend (prestamosApi.ts).
 *
 * Front:
 *  - POST   /api/refinanciaciones/solicitudes
 *  - GET    /api/refinanciaciones/mis-solicitudes
 *  - GET    /api/refinanciaciones/solicitudes?estado=
 *  - PUT    /api/refinanciaciones/solicitudes/:id/aprobar
 *  - PUT    /api/refinanciaciones/solicitudes/:id/rechazar
 */

/**
 * Crear solicitud de refinanciación
 *  - Rol: PRESTATARIO
 *  - Body:
 *      { id_prestamo, nuevo_nro_cuotas, comentario_cliente? }
 */
router.post(
  '/solicitudes',
  auth,
  requireRole('PRESTATARIO'),
  auditoria('SOLICITUDES_REFINANCIACION', 'INSERT'),
  controller.crear,
);

/**
 * Mis solicitudes de refinanciación (cliente PRESTATARIO)
 *  - GET /api/refinanciaciones/mis-solicitudes
 */
router.get(
  '/mis-solicitudes',
  auth,
  requireRole('PRESTATARIO'),
  controller.misSolicitudes,
);

/**
 * Listar solicitudes de refinanciación (EMPLEADO)
 *  - GET /api/refinanciaciones/solicitudes?estado=PENDIENTE|APROBADA|RECHAZADA
 */
router.get(
  '/solicitudes',
  auth,
  requireRole('EMPLEADO'),
  controller.listar,
);

/**
 * Aprobar solicitud de refinanciación (EMPLEADO)
 *  - PUT /api/refinanciaciones/solicitudes/:id/aprobar
 */
router.put(
  '/solicitudes/:id/aprobar',
  auth,
  requireRole('EMPLEADO'),
  auditoria('SOLICITUDES_REFINANCIACION', 'UPDATE'),
  controller.aprobar,
);

/**
 * Rechazar solicitud de refinanciación (EMPLEADO)
 *  - PUT /api/refinanciaciones/solicitudes/:id/rechazar
 */
router.put(
  '/solicitudes/:id/rechazar',
  auth,
  requireRole('EMPLEADO'),
  auditoria('SOLICITUDES_REFINANCIACION', 'UPDATE'),
  controller.rechazar,
);

/* ---------------------------------------------------------
 * (Opcional) Compatibilidad con las rutas antiguas:
 *  - POST /api/refinanciaciones/
 *  - GET  /api/refinanciaciones/
 *  - PUT  /api/refinanciaciones/:id/aprobar
 *  - PUT  /api/refinanciaciones/:id/rechazar
 * Si ya no las usas, puedes borrar este bloque.
 * --------------------------------------------------------- */

router.post(
  '/',
  auth,
  requireRole('PRESTATARIO'),
  auditoria('SOLICITUDES_REFINANCIACION', 'INSERT'),
  controller.crear,
);

router.get(
  '/',
  auth,
  requireRole('EMPLEADO'),
  controller.listar,
);

router.put(
  '/:id/aprobar',
  auth,
  requireRole('EMPLEADO'),
  auditoria('SOLICITUDES_REFINANCIACION', 'UPDATE'),
  controller.aprobar,
);

router.put(
  '/:id/rechazar',
  auth,
  requireRole('EMPLEADO'),
  auditoria('SOLICITUDES_REFINANCIACION', 'UPDATE'),
  controller.rechazar,
);

module.exports = router;
