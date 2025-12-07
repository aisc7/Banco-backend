const service = require('../services/notificaciones.service');

module.exports = {
  listarPendientes: async (_req, res) => {
    try {
      const result = await service.listarPendientes();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
  enviarMasivas: async (req, res) => {
    try {
      const { tipo } = req.body; // 'PAGO' | 'MORA' | 'CANCELACION'
      const result = await service.enviarMasivas(tipo);
      res.status(202).json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
  recordatoriosPago: async (_req, res) => {
    try {
      const result = await service.recordatoriosPago();
      res.status(202).json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
  notificarMora: async (_req, res) => {
    try {
      const result = await service.notificarMora();
      res.status(202).json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
  notificarCancelacion: async (_req, res) => {
    try {
      const result = await service.notificarCancelacion();
      res.status(202).json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
  listarHistorico: async (_req, res) => {
    try {
      const result = await service.listarHistorico();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(500).json({ ok: false, error: err.message });
    }
  },
};
