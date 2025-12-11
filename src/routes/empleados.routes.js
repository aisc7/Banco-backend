const express = require('express');
const router = express.Router();

const controller = require('../controllers/empleados.controller');
const auditoria = require('../middlewares/auditoria');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');

// Perfil del empleado autenticado
router.get('/me', auth, requireRole('EMPLEADO'), controller.getMe);

// Crear empleado
router.post('/', auditoria('EMPLEADOS','INSERT'), controller.crear);

// Listar todos
router.get('/', controller.listar);

// Obtener por id
router.get('/:id', controller.obtenerPorId);

// Actualizar
router.put('/:id', auditoria('EMPLEADOS','UPDATE'), controller.actualizar);

// Eliminar
router.delete('/:id', auditoria('EMPLEADOS','DELETE'), controller.eliminar);

module.exports = router;
