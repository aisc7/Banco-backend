const model = require('../models/solicitudes.model');
const prestamosModel = require('../models/prestamos.model');
const { getConnection } = require('../config/oracle');
const oracledb = require('oracledb');
const {
  sendLoanApprovedEmail,
  sendLoanRejectedEmail,
} = require('./email.service');

async function obtenerDatosPrestatario(idPrestatario) {
  const conn = await getConnection();
  try {
    const q = `SELECT nombre, apellido, email
               FROM PRESTATARIOS
               WHERE id_prestatario = :id`;
    const r = await conn.execute(q, { id: Number(idPrestatario) }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
    return r.rows?.[0] || null;
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[SOLICITUDES] Error obteniendo datos de prestatario para correo:', err && err.message);
    return null;
  } finally {
    await conn.close();
  }
}

async function enviarCorreoAprobacion({ idPrestatario, idSolicitud, idPrestamo }) {
  try {
    const prestatario = await obtenerDatosPrestatario(idPrestatario);
    if (!prestatario) return;

    const prestamo = await prestamosModel.findById(idPrestamo);
    const solicitud = await model.obtenerPorId(idSolicitud);

    await sendLoanApprovedEmail({ prestatario, prestamo, solicitud });
  } catch (err) {
    // No romper la aprobación si falla el envío de correo.
    // eslint-disable-next-line no-console
    console.warn('[SOLICITUDES] Error al enviar correo de aprobación:', err && err.message);
  }
}

async function enviarCorreoRechazo({ idPrestatario, idSolicitud, motivo }) {
  try {
    const prestatario = await obtenerDatosPrestatario(idPrestatario);
    if (!prestatario) return;

    const solicitud = await model.obtenerPorId(idSolicitud);
    if (solicitud) {
      // Enriquecer la solicitud con el motivo para el template de correo
      solicitud.MOTIVO_RECHAZO = motivo ?? solicitud.MOTIVO_RECHAZO ?? solicitud.motivo_rechazo ?? null;
      await sendLoanRejectedEmail({ prestatario, solicitud });
    }
  } catch (err) {
    // eslint-disable-next-line no-console
    console.warn('[SOLICITUDES] Error al enviar correo de rechazo:', err && err.message);
  }
}

module.exports = {
  crear: async (data) => {
    // Crea la solicitud en tabla SOLICITUDES_PRESTAMO
    return model.crearSolicitud(data);
  },
  listarPorPrestatario: async (id_prestatario) => {
    return model.listarPorPrestatario(id_prestatario);
  },
  listar: async (filters) => {
    return model.listar(filters);
  },
  aprobar: async (idSolicitud, idEmpleadoDecisor) => {
    // Aprobar solicitud transaccionalmente y crear préstamo + cuotas atómicamente
    const s = await model.obtenerPorId(idSolicitud);
    if (!s) throw new Error('Solicitud no encontrada');
    if ((s.ESTADO || s.estado) !== 'PENDIENTE') throw new Error('Solo se puede aprobar solicitudes en estado PENDIENTE');

    const conn = await getConnection();
    try {
      // 1) Validar máximo 2 préstamos ACTIVO
      const idPrestatario = s.ID_PRESTATARIO || s.id_prestatario;
      const qActivos = `SELECT COUNT(1) AS cnt FROM PRESTAMOS WHERE ID_PRESTATARIO = :id AND ESTADO = 'ACTIVO'`;
      const rActivos = await conn.execute(qActivos, { id: idPrestatario }, { outFormat: require('oracledb').OUT_FORMAT_OBJECT });
      const activos = rActivos.rows?.[0]?.CNT ?? rActivos.rows?.[0]?.cnt ?? 0;
      if (activos >= 2) throw new Error('El prestatario ya tiene el máximo de 2 préstamos ACTIVO');

      // 2) Marcar solicitud como APROBADA dentro de la transacción
      await conn.execute(
        `UPDATE SOLICITUDES_PRESTAMOS
         SET estado = 'ACEPTADA',
             fecha_respuesta = SYSDATE,
             id_empleado_decisor = :id_empleado_decisor,
             fecha_decision = SYSDATE
         WHERE id_solicitud_prestamo = :id`,
        { id: idSolicitud, id_empleado_decisor: idEmpleadoDecisor ?? null },
        { autoCommit: false }
      );

      // 3) Crear préstamo y cuotas manualmente (sin paquete) para evitar duplicidad de solicitudes
      const payloadPrestamo = {
        id_solicitud_prestamo: idSolicitud,
        id_prestatario: idPrestatario,
        monto: s.MONTO || s.monto,
        nro_cuotas: s.NRO_CUOTAS || s.nro_cuotas,
        tipo_interes: s.TIPO_INTERES || s.tipo_interes || 'MEDIA',
      };
      const rPrestamo = await prestamosModel.createPrestamoManualTransactional(conn, payloadPrestamo);

      // 4) Generar cuotas
      await prestamosModel.generateCuotasTransactional(conn, {
        id_prestamo: rPrestamo.id_prestamo,
        id_prestatario: idPrestatario,
        total_prestado: rPrestamo.total_prestado,
        nro_cuotas: payloadPrestamo.nro_cuotas,
      });

      // 5) Commit
      await conn.commit();

      const result = {
        solicitud: {
          id_solicitud: idSolicitud,
          estado: 'ACEPTADA',
          id_empleado_decisor: idEmpleadoDecisor ?? null,
          fecha_decision: new Date(),
        },
        prestamo: { id_prestamo: rPrestamo.id_prestamo },
      };

      // Notificación por correo (no bloqueante para el flujo principal)
      enviarCorreoAprobacion({
        idPrestatario,
        idSolicitud,
        idPrestamo: rPrestamo.id_prestamo,
      });

      return result;
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      throw new Error(err.message || 'Error aprobando solicitud');
    } finally {
      await conn.close();
    }
  },
  rechazar: async (idSolicitud, motivo, idEmpleadoDecisor) => {
    const conn = await getConnection();
    try {
      const s = await model.obtenerPorId(idSolicitud);
      if (!s) throw new Error('Solicitud no encontrada');
      if ((s.ESTADO || s.estado) !== 'PENDIENTE') throw new Error('Solo se puede rechazar solicitudes en estado PENDIENTE');
      const idPrestatario = s.ID_PRESTATARIO || s.id_prestatario;
      await conn.execute(
        `UPDATE SOLICITUDES_PRESTAMOS
         SET estado = 'RECHAZADA',
             fecha_respuesta = SYSDATE,
             id_empleado_decisor = :id_empleado_decisor,
             fecha_decision = SYSDATE
         WHERE id_solicitud_prestamo = :id`,
        { id: idSolicitud, id_empleado_decisor: idEmpleadoDecisor ?? null },
        { autoCommit: false }
      );
      await conn.commit();
      const result = {
        solicitud: {
          id_solicitud: idSolicitud,
          estado: 'RECHAZADA',
          motivo: motivo || null,
          id_empleado_decisor: idEmpleadoDecisor ?? null,
          fecha_decision: new Date(),
        },
      };

      // Notificación por correo (no bloqueante)
      enviarCorreoRechazo({
        idPrestatario,
        idSolicitud,
        motivo: motivo || null,
      });

      return result;
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      throw new Error(err.message || 'Error rechazando solicitud');
    } finally {
      await conn.close();
    }
  },
};
