const jwt = require('jsonwebtoken');

/**
 * Middleware que valida JWT en header Authorization: Bearer <token>
 * Si es válido, agrega `req.user` con el payload.
 */
module.exports = (req, res, next) => {
  const auth = req.headers.authorization || '';
  const m = auth.match(/^Bearer\s+(.+)$/i);
  if (!m) return res.status(401).json({ success: false, data: null, message: 'Token requerido' });

  const token = m[1];
  try {
    const payload = jwt.verify(token, process.env.JWT_SECRET || 'dev_secret');
    req.user = payload;
    return next();
  } catch (err) {
    return res.status(401).json({ success: false, data: null, message: 'Token inválido' });
  }
};
