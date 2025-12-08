const usersModel = require('../models/users.model');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

/**
 * Servicio de autenticación: login y creación mínima de usuarios.
 */
module.exports = {
  login: async (username, password) => {
    const user = await usersModel.findByUsername(username);
    if (!user) throw new Error('Usuario o contraseña inválidos');

    const ok = await bcrypt.compare(password, user.PASSWORD_HASH || user.password_hash);
    if (!ok) throw new Error('Usuario o contraseña inválidos');

    const payload = { id: user.ID || user.ID_USUARIO || user.id, username: user.USERNAME || user.username, role: user.ROLE || user.role, id_prestatario: user.ID_PRESTATARIO || user.id_prestatario || null };
    const token = jwt.sign(payload, process.env.JWT_SECRET || 'dev_secret', { expiresIn: process.env.JWT_EXPIRY || '1h' });
    return token;
  },

  // Crear usuario nuevo (hash password)
  createUser: async (username, password, role = 'EMPLEADO') => {
    const saltRounds = 10;
    const hash = await bcrypt.hash(password, saltRounds);
    return usersModel.createUser(username, hash, role);
  }
};
