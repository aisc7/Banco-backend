const service = require('../services/prestamos.service');

module.exports = {
  crear: async (req, res) => {
    try {
      // Si el usuario autenticado es PRESTATARIO, asegurar que crea el préstamo a su id
      if (req.user && req.user.role === 'PRESTATARIO') {
        req.body.id_prestatario = req.user.id_prestatario || req.user.ID_PRESTATARIO || req.user.id;
      }
      const result = await service.crear(req.body);
      res.status(201).json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  registrarRefinanciacion: async (req, res) => {
    try {
      const result = await service.registrarRefinanciacion(Number(req.params.idPrestamo), req.body);
      res.status(201).json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  obtenerPorPrestatario: async (req, res) => {
    try {
      const result = await service.obtenerPorPrestatario(Number(req.params.ci));
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  listar: async (_req, res) => {
    try {
      const result = await service.listar();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  obtenerPorId: async (req, res) => {
    try {
      const result = await service.obtenerPorId(Number(req.params.idPrestamo));
      if (!result) return res.status(404).json({ ok: false, error: 'Prestamo no encontrado' });
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  actualizar: async (req, res) => {
    try {
      const result = await service.actualizar(Number(req.params.idPrestamo), req.body);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  eliminar: async (req, res) => {
    try {
      const result = await service.eliminar(Number(req.params.idPrestamo));
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
};
