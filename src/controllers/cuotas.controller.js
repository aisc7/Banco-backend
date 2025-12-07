const service = require('../services/cuotas.service');

module.exports = {
  registrarPago: async (req, res) => {
    try {
      const result = await service.registrarPago(Number(req.params.idCuota), req.body);
      res.status(201).json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  obtenerMorosidad: async (req, res) => {
    try {
      const result = await service.obtenerMorosidad(Number(req.params.id));
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  aplicarPenalizacion: async (req, res) => {
    try {
      const result = await service.aplicarPenalizacion(Number(req.params.id));
      res.status(201).json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  resumenCuotas: async (req, res) => {
    try {
      const result = await service.resumenCuotas(Number(req.params.id));
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  listarPendientes: async (_req, res) => {
    try {
      const result = await service.listarPendientes();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  listarMorosas: async (_req, res) => {
    try {
      const result = await service.listarMorosas();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
};
