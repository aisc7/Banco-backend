/**
 * Middleware factory que permite el acceso si el usuario es EMPLEADO
 * o si es propietario del recurso.
 * getOwnerId: async (req) => ownerId (number) or null
 */
module.exports = (getOwnerId) => {
  return async (req, res, next) => {
    if (!req.user) return res.status(401).json({ success: false, data: null, message: 'Autenticación requerida' });
    if (req.user.role === 'EMPLEADO' || req.user.role === 'ADMIN') return next();
    try {
      const ownerId = await getOwnerId(req);
      const userOwnerId = req.user.id_prestatario || req.user.ID_PRESTATARIO || null;
      if (!userOwnerId) return res.status(403).json({ success: false, data: null, message: 'Cuenta no vinculada a prestatario' });
      if (ownerId == userOwnerId) return next();
      return res.status(403).json({ success: false, data: null, message: 'No autorizado' });
    } catch (err) {
      return res.status(500).json({ success: false, data: null, message: err.message });
    }
  };
};
