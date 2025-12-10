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
  listarPorPrestamo: async (req, res) => {
    try {
      const result = await service.listarPorPrestamo(Number(req.params.idPrestamo));
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  listarAll: async (_req, res) => {
    try {
      const result = await service.listarAll();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  // DEV-ONLY: marcar cuotas vencidas según fecha_vencimiento
  marcarVencidasDev: async (_req, res) => {
    try {
      if ((process.env.NODE_ENV || 'development') === 'production') {
        return res.status(403).json({ ok: false, error: 'No disponible en producción' });
      }
      const result = await service.marcarVencidasDev();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  // Estado moroso derivado: moroso si tiene >= 2 cuotas VENCIDA impagas
  estadoMorosoDerivado: async (req, res) => {
    try {
      const idPrestatario = Number(req.params.id);
      const { vencidasImpagas } = await service.contarVencidasImpagas(idPrestatario);
      const estado = vencidasImpagas >= 2 ? 'MOROSO' : 'ACTIVO';
      res.json({ ok: true, result: { id_prestatario: idPrestatario, vencidasImpagas, estado } });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
};
