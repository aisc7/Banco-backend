// Auditoria middleware: captures request context for audit logs
module.exports = (tabla, operacion) => {
  return (req, _res, next) => {
    req.auditContext = {
      tabla,
      operacion,
      usuario: req.headers['x-user'] || 'anonymous',
      ip: req.ip,
      dominio: req.headers.host,
      fecha_entrada: new Date(),
    };
    next();
  };
};
