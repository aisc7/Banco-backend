/**
 * Servicio para EMPLEADOS: capa de negocio ligera que invoca al modelo
 * y registra auditoría en operaciones críticas.
 */
const model = require('../models/empleados.model');
const auditoriaService = require('./auditoria.service');

module.exports = {
  createEmpleado: async (data) => {
    await auditoriaService.registrarEntrada('EMPLEADOS', 'INSERT');
    const result = await model.createEmpleado(data);
    await auditoriaService.registrarSalida('EMPLEADOS', 'INSERT');
    return result;
  },
  listAll: async () => {
    return model.getAllEmpleados();
  },
  getById: async (id) => {
    return model.getEmpleadoById(id);
  },
  updateEmpleado: async (id, data) => {
    await auditoriaService.registrarEntrada('EMPLEADOS', 'UPDATE');
    const result = await model.updateEmpleado(id, data);
    await auditoriaService.registrarSalida('EMPLEADOS', 'UPDATE');
    return result;
  },
  deleteEmpleado: async (id) => {
    await auditoriaService.registrarEntrada('EMPLEADOS', 'DELETE');
    const result = await model.deleteEmpleado(id);
    await auditoriaService.registrarSalida('EMPLEADOS', 'DELETE');
    return result;
  },
};
