const model = require('../models/solicitudes.model');
const prestamosModel = require('../models/prestamos.model');
const { getConnection } = require('../config/oracle');

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
  aprobar: async (idSolicitud) => {
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
        `UPDATE SOLICITUDES_PRESTAMOS SET estado = 'ACEPTADA', fecha_respuesta = SYSDATE WHERE id_solicitud_prestamo = :id`,
        { id: idSolicitud },
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
      return { solicitud: { id_solicitud: idSolicitud, estado: 'ACEPTADA' }, prestamo: { id_prestamo: rPrestamo.id_prestamo } };
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      throw new Error(err.message || 'Error aprobando solicitud');
    } finally {
      await conn.close();
    }
  },
  rechazar: async (idSolicitud, motivo) => {
    const conn = await getConnection();
    try {
      const s = await model.obtenerPorId(idSolicitud);
      if (!s) throw new Error('Solicitud no encontrada');
      if ((s.ESTADO || s.estado) !== 'PENDIENTE') throw new Error('Solo se puede rechazar solicitudes en estado PENDIENTE');
      await conn.execute(
        `UPDATE SOLICITUDES_PRESTAMOS SET estado = 'RECHAZADA', fecha_respuesta = SYSDATE WHERE id_solicitud_prestamo = :id`,
        { id: idSolicitud },
        { autoCommit: false }
      );
      await conn.commit();
      return { solicitud: { id_solicitud: idSolicitud, estado: 'RECHAZADA', motivo: motivo || null } };
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      throw new Error(err.message || 'Error rechazando solicitud');
    } finally {
      await conn.close();
    }
  },
};
