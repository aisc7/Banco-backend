const service = require('../services/prestatarios.service');

module.exports = {
  registrar: async (req, res) => {
    try {
      const result = await service.registrar(req.body);
      res.status(201).json({ ok: true, result });
    } catch (err) {
      if (err.code === 'DUP_CI') {
        return res.status(409).json({ ok: false, error: 'La cédula ya está registrada' });
      }
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  modificar: async (req, res) => {
    try {
      const result = await service.modificar(req.params.ci, req.body);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  eliminar: async (req, res) => {
    try {
      const result = await service.eliminar(req.params.ci);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  subirFoto: async (req, res) => {
    try {
      // Soportar multipart/form-data (req.file) y JSON base64 (req.body.foto_base64)
      let fileArg = req.file;
      if (!fileArg && req.body && req.body.foto_base64) {
        try {
          const base64 = String(req.body.foto_base64).replace(/^data:[^;]+;base64,/, '');
          const buffer = Buffer.from(base64, 'base64');
          fileArg = { buffer };
        } catch (e) {
          return res.status(400).json({ ok: false, error: 'Base64 inválido' });
        }
      }

      const result = await service.subirFoto(req.params.ci, fileArg);
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  validarCedula: async (req, res) => {
    try {
      const result = await service.validarCedula(Number(req.params.ci));
      res.json({ duplicada: result.duplicada });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  cargaMasiva: async (req, res) => {
    try {
      // Soporta JSON con content y multipart/form-data con archivo (campo `archivo`).
      // Se añaden logs detallados para facilitar el diagnóstico de errores en la carga.
      // eslint-disable-next-line no-console
      console.log('=== [CARGA-MASIVA] INICIO ===');
      // eslint-disable-next-line no-console
      console.log('[CARGA-MASIVA] Content-Type:', req.headers['content-type']);

      let content = null;
      let nombreArchivo = null;
      const usuario =
        (req.user && (req.user.username || req.user.USERNAME)) || 'desconocido';

      if (req.is('multipart/form-data')) {
        // eslint-disable-next-line no-console
        console.log('[CARGA-MASIVA] Modo multipart/form-data');
        const file = req.file;
        if (!file || !file.buffer) {
          // eslint-disable-next-line no-console
          console.warn("[CARGA-MASIVA] No se encontró campo 'archivo' en la petición");
          return res.status(400).json({
            ok: false,
            error:
              "No se encontró el archivo en la petición (campo esperado: 'archivo').",
          });
        }
        nombreArchivo = file.originalname || 'carga.csv';
        content = file.buffer.toString('utf8');
      } else {
        // eslint-disable-next-line no-console
        console.log('[CARGA-MASIVA] Modo JSON');
        content = req.body && req.body.content;
        nombreArchivo =
          (req.body && req.body.nombre_archivo) || 'carga_desde_json.txt';

        if (!content || typeof content !== 'string') {
          // eslint-disable-next-line no-console
          console.warn('[CARGA-MASIVA] Body.content vacío o no es string');
          return res.status(400).json({
            ok: false,
            error:
              "El cuerpo de la petición debe incluir el campo 'content' con el archivo en texto.",
          });
        }
      }

      // eslint-disable-next-line no-console
      console.log('[CARGA-MASIVA] usuario:', usuario);
      // eslint-disable-next-line no-console
      console.log(
        '[CARGA-MASIVA] nombreArchivo:',
        nombreArchivo,
        'tamaño content:',
        content ? content.length : 0
      );

      const result = await service.cargaMasiva({
        content,
        usuario,
        nombre_archivo: nombreArchivo,
      });

      // eslint-disable-next-line no-console
      console.log('[CARGA-MASIVA] Resultado resumen:', {
        total: result.total,
        aceptados: result.aceptados,
        rechazados: result.rechazados,
      });

      res.status(202).json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        '[CARGA-MASIVA] Error inesperado:',
        err && err.message,
        err && err.stack
      );

      const msg = err && err.message ? String(err.message) : 'Error desconocido';
      // Error de validación de contenido vacío/mal formado → 400
      if (msg.includes('Contenido CSV/TXT requerido')) {
        return res.status(400).json({ ok: false, error: msg });
      }

      return res.status(500).json({
        ok: false,
        // Mensaje amigable para el cliente; los detalles técnicos quedan en logs y, en dev, en `detail`.
        error:
          'Ocurrió un error al procesar la carga masiva. Verifica que el archivo cumpla el formato requerido (columnas obligatorias, cédula y teléfono válidos) e inténtalo de nuevo.',
        detail: process.env.NODE_ENV !== 'production' ? msg : undefined,
      });
    }
  },
  obtenerLogsCarga: async (req, res) => {
    try {
      const result = await service.obtenerLogsCarga();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  obtenerPorCedula: async (req, res) => {
    try {
      const result = await service.obtenerPorCedula(Number(req.params.ci));
      res.json({ ok: true, result });
    } catch (err) {
      res.status(404).json({ ok: false, error: err.message });
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
  listarMorosos: async (_req, res) => {
    try {
      const result = await service.listarMorosos();
      res.json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  /**
   * Devuelve los datos del prestatario asociado al usuario autenticado.
   * Usa id_prestatario del token JWT.
   */
  getMe: async (req, res) => {
    try {
      const rawId = req.user && (req.user.id_prestatario ?? req.user.ID_PRESTATARIO);
      const idPrestatario = Number(rawId);
      if (!rawId || Number.isNaN(idPrestatario)) {
        return res.status(400).json({
          ok: false,
          error: 'id_prestatario inválido en el token de autenticación',
        });
      }
      const result = await service.obtenerPorId(idPrestatario);
      return res.json({ ok: true, result });
    } catch (err) {
      return res.status(400).json({ ok: false, error: err.message });
    }
  },
};
