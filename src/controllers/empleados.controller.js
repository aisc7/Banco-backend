/**
 * Controlador REST para EMPLEADOS.
 * Respuestas normalizadas: { success: true/false, data, message }
 */
const service = require('../services/empleados.service');

module.exports = {
  crear: async (req, res) => {
    try {
      const { nombre, apellido } = req.body;
      if (!nombre || !apellido) return res.status(400).json({ success: false, data: null, message: 'Campos requeridos: nombre, apellido' });
      const result = await service.createEmpleado(req.body);
      res.status(201).json({ success: true, data: result, message: 'Empleado creado' });
    } catch (err) {
      res.status(500).json({ success: false, data: null, message: err.message });
    }
  },

  listar: async (_req, res) => {
    try {
      const result = await service.listAll();
      res.json({ success: true, data: result, message: null });
    } catch (err) {
      res.status(500).json({ success: false, data: null, message: err.message });
    }
  },

  obtenerPorId: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const result = await service.getById(id);
      if (!result) return res.status(404).json({ success: false, data: null, message: 'Empleado no encontrado' });
      res.json({ success: true, data: result, message: null });
    } catch (err) {
      res.status(500).json({ success: false, data: null, message: err.message });
    }
  },

  actualizar: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const { nombre, apellido } = req.body;
      // validar al menos los requeridos si vienen vacíos explícitamente
      if (('nombre' in req.body && !nombre) || ('apellido' in req.body && !apellido)) {
        return res.status(400).json({ success: false, data: null, message: 'nombre/apellido no pueden estar vacíos' });
      }
      const result = await service.updateEmpleado(id, req.body);
      res.json({ success: true, data: result, message: 'Empleado actualizado' });
    } catch (err) {
      if (err.message && err.message.includes('Empleado no encontrado')) {
        return res.status(404).json({ success: false, data: null, message: err.message });
      }
      res.status(500).json({ success: false, data: null, message: err.message });
    }
  },

  eliminar: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const result = await service.deleteEmpleado(id);
      res.json({ success: true, data: result, message: 'Empleado eliminado' });
    } catch (err) {
      if (err.message && err.message.includes('Empleado no encontrado')) {
        return res.status(404).json({ success: false, data: null, message: err.message });
      }
      res.status(500).json({ success: false, data: null, message: err.message });
    }
  },
};
