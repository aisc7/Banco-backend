const service = require('../services/prestamos.service');

const inferTipoInteresFromCuotas = (nro_cuotas) => {
  const n = Number(nro_cuotas);
  if (!Number.isFinite(n)) return undefined;
  if (n <= 12) return 'BAJA';
  if (n <= 24) return 'MEDIA';
  return 'ALTA';
};

module.exports = {
  crear: async (req, res) => {
    try {
      const payload = { ...req.body };

      // Si el usuario autenticado es PRESTATARIO, asegurar que crea el préstamo a su id
      // e inferir automáticamente el tipo de interés según el número de cuotas.
      if (req.user && req.user.role === 'PRESTATARIO') {
        payload.id_prestatario = req.user.id_prestatario || req.user.ID_PRESTATARIO || req.user.id;
        payload.tipo_interes = inferTipoInteresFromCuotas(payload.nro_cuotas);
      }

      const result = await service.crear(payload);
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
      const { user } = req;
      const role = user?.role;
      const idPrestatarioToken = user?.id_prestatario || user?.ID_PRESTATARIO || null;
      const ciToken = user?.ci || user?.CI || null;

      let ci = Number(req.params.ci);

      // Si es PRESTATARIO, ignorar la cédula del path y usar la asociada al usuario
      if (role === 'PRESTATARIO') {
        if (ciToken) {
          ci = Number(ciToken);
        } else if (idPrestatarioToken) {
          const resultById = await service.obtenerPorPrestatarioPorId(idPrestatarioToken);
          return res.json({ ok: true, result: resultById });
        }
      }

      if (!ci || Number.isNaN(ci)) {
        return res.status(400).json({ ok: false, error: 'Cédula inválida' });
      }

      const result = await service.obtenerPorPrestatario(ci);
      return res.json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error GET /api/prestamos/prestatario/:ci', err);
      return res.status(500).json({
        ok: false,
        error: 'Error consultando préstamos del prestatario',
      });
    }
  },
  misPrestamos: async (req, res) => {
    try {
      const rawId = req.user && (req.user.id_prestatario ?? req.user.ID_PRESTATARIO);
      const idPrestatario = Number(rawId);

      if (!rawId || Number.isNaN(idPrestatario)) {
        // eslint-disable-next-line no-console
        console.error('[MIS-PRESTAMOS] id_prestatario inválido en token:', rawId);
        return res.status(400).json({
          ok: false,
          error: 'id_prestatario inválido en el token de autenticación',
        });
      }

      const result = await service.obtenerPorPrestatarioPorId(idPrestatario);
      return res.json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error('Error GET /api/prestamos/mis-prestamos', err);
      return res.status(500).json({ ok: false, error: 'Error consultando préstamos del prestatario' });
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
      const idPrestamo = Number(req.params.idPrestamo);
      const payload = { ...req.body };

      if ('estado' in payload && payload.estado != null) {
        const allowed = ['PENDIENTE', 'ACTIVO', 'CANCELADO', 'COMPLETADO'];
        const estado = String(payload.estado).toUpperCase();
        if (!allowed.includes(estado)) {
          return res.status(400).json({
            ok: false,
            error: `Estado inválido. Valores permitidos: ${allowed.join(', ')}`,
          });
        }
        payload.estado = estado;
      }

      const result = await service.actualizar(idPrestamo, payload);
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
