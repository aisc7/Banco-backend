// Basic cedula duplication pre-check placeholder
const service = require('../services/prestatarios.service');

module.exports = async (req, res, next) => {
  try {
    const ci = Number(req.body?.ci || req.params?.ci);
    if (!ci) return res.status(400).json({ ok: false, error: 'ci requerido' });
    const { duplicada } = await service.validarCedula(ci);
    if (duplicada) return res.status(409).json({ ok: false, error: 'Cédula duplicada' });
    next();
  } catch (err) {
    return res.status(500).json({ ok: false, error: err.message });
  }
};
