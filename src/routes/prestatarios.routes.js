const express = require('express');
const router = express.Router();

const controller = require('../controllers/prestatarios.controller');
const uploadPhoto = require('../middlewares/uploadPhoto');
const validateCedula = require('../middlewares/validateCedula');
const auditoria = require('../middlewares/auditoria');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const allowEmployeeOrOwner = require('../middlewares/allowEmployeeOrOwner');
const prestatariosModel = require('../models/prestatarios.model');

// Registrar cliente (público)
router.post('/', auditoria('PRESTATARIOS','INSERT'), validateCedula, controller.registrar);

// Modificar cliente (empleado o propietario)
router.put('/:ci', auth, allowEmployeeOrOwner(async (req) => {
	const ci = Number(req.params.ci);
	const r = await prestatariosModel.getByCedula(ci);
	return r?.ID_PRESTATARIO || r?.id_prestatario || null;
}), auditoria('PRESTATARIOS','UPDATE'), controller.modificar);

// Eliminar cliente (solo empleados)
router.delete('/:ci', auth, requireRole('EMPLEADO'), auditoria('PRESTATARIOS','DELETE'), controller.eliminar);

// Subir fotografía (BLOB) - empleado o propietario
router.post('/:ci/foto', auth, allowEmployeeOrOwner(async (req) => {
	const ci = Number(req.params.ci);
	const r = await prestatariosModel.getByCedula(ci);
	return r?.ID_PRESTATARIO || r?.id_prestatario || null;
}), auditoria('PRESTATARIOS','UPDATE'), uploadPhoto.single('foto'), controller.subirFoto);

// Validar duplicidad de cédula
router.get('/validar/:ci', controller.validarCedula);

// Obtener por cédula (empleado o propietario)
router.get('/:ci', auth, allowEmployeeOrOwner(async (req) => {
	const ci = Number(req.params.ci);
	const r = await prestatariosModel.getByCedula(ci);
	return r?.ID_PRESTATARIO || r?.id_prestatario || null;
}), controller.obtenerPorCedula);

// Listar todos (solo empleados)
router.get('/', auth, requireRole('EMPLEADO'), controller.listar);

// Listar morosos (solo empleados)
router.get('/morosos', auth, requireRole('EMPLEADO'), controller.listarMorosos);

// Carga masiva desde CSV o TXT (solo empleados)
router.post('/carga', auth, requireRole('EMPLEADO'), auditoria('LOG_CARGA_CLIENTES','INSERT'), controller.cargaMasiva);
// Alias requerido por especificación (JSON o multipart)
router.post('/carga-masiva', auth, requireRole('EMPLEADO'), auditoria('LOG_CARGA_CLIENTES','INSERT'), uploadPhoto.single('archivo'), controller.cargaMasiva);
// Alias adicional solicitado
router.post('/upload-masivo', auth, requireRole('EMPLEADO'), auditoria('LOG_CARGA_CLIENTES','INSERT'), uploadPhoto.single('archivo'), controller.cargaMasiva);

// Obtener logs de carga masiva (solo empleados)
router.get('/obtener-logs-carga', auth, requireRole('EMPLEADO'), controller.obtenerLogsCarga);

// Generación de logs de carga
router.get('/cargas/logs', auth, requireRole('EMPLEADO'), controller.obtenerLogsCarga);

module.exports = router;
