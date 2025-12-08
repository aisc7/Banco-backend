/**
 * Middleware factory para requerir un rol en `req.user.role`.
 */
module.exports = (role) => {
  return (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, data: null, message: 'Autenticación requerida' });
    if (req.user.role !== role) return res.status(403).json({ success: false, data: null, message: 'No autorizado' });
    next();
  };
};
