const express = require('express');
const router = express.Router();

const controller = require('../controllers/auditoria.controller');

// Registrar auditoría manual
router.post('/registrar', controller.registrarAuditoria);

// Finalizar sesión de auditoría
router.post('/finalizar', controller.finalizarSesion);

// Consultar logs de auditoría (vista de la tabla LOG_AUDITORIA)
router.get('/logs', controller.listarLogs);

module.exports = router;
