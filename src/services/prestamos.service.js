// Reglas de negocio para préstamos y refinanciaciones.
const model = require('../models/prestamos.model');
const notificacionesService = require('./notificaciones.service');

module.exports = {
  /**
   * Crea un nuevo préstamo delegando en el paquete PL/SQL.
   */
  crear: async (data) => {
    return model.createPrestamo(data);
  },

  /**
   * Registra una refinanciación vía PL/SQL y crea una notificación asociada.
   */
  registrarRefinanciacion: async (idPrestamo, data) => {
    const result = await model.createRefinanciacion(idPrestamo, data);

    try {
      const prestamo = await model.findById(idPrestamo);
      const id_prestatario =
        prestamo && (prestamo.ID_PRESTATARIO || prestamo.id_prestatario);

      if (id_prestatario) {
        const mensaje = `El préstamo ${idPrestamo} ha sido refinanciado con un nuevo número de cuotas.`;
        await notificacionesService.crearNotificacion({
          id_prestatario,
          id_cuota: null,
          tipo: 'REFINANCIACION',
          mensaje,
        });
      }
    } catch (err) {
      // No bloquear la operación principal si la notificación falla.
      // eslint-disable-next-line no-console
      console.warn(
        'No se pudo registrar notificación de refinanciación:',
        err && err.message
      );
    }

    return result;
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
