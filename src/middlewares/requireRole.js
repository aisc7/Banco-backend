// Banco-backend/src/middlewares/requireRole.js

/**
 * Middleware de autorización por rol.
 *
 * Permite pasar:
 *  - un string: requireRole('ADMIN')
 *  - o un array: requireRole(['ADMIN', 'EMPLEADO'])
 */
module.exports = function requireRole(expected) {
  return (req, res, next) => {
    const role =
      req.user && (req.user.role || req.user.ROL || req.user.rol);

    const expectedRoles = Array.isArray(expected) ? expected : [expected];

    if (!role || !expectedRoles.includes(role)) {
      return res.status(403).json({
        ok: false,
        error: 'No tienes permisos para realizar esta acción',
      });
    }

    return next();
  };
};
