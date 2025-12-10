const service = require('../services/solicitudes.service');

module.exports = {
  crear: async (req, res) => {
    try {
      const payload = { ...req.body };
      if (req.user && req.user.role === 'PRESTATARIO') {
        payload.id_prestatario = req.user.id_prestatario || req.user.ID_PRESTATARIO;
      }
      // Validaciones de entrada claras para evitar errores 400 genéricos
      const monto = Number(payload.monto);
      const nro_cuotas = Number(payload.nro_cuotas);
      if (!Number.isFinite(monto) || monto <= 0) {
        return res.status(400).json({ ok: false, error: 'Monto inválido: debe ser un número positivo' });
      }
      if (!Number.isInteger(nro_cuotas) || nro_cuotas <= 0) {
        return res.status(400).json({ ok: false, error: 'Número de cuotas inválido: debe ser un entero positivo' });
      }
      // Si el rol es EMPLEADO, id_prestatario debe venir en el body
      if (req.user && req.user.role === 'EMPLEADO' && !payload.id_prestatario) {
        return res.status(400).json({ ok: false, error: 'id_prestatario es requerido cuando crea solicitud un EMPLEADO' });
      }
      // Normalizar valores
      payload.monto = monto;
      payload.nro_cuotas = nro_cuotas;
      const result = await service.crear(payload);
      res.status(201).json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  misSolicitudes: async (req, res) => {
    try {
      const idPrestatario = req.user?.id_prestatario || req.user?.ID_PRESTATARIO || null;
      if (!idPrestatario) return res.status(403).json({ ok: false, error: 'Cuenta no vinculada a prestatario' });
      const result = await service.listarPorPrestatario(idPrestatario);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  listar: async (req, res) => {
    try {
      const { estado, id_prestatario } = req.query;
      const filters = {};
      if (estado) filters.estado = String(estado).toUpperCase();
      if (id_prestatario) filters.id_prestatario = Number(id_prestatario);
      const result = await service.listar(filters);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  aprobar: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const result = await service.aprobar(id);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  rechazar: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const motivo = req.body?.motivo || null;
      const result = await service.rechazar(id, motivo);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
};
