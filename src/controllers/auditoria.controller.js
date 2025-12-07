const service = require('../services/auditoria.service');

module.exports = {
  registrarAuditoria: async (req, res) => {
    try {
      const { usuario, ip, dominio, tabla, operacion, descripcion } = req.body;
      const result = await service.registrarAuditoria({ usuario, ip, dominio, tabla, operacion, descripcion });
      res.status(201).json({ ok: true, id_audit: result.id_audit });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
  finalizarSesion: async (req, res) => {
    try {
      const { id_audit } = req.body;
      const result = await service.finalizarSesion(id_audit);
      res.status(200).json({ ok: true, id_audit: result.id_audit });
    } catch (err) {
      res.status(400).json({ ok: false, error: err.message });
    }
  },
};
