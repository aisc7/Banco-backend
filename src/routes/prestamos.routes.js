const express = require('express');
const router = express.Router();

const controller = require('../controllers/prestamos.controller');
const auditoria = require('../middlewares/auditoria');

// Crear préstamo (número automático, tasa por tipo, cálculo automático, control de máximo 2 activos)
router.post('/', auditoria('PRESTAMOS','INSERT'), controller.crear);

// Registrar refinanciación
router.post('/:idPrestamo/refinanciaciones', auditoria('SOLICITUDES_REFINANCIACION','INSERT'), controller.registrarRefinanciacion);

// Obtener préstamos por prestatario
router.get('/prestatario/:ci', controller.obtenerPorPrestatario);

// Listar todos los préstamos
router.get('/', controller.listar);

// Obtener préstamo por ID
router.get('/:idPrestamo', controller.obtenerPorId);

// Actualizar préstamo (campos permitidos: estado, id_empleado)
router.put('/:idPrestamo', auditoria('PRESTAMOS','UPDATE'), controller.actualizar);

// Cancelar/eliminar préstamo (marca estado='CANCELADO')
router.delete('/:idPrestamo', auditoria('PRESTAMOS','DELETE'), controller.eliminar);

module.exports = router;
