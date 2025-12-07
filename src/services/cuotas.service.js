const model = require('../models/cuotas.model');

module.exports = {
  registrarPago: async (idCuota, data) => {
    return model.registrarPagoCuota(idCuota, data);
  },
  obtenerMorosidad: async (idPrestatario) => {
    return model.obtenerMorosidad(idPrestatario);
  },
  aplicarPenalizacion: async (idPrestatario) => {
    return model.aplicarPenalizacion(idPrestatario);
  },
  resumenCuotas: async (idPrestatario) => {
    return model.resumenCuotas(idPrestatario);
  },
  listarPendientes: async () => {
    return model.listarPendientes();
  },
  listarMorosas: async () => {
    return model.listarMorosas();
  },
};
