const express = require('express');
const router = express.Router();
const controller = require('../controllers/auth.controller');
const auth = require('../middlewares/auth');
const requireRole = require('../middlewares/requireRole');

// Login público
router.post('/login', controller.login);

// Registro completo (público, se protege a nivel de frontend con palabra secreta)
router.post('/register-prestatario', controller.registerPrestatario);
router.post('/register-empleado', controller.registerEmpleado);

// Crear usuario (protegido — solo administradores pueden crear usuarios)
router.post('/users', auth, requireRole('ADMIN'), controller.createUser);

module.exports = router;
