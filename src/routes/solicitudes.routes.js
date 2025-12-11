const express = require('express');
const router = express.Router();
console.log('>>> cargando rutas de SOLICITUDES'); 
console.log(">>> SOLICITUDES ROUTES FILE CARGADO:", __filename);


const controller = require('../controllers/solicitudes.controller');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');
const allowEmployeeOrOwner = require('../middlewares/allowEmployeeOrOwner');
const auditoria = require('../middlewares/auditoria');

// Crear solicitud (prestatario autenticado o empleado creando a nombre de un cliente)
router.post('/', auth, auditoria('SOLICITUDES_PRESTAMO','INSERT'), controller.crear);

// Mis solicitudes (solo prestatario autenticado)
router.get('/mis-solicitudes', auth, requireRole('PRESTATARIO'), controller.misSolicitudes);

// Listar solicitudes (solo empleados) con filtros ?estado=&id_prestatario=
router.get('/', auth, requireRole('EMPLEADO'), controller.listar);

// Aprobar solicitud (solo empleados)
router.put('/:id/aprobar', auth, requireRole('EMPLEADO'), auditoria('SOLICITUDES_PRESTAMO','UPDATE'), controller.aprobar);

// Rechazar solicitud (solo empleados)
router.put('/:id/rechazar', auth, requireRole('EMPLEADO'), auditoria('SOLICITUDES_PRESTAMO','UPDATE'), controller.rechazar);

module.exports = router;
