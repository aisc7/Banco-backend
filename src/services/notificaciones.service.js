const model = require('../models/notificaciones.model');

module.exports = {
  listarPendientes: async () => {
    return model.listarPendientes();
  },
  enviarMasivas: async (tipo) => {
    return model.enviarMasivas(tipo);
  },
  recordatoriosPago: async () => {
    return model.recordatoriosPago();
  },
  notificarMora: async () => {
    return model.notificarMora();
  },
  notificarCancelacion: async () => {
    return model.notificarCancelacion();
  },
  listarHistorico: async () => {
    return model.listarHistorico();
  },
};
