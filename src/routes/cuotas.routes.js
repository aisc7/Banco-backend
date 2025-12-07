const express = require('express');
const router = express.Router();

const controller = require('../controllers/cuotas.controller');
const auditoria = require('../middlewares/auditoria');

// Registrar pago de cuota
router.post('/:idCuota/pagar', auditoria('CUOTAS','UPDATE'), controller.registrarPago);

// Obtener morosidad por prestatario
router.get('/prestatarios/:id/morosidad', controller.obtenerMorosidad);

// Aplicar penalización a prestatario (opcional)
router.post('/prestatarios/:id/aplicar-penalizacion', auditoria('CUOTAS','UPDATE'), controller.aplicarPenalizacion);

// Resumen de cuotas por prestatario
router.get('/prestatarios/:id/resumen-cuotas', controller.resumenCuotas);

// Vistas de reportes
router.get('/pendientes', controller.listarPendientes);
router.get('/morosas', controller.listarMorosas);

module.exports = router;
