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
  // opcional: crear usuario (protegido idealmente)
  createUser: async (req, res) => {
    try {
      const { username, password, role } = req.body;
      if (!username || !password) return res.status(400).json({ success: false, data: null, message: 'username y password requeridos' });
      const result = await authService.createUser(username, password, role);
      res.status(201).json({ success: true, data: result, message: 'Usuario creado' });
    } catch (err) {
      res.status(500).json({ success: false, data: null, message: err.message });
    }
  }
};
