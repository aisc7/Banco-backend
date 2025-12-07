const express = require('express');
const router = express.Router();

const controller = require('../controllers/auditoria.controller');

// Registrar auditoría manual
router.post('/registrar', controller.registrarAuditoria);

// Finalizar sesión de auditoría
router.post('/finalizar', controller.finalizarSesion);

module.exports = router;
