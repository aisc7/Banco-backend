const express = require('express');
const router = express.Router();

const controller = require('../controllers/prestamos.controller');
const auditoria = require('../middlewares/auditoria');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const allowEmployeeOrOwner = require('../middlewares/allowEmployeeOrOwner');
const prestamosModel = require('../models/prestamos.model');

// Crear préstamo (prestatario autenticado puede crear su solicitud; empleados pueden crear para cualquiera)
router.post('/', auth, auditoria('PRESTAMOS','INSERT'), controller.crear);

// Registrar refinanciación
router.post('/:idPrestamo/refinanciaciones', auditoria('SOLICITUDES_REFINANCIACION','INSERT'), controller.registrarRefinanciacion);

// Obtener préstamos por prestatario (empleado o propietario)
router.get(
  '/prestatario/:ci',
  auth,
  allowEmployeeOrOwner(async (req) => {
    // Empleado/Admin pasan siempre; este callback solo se evalúa para PRESTATARIO.
    if (req.user && (req.user.role === 'PRESTATARIO')) {
      return req.user.id_prestatario || req.user.ID_PRESTATARIO || null;
    }
    const ci = Number(req.params.ci);
    if (!ci || Number.isNaN(ci)) return null;
    const info = await prestamosModel.findByPrestatario(ci);
    return info.prestatario?.id_prestatario || null;
  }),
  controller.obtenerPorPrestatario
);

// Listar todos los préstamos (solo empleados)
router.get('/', auth, requireRole('EMPLEADO'), controller.listar);

// Mis préstamos (solo prestatario autenticado)
router.get('/mis-prestamos', auth, requireRole('PRESTATARIO'), controller.misPrestamos);

// Obtener préstamo por ID (empleado o propietario)
router.get('/:idPrestamo', auth, allowEmployeeOrOwner(async (req) => {
	const id = Number(req.params.idPrestamo);
	const prestamo = await prestamosModel.findById(id);
	return prestamo?.ID_PRESTATARIO || prestamo?.id_prestatario || null;
}), controller.obtenerPorId);

// Actualizar préstamo (solo empleados)
router.put('/:idPrestamo', auth, requireRole('EMPLEADO'), auditoria('PRESTAMOS','UPDATE'), controller.actualizar);

// Cancelar/eliminar préstamo (solo empleados)
router.delete('/:idPrestamo', auth, requireRole('EMPLEADO'), auditoria('PRESTAMOS','DELETE'), controller.eliminar);

module.exports = router;
