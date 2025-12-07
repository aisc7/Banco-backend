// Business logic placeholders for prestatarios
const model = require('../models/prestatarios.model');
const auditoriaService = require('./auditoria.service');

module.exports = {
  registrar: async (data) => {
    await auditoriaService.registrarEntrada('PRESTATARIOS','INSERT');
    const result = await model.insertPrestatario(data);
    await auditoriaService.registrarSalida('PRESTATARIOS','INSERT');
    return result;
  },
  modificar: async (ci, data) => {
    await auditoriaService.registrarEntrada('PRESTATARIOS','UPDATE');
    const result = await model.updatePrestatario(ci, data);
    await auditoriaService.registrarSalida('PRESTATARIOS','UPDATE');
    return result;
  },
  eliminar: async (ci) => {
    await auditoriaService.registrarEntrada('PRESTATARIOS','DELETE');
    const result = await model.deletePrestatario(ci);
    await auditoriaService.registrarSalida('PRESTATARIOS','DELETE');
    return result;
  },
  subirFoto: async (ci, file) => {
    return model.updateFoto(ci, file);
  },
  validarCedula: async (ci) => {
    return model.checkCedula(ci);
  },
  cargaMasiva: async (payload) => {
    return model.bulkLoad(payload);
  },
  obtenerLogsCarga: async () => {
    return model.getLoadLogs();
  },
  obtenerPorCedula: async (ci) => {
    return model.getByCedula(ci);
  },
  listar: async () => {
    return model.listAll();
  },
};
