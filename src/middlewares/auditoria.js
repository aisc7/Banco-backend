// Auditoria middleware: captures request context for audit logs
module.exports = (tabla, operacion) => {
  return (req, _res, next) => {
    // Preferir usuario autenticado (req.user.username) cuando exista
    const usuario = (req.user && (req.user.username || req.user.USERNAME)) || req.headers['x-user'] || 'anonymous';
    req.auditContext = {
      tabla,
      operacion,
      usuario,
      ip: req.ip,
      dominio: req.headers.host,
      fecha_entrada: new Date(),
    };
    next();
  };
};
