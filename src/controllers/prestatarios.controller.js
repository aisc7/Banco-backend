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
      // Soporta JSON con content y multipart/form-data con archivo
      const payload = { ...req.body };
      if (req.file && req.file.buffer) {
        payload.content = req.file.buffer.toString('utf8');
        payload.nombre_archivo = req.file.originalname || 'carga.csv';
      }
      const result = await service.cargaMasiva(payload);
      res.status(202).json({ ok: true, result });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
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
};
