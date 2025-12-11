const service = require('../services/reportes.service');

module.exports = {
  consolidado: async (req, res) => {
    try {
      // eslint-disable-next-line no-console
      console.log('=== [REPORTES] GET /api/reportes/prestamos ===');
      // eslint-disable-next-line no-console
      console.log(
        '[REPORTES] usuario:',
        req.user && (req.user.username || req.user.USERNAME),
        'rol:',
        req.user && req.user.role
      );

      const result = await service.consolidado();

      // eslint-disable-next-line no-console
      console.log('[REPORTES] filas obtenidas en resumen de préstamos:', (result || []).length);

      res.json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        '[REPORTES] Error en resumenPrestamos:',
        err && err.message,
        err && err.stack
      );
      const msg = err && err.message ? String(err.message) : 'Error obteniendo resumen de préstamos';
      res.status(500).json({
        ok: false,
        error: 'Error al obtener el resumen de préstamos.',
        detail: process.env.NODE_ENV !== 'production' ? msg : undefined,
      });
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
