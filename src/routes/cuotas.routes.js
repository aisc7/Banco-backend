const express = require('express');
const router = express.Router();

const controller = require('../controllers/cuotas.controller');
const auditoria = require('../middlewares/auditoria');
const auth = require('../middlewares/auth');
const allowEmployeeOrOwner = require('../middlewares/allowEmployeeOrOwner');
const requireRole = require('../middlewares/requireRole');
const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

// Registrar pago de cuota (empleado o propietario)
router.post('/:idCuota/pagar', auth, allowEmployeeOrOwner(async (req) => {
	const idCuota = Number(req.params.idCuota);
	const conn = await getConnection();
	try {
		const q = `SELECT p.id_prestatario FROM prestamos p JOIN cuotas c ON c.id_prestamo = p.id_prestamo WHERE c.id_cuota = :id`;
		const r = await conn.execute(q, { id: idCuota }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
		return r.rows?.[0]?.ID_PRESTATARIO || r.rows?.[0]?.id_prestatario || null;
	} finally {
		await conn.close();
	}
}), auditoria('CUOTAS','UPDATE'), controller.registrarPago);

// Obtener morosidad por prestatario
router.get('/prestatarios/:id/morosidad', controller.obtenerMorosidad);

// Aplicar penalización a prestatario (opcional) - solo empleados
router.post('/prestatarios/:id/aplicar-penalizacion', auth, requireRole('EMPLEADO'), auditoria('CUOTAS','UPDATE'), controller.aplicarPenalizacion);

// Resumen de cuotas por prestatario (empleado o propietario)
router.get('/prestatarios/:id/resumen-cuotas', auth, allowEmployeeOrOwner(async (req) => Number(req.params.id)), controller.resumenCuotas);

// Vistas de reportes (solo empleados)
router.get('/pendientes', auth, requireRole('EMPLEADO'), controller.listarPendientes);
router.get('/morosas', auth, requireRole('EMPLEADO'), controller.listarMorosas);

// Listar cuotas por préstamo (empleado o dueño)
router.get('/prestamo/:idPrestamo', auth, allowEmployeeOrOwner(async (req) => {
	const idPrestamo = Number(req.params.idPrestamo);
	if (!Number.isFinite(idPrestamo)) return null;
	const conn = await getConnection();
	try {
		const q = `SELECT id_prestatario FROM prestamos WHERE id_prestamo = :id`;
		const r = await conn.execute(q, { id: idPrestamo }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
		return r.rows?.[0]?.ID_PRESTATARIO || r.rows?.[0]?.id_prestatario || null;
	} finally {
		await conn.close();
	}
}), controller.listarPorPrestamo);

// Listado global de cuotas (solo empleados)
router.get('/', auth, requireRole('EMPLEADO'), controller.listarAll);

// DEV-ONLY: marcar vencidas ahora (solo EMPLEADO)
router.post('/dev/marcar-vencidas', auth, requireRole('EMPLEADO'), controller.marcarVencidasDev);

// Estado moroso derivado por prestatario (EMPLEADO o dueño)
router.get('/prestatarios/:id/estado-moroso', auth, allowEmployeeOrOwner(async (req) => Number(req.params.id)), controller.estadoMorosoDerivado);

module.exports = router;
