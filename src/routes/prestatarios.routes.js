const express = require('express');
const router = express.Router();

const controller = require('../controllers/prestatarios.controller');
const uploadPhoto = require('../middlewares/uploadPhoto');
const validateCedula = require('../middlewares/validateCedula');
const auditoria = require('../middlewares/auditoria');

// Registrar cliente
router.post('/', auditoria('PRESTATARIOS','INSERT'), validateCedula, controller.registrar);

// Modificar cliente
router.put('/:ci', auditoria('PRESTATARIOS','UPDATE'), controller.modificar);

// Eliminar cliente
router.delete('/:ci', auditoria('PRESTATARIOS','DELETE'), controller.eliminar);

// Subir fotografía (BLOB)
router.post('/:ci/foto', auditoria('PRESTATARIOS','UPDATE'), uploadPhoto.single('foto'), controller.subirFoto);

// Validar duplicidad de cédula
router.get('/validar/:ci', controller.validarCedula);

// Obtener por cédula
router.get('/:ci', controller.obtenerPorCedula);

// Listar todos
router.get('/', controller.listar);

// Carga masiva desde CSV o TXT
router.post('/carga', auditoria('LOG_CARGA_CLIENTES','INSERT'), controller.cargaMasiva);
// Alias requerido por especificación (JSON o multipart)
router.post('/carga-masiva', auditoria('LOG_CARGA_CLIENTES','INSERT'), uploadPhoto.single('archivo'), controller.cargaMasiva);

// Obtener logs de carga masiva (alias adicional solicitado)
router.get('/obtener-logs-carga', controller.obtenerLogsCarga);

// Generación de logs de carga
router.get('/cargas/logs', controller.obtenerLogsCarga);

module.exports = router;
