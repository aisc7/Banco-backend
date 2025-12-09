// Business logic placeholders for prestamos
const model = require('../models/prestamos.model');

module.exports = {
  crear: async (data) => {
    return model.createPrestamo(data);
  },
  registrarRefinanciacion: async (idPrestamo, data) => {
    return model.createRefinanciacion(idPrestamo, data);
  },
  obtenerPorPrestatario: async (ci) => {
    return model.findByPrestatario(ci);
  },
  obtenerPorPrestatarioPorId: async (id_prestatario) => {
    return model.findByPrestatarioId(id_prestatario);
  },
  listar: async () => {
    return model.findAll();
  },
  obtenerPorId: async (idPrestamo) => {
    return model.findById(idPrestamo);
  },
  actualizar: async (idPrestamo, data) => {
    return model.updatePrestamo(idPrestamo, data);
  },
  eliminar: async (idPrestamo) => {
    return model.deletePrestamo(idPrestamo);
  },
};
