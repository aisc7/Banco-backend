const express = require('express');
const router = express.Router();

const controller = require('../controllers/notificaciones.controller');

// Consultar notificaciones pendientes (enviado='N')
router.get('/pendientes', controller.listarPendientes);

// Marcar notificaciones como enviadas por tipo
router.post('/enviar', controller.enviarMasivas);

// Ejecutar procedimientos programados manualmente (simulación de jobs)
router.post('/recordatorios-pago', controller.recordatoriosPago);
router.post('/notificar-mora', controller.notificarMora);
router.post('/notificar-cancelacion', controller.notificarCancelacion);

// Histórico de notificaciones
router.get('/', controller.listarHistorico);

module.exports = router;
