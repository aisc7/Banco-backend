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
      const rawId =
        req.user &&
        (req.user.id_prestatario ??
          req.user.ID_PRESTATARIO ??
          req.user.idPrestatario);
      const idPrestatario = Number(rawId);

      if (!rawId || Number.isNaN(idPrestatario)) {
        // eslint-disable-next-line no-console
        console.error('[MIS-SOLICITUDES] id_prestatario inválido en token:', rawId);
        return res.status(400).json({
          ok: false,
          error: 'id_prestatario inválido en el token de autenticación',
        });
      }

      const result = await service.listarPorPrestatario(idPrestatario);
      return res.json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('[MIS-SOLICITUDES] Error general:', err);
      return res.status(500).json({
        ok: false,
        error: 'Error interno al obtener tus solicitudes. Intenta nuevamente más tarde.',
      });
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
      const rawEmpleadoId = req.user && (req.user.id_empleado ?? req.user.ID_EMPLEADO);
      const idEmpleadoDecisor = Number(rawEmpleadoId);

      if (!rawEmpleadoId || Number.isNaN(idEmpleadoDecisor)) {
        // eslint-disable-next-line no-console
        console.error('[SOLICITUDES-APROBAR] id_empleado inválido en token:', rawEmpleadoId);
        return res.status(400).json({
          ok: false,
          error: 'id_empleado inválido en el token de autenticación',
        });
      }

      // eslint-disable-next-line no-console
      console.log('[SOLICITUDES-APROBAR] id_empleado_decisor:', idEmpleadoDecisor);

      const result = await service.aprobar(id, idEmpleadoDecisor);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  rechazar: async (req, res) => {
    try {
      const id = Number(req.params.id);
      const motivo = req.body?.motivo || null;
      const rawEmpleadoId = req.user && (req.user.id_empleado ?? req.user.ID_EMPLEADO);
      const idEmpleadoDecisor = Number(rawEmpleadoId);

      if (!rawEmpleadoId || Number.isNaN(idEmpleadoDecisor)) {
        // eslint-disable-next-line no-console
        console.error('[SOLICITUDES-RECHAZAR] id_empleado inválido en token:', rawEmpleadoId);
        return res.status(400).json({
          ok: false,
          error: 'id_empleado inválido en el token de autenticación',
        });
      }

      // eslint-disable-next-line no-console
      console.log('[SOLICITUDES-RECHAZAR] id_empleado_decisor:', idEmpleadoDecisor);

      const result = await service.rechazar(id, motivo, idEmpleadoDecisor);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
};
