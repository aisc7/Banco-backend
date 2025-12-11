const refinanciacionesModel = require('../models/refinanciaciones.model');
const prestamosModel = require('../models/prestamos.model');
const prestatariosModel = require('../models/prestatarios.model');
const {
  sendRefinancingEmail,
  sendRefinancingRejectedEmail,
} = require('../services/email.service');

module.exports = {
  crear: async (req, res) => {
    try {
      const rawIdPrestatario =
        req.user &&
        (req.user.id_prestatario ??
          req.user.ID_PRESTATARIO ??
          req.user.idPrestatario);
      const idPrestatario = Number(rawIdPrestatario);

      if (!rawIdPrestatario || Number.isNaN(idPrestatario)) {
        // eslint-disable-next-line no-console
        console.error(
          '[REFINANCIACIONES-CREAR] id_prestatario inválido en token:',
          rawIdPrestatario,
        );
        return res.status(400).json({
          ok: false,
          error: 'id_prestatario inválido en el token de autenticación',
        });
      }

      const { id_prestamo, nuevo_nro_cuotas } = req.body || {};
      const idPrestamo = Number(id_prestamo);
      const nroCuotas = Number(nuevo_nro_cuotas);

      if (!Number.isFinite(idPrestamo) || idPrestamo <= 0) {
        return res.status(400).json({
          ok: false,
          error: 'id_prestamo inválido',
        });
      }
      if (!Number.isInteger(nroCuotas) || nroCuotas <= 0) {
        return res.status(400).json({
          ok: false,
          error:
            'nuevo_nro_cuotas inválido: debe ser un entero positivo',
        });
      }

      // Verificar que el préstamo pertenece al prestatario y está ACTIVO
      const prestamo = await prestamosModel.findById(idPrestamo);
      if (!prestamo) {
        return res
          .status(404)
          .json({ ok: false, error: 'Préstamo no encontrado' });
      }
      const prestamoIdPrestatario =
        prestamo.ID_PRESTATARIO ?? prestamo.id_prestatario;
      const estadoPrestamo = prestamo.ESTADO || prestamo.estado;

      if (Number(prestamoIdPrestatario) !== idPrestatario) {
        return res.status(403).json({
          ok: false,
          error:
            'No puedes solicitar refinanciación sobre un préstamo que no te pertenece',
        });
      }

      if (estadoPrestamo !== 'ACTIVO') {
        return res.status(400).json({
          ok: false,
          error:
            'Solo se pueden solicitar refinanciaciones sobre préstamos activos',
        });
      }

      const result =
        await refinanciacionesModel.crearSolicitudRefinanciacion({
          id_prestamo: idPrestamo,
          id_prestatario: idPrestatario,
          nuevo_nro_cuotas: nroCuotas,
        });

      return res.status(201).json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        '[REFINANCIACIONES-CREAR] Error general:',
        err && err.message,
        err,
      );
      return res.status(500).json({
        ok: false,
        error:
          'Error interno al registrar la solicitud de refinanciación. Intenta nuevamente más tarde.',
      });
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
        console.error(
          '[REFINANCIACIONES-MIS] id_prestatario inválido en token:',
          rawId,
        );
        return res.status(400).json({
          ok: false,
          error: 'id_prestatario inválido en el token de autenticación',
        });
      }

      const result =
        await refinanciacionesModel.listarPorPrestatario(
          idPrestatario,
        );
      return res.json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        '[REFINANCIACIONES-MIS] Error general:',
        err && err.message,
        err,
      );
      return res.status(500).json({
        ok: false,
        error:
          'Error interno al obtener tus solicitudes de refinanciación. Intenta nuevamente más tarde.',
      });
    }
  },

  listar: async (req, res) => {
    try {
      const { estado, id_prestatario } = req.query || {};
      const filters = {};
      if (estado) {
        filters.estado = String(estado).toUpperCase();
      }
      if (id_prestatario) {
        filters.id_prestatario = Number(id_prestatario);
      }
      const result =
        await refinanciacionesModel.listarSolicitudes(filters);
      return res.json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        '[REFINANCIACIONES-LISTAR] Error general:',
        err && err.message,
        err,
      );
      return res.status(500).json({
        ok: false,
        error:
          'Error interno al listar solicitudes de refinanciación. Intenta nuevamente más tarde.',
      });
    }
  },

  aprobar: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res
          .status(400)
          .json({ ok: false, error: 'id de solicitud inválido' });
      }

      const result =
        await refinanciacionesModel.aprobarSolicitud({
          id_solicitud: id,
          id_empleado: null,
        });

      // Enviar correo al prestatario notificando la refinanciación
      try {
        const sol = result.solicitud;
        const prestamo = await prestamosModel.findById(
          sol.id_prestamo,
        );
        const prestatario = await prestatariosModel.getById(
          sol.id_prestatario,
        );
        await sendRefinancingEmail({
          prestatario,
          prestamo,
          refinanciacion: {
            ID_REFINANCIACION: sol.id_solicitud,
            NRO_CUOTAS_NUEVAS: sol.nro_cuotas,
          },
        });
      } catch (emailErr) {
        // eslint-disable-next-line no-console
        console.warn(
          '[EMAIL] Error enviando correo refinanciación aprobada:',
          emailErr && emailErr.message,
        );
      }

      return res.json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        '[REFINANCIACIONES-APROBAR] Error general:',
        err && err.message,
        err,
      );
      return res.status(400).json({
        ok: false,
        error:
          err.message ||
          'Error al aprobar la solicitud de refinanciación',
      });
    }
  },

  rechazar: async (req, res) => {
    try {
      const id = Number(req.params.id);
      if (!Number.isFinite(id) || id <= 0) {
        return res
          .status(400)
          .json({ ok: false, error: 'id de solicitud inválido' });
      }

      const result =
        await refinanciacionesModel.rechazarSolicitud({
          id_solicitud: id,
        });

      // Enviar correo al prestatario notificando el rechazo
      try {
        const sol = result.solicitud;
        const prestatario = await prestatariosModel.getById(
          sol.id_prestatario,
        );
        await sendRefinancingRejectedEmail({
          prestatario,
          solicitud: sol,
        });
      } catch (emailErr) {
        // eslint-disable-next-line no-console
        console.warn(
          '[EMAIL] Error enviando correo refinanciación rechazada:',
          emailErr && emailErr.message,
        );
      }

      return res.json({ ok: true, result });
    } catch (err) {
      // eslint-disable-next-line no-console
      console.error(
        '[REFINANCIACIONES-RECHAZAR] Error general:',
        err && err.message,
        err,
      );
      return res.status(400).json({
        ok: false,
        error:
          err.message ||
          'Error al rechazar la solicitud de refinanciación',
      });
    }
  },
};

