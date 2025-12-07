const service = require('../services/reportes.service');

module.exports = {
  consolidado: async (_req, res) => {
    try {
      const result = await service.consolidado();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  morosos: async (_req, res) => {
    try {
      const result = await service.morosos();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  dataCredito: async (_req, res) => {
    try {
      const result = await service.dataCredito();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  refinanciaciones: async (_req, res) => {
    try {
      const result = await service.refinanciaciones();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
};
