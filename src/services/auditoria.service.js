const model = require('../models/auditoria.model');

module.exports = {
  registrarEntrada: async (tabla, operacion) => {
    return model.registrarLog({ tabla_afectada: tabla, operacion, tipo: 'ENTRADA' });
  },
  registrarSalida: async (tabla, operacion) => {
    return model.registrarLog({ tabla_afectada: tabla, operacion, tipo: 'SALIDA' });
  },
  registrarAuditoria: async (payload) => {
    return model.registrarAuditoria(payload);
  },
  finalizarSesion: async (id_audit) => {
    return model.finalizarSesion(id_audit);
  },
  listarLogs: async (filters) => {
    return await model.listarLogs(filters);
  },
};
