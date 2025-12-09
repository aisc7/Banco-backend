const authService = require('../services/auth.service');

module.exports = {
  login: async (req, res) => {
    try {
      const { username, password } = req.body;
      if (!username || !password) return res.status(400).json({ success: false, data: null, message: 'username y password requeridos' });
      const token = await authService.login(username, password);
      res.json({ success: true, data: { token }, message: 'Autenticado' });
    } catch (err) {
      res.status(401).json({ success: false, data: null, message: err.message });
    }
  },
  // Crear usuario simple (protegido idealmente, uso administrativo)
  createUser: async (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password) return res.status(400).json({ success: false, data: null, message: 'username y password requeridos' });
      const result = await authService.createUser(username, password, role);
      res.status(201).json({ success: true, data: result, message: 'Usuario creado' });
    } catch (err) {
      res.status(500).json({ success: false, data: null, message: err.message });
    }
  },

  /**
   * Registro completo de prestatario + usuario.
   * Crea el registro en PRESTATARIOS y el usuario en USUARIOS en una transacción.
   */
  registerPrestatario: async (req, res) => {
    try {
      const { username, password, prestatario } = req.body;
      const result = await authService.registerPrestatario({ username, password, prestatario });
      return res.status(201).json({
        success: true,
        data: result,
        message: 'Prestatario y usuario creados correctamente.',
      });
    } catch (err) {
      const code = err.code || err.errorNum;
      if (code === 'VALIDATION_ERROR') {
        return res.status(400).json({ success: false, data: null, message: err.message });
      }
      if (code === 'DUP_CI' || code === 'DUP_USERNAME' || code === 1) {
        return res.status(409).json({ success: false, data: null, message: err.message });
      }
      return res.status(500).json({ success: false, data: null, message: err.message || 'Error al registrar prestatario' });
    }
  },

  /**
   * Registro completo de empleado + usuario.
   * Crea el registro en EMPLEADOS y el usuario en USUARIOS en una transacción.
   */
  registerEmpleado: async (req, res) => {
    try {
      const { username, password, empleado } = req.body;
      const result = await authService.registerEmpleado({ username, password, empleado });
      return res.status(201).json({
        success: true,
        data: result,
        message: 'Empleado y usuario creados correctamente.',
      });
    } catch (err) {
      const code = err.code || err.errorNum;
      if (code === 'VALIDATION_ERROR') {
        return res.status(400).json({ success: false, data: null, message: err.message });
      }
      if (code === 'DUP_EMPLEADO' || code === 'DUP_USERNAME' || code === 1) {
        return res.status(409).json({ success: false, data: null, message: err.message });
      }
      return res.status(500).json({ success: false, data: null, message: err.message || 'Error al registrar empleado' });
    }
  },
};
