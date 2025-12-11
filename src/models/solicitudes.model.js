const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

module.exports = {
  crearSolicitud: async (data) => {
    const conn = await getConnection();
    try {
      const { id_prestatario, monto, nro_cuotas, id_empleado } = data;
      // Coerción segura a tipos esperados
      const bind_id_prestatario = Number(id_prestatario);
      const bind_monto = Number(monto);
      const bind_nro_cuotas = Number(nro_cuotas);
      const seqName = process.env.SOLICITUDES_SEQ_NAME || null;
      let id;
      if (seqName) {
        // Usar secuencia indicada por entorno si está disponible
        const getIdSql = `SELECT ${seqName}.NEXTVAL AS ID FROM DUAL`;
        const rSeq = await conn.execute(getIdSql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false });
        const nextId = rSeq.rows?.[0]?.ID;
        if (!nextId) throw new Error(`No se pudo obtener NEXTVAL de la secuencia ${seqName}`);
        const sql = `INSERT INTO SOLICITUDES_PRESTAMOS (
            id_solicitud_prestamo, id_prestatario, id_empleado, nro_cuotas, monto, fecha_envio, estado
          ) VALUES (
            :id_solicitud, :id_prestatario, :id_empleado, :nro_cuotas, :monto, SYSDATE, 'PENDIENTE'
          )`;
        const binds = {
          id_solicitud: nextId,
          id_prestatario: bind_id_prestatario,
          id_empleado: id_empleado ?? null,
          monto: bind_monto,
          nro_cuotas: bind_nro_cuotas,
        };
        await conn.execute(sql, binds, { autoCommit: true });
        id = nextId;
      } else {
        // Intentar secuencia conocida del esquema: SOLICITUDES_PRESTAMOS_SEQ
        try {
          const getIdSql = `SELECT SOLICITUDES_PRESTAMOS_SEQ.NEXTVAL AS ID FROM DUAL`;
          const rSeq = await conn.execute(getIdSql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false });
          const nextId = rSeq.rows?.[0]?.ID;
          if (nextId) {
            const sql = `INSERT INTO SOLICITUDES_PRESTAMOS (
                id_solicitud_prestamo, id_prestatario, id_empleado, nro_cuotas, monto, fecha_envio, estado
              ) VALUES (
                :id_solicitud, :id_prestatario, :id_empleado, :nro_cuotas, :monto, SYSDATE, 'PENDIENTE'
              )`;
            const binds = {
              id_solicitud: nextId,
              id_prestatario: bind_id_prestatario,
              id_empleado: id_empleado ?? null,
              monto: bind_monto,
              nro_cuotas: bind_nro_cuotas,
            };
            await conn.execute(sql, binds, { autoCommit: true });
            id = nextId;
          } else {
            throw new Error('NEXTVAL de secuencia por defecto no disponible');
          }
        } catch (seqErr1) {
          // Intentar secuencia alternativa: SEQ_SOLICITUDES_PRESTAMOS
          try {
            const getIdSql2 = `SELECT SEQ_SOLICITUDES_PRESTAMOS.NEXTVAL AS ID FROM DUAL`;
            const rSeq2 = await conn.execute(getIdSql2, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false });
            const nextId2 = rSeq2.rows?.[0]?.ID;
            if (nextId2) {
              const sql2 = `INSERT INTO SOLICITUDES_PRESTAMOS (
                  id_solicitud_prestamo, id_prestatario, id_empleado, nro_cuotas, monto, fecha_envio, estado
                ) VALUES (
                  :id_solicitud, :id_prestatario, :id_empleado, :nro_cuotas, :monto, SYSDATE, 'PENDIENTE'
                )`;
              const binds2 = {
                id_solicitud: nextId2,
                id_prestatario: bind_id_prestatario,
                id_empleado: id_empleado ?? null,
                monto: bind_monto,
                nro_cuotas: bind_nro_cuotas,
              };
              await conn.execute(sql2, binds2, { autoCommit: true });
              id = nextId2;
            } else {
              throw new Error('NEXTVAL de secuencia alternativa no disponible');
            }
          } catch (seqErr2) {
            // Sin secuencias: confiar en trigger y RETURNING
            const sql = `INSERT INTO SOLICITUDES_PRESTAMOS (
                id_prestatario, id_empleado, nro_cuotas, monto, fecha_envio, estado
              ) VALUES (
                :id_prestatario, :id_empleado, :nro_cuotas, :monto, SYSDATE, 'PENDIENTE'
              ) RETURNING id_solicitud_prestamo INTO :id_out`;
            const binds = {
              id_prestatario: bind_id_prestatario,
              id_empleado: id_empleado ?? null,
              monto: bind_monto,
              nro_cuotas: bind_nro_cuotas,
              id_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
            };
            const r = await conn.execute(sql, binds, { autoCommit: true });
            id = r.outBinds.id_out[0];
          }
        }
      }
      return { id_solicitud_prestamo: id, estado: 'PENDIENTE' };
    } catch (err) {
      throw new Error(err.message || 'Error creando solicitud');
    } finally {
      await conn.close();
    }
  },
  listarPorPrestatario: async (id_prestatario) => {
    const conn = await getConnection();
    try {
      const id = Number(id_prestatario);
      if (!Number.isFinite(id)) {
        throw new Error('id_prestatario inválido');
      }
      const q = `SELECT s.id_solicitud_prestamo,
                        s.id_prestatario,
                        s.id_empleado,
                        s.nro_cuotas,
                        s.monto,
                        s.fecha_envio,
                        s.fecha_respuesta,
                        s.estado,
                        s.id_empleado AS id_empleado_decisor,
                        e.nombre AS empleado_decisor_nombre,
                        e.apellido AS empleado_decisor_apellido
                 FROM SOLICITUDES_PRESTAMOS s
                 LEFT JOIN EMPLEADOS e ON e.id_empleado = s.id_empleado
                 WHERE s.id_prestatario = :id
                 ORDER BY s.id_solicitud_prestamo DESC`;
      const r = await conn.execute(q, { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error listando solicitudes');
    } finally {
      await conn.close();
    }
  },
  obtenerPorId: async (id) => {
    const conn = await getConnection();
    try {
      const q = `SELECT id_solicitud_prestamo,
                        id_prestatario,
                        id_empleado,
                        nro_cuotas,
                        monto,
                        fecha_envio,
                        fecha_respuesta,
                        estado
                 FROM SOLICITUDES_PRESTAMOS
                 WHERE id_solicitud_prestamo = :id`;
      const r = await conn.execute(q, { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows?.[0] || null;
    } catch (err) {
      throw new Error(err.message || 'Error obteniendo solicitud');
    } finally {
      await conn.close();
    }
  },
  listar: async (filters = {}) => {
    const conn = await getConnection();
    try {
      const clauses = [];
      const binds = {};
      if (filters.estado) {
        clauses.push('estado = :estado');
        binds.estado = filters.estado;
      }
      if (filters.id_prestatario) {
        clauses.push('id_prestatario = :id_prestatario');
        binds.id_prestatario = Number(filters.id_prestatario);
      }
      const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';
      const q = `SELECT s.id_solicitud_prestamo,
                        s.id_prestatario,
                        s.id_empleado,
                        s.nro_cuotas,
                        s.monto,
                        s.fecha_envio,
                        s.fecha_respuesta,
                        s.estado,
                        s.id_empleado AS id_empleado_decisor,
                        e.nombre AS empleado_decisor_nombre,
                        e.apellido AS empleado_decisor_apellido
                 FROM SOLICITUDES_PRESTAMOS s
                 LEFT JOIN EMPLEADOS e ON e.id_empleado = s.id_empleado
                 ${where}
                 ORDER BY s.id_solicitud_prestamo DESC`;
      const r = await conn.execute(q, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error listando solicitudes');
    } finally {
      await conn.close();
    }
  },
  /**
   * Actualiza el estado de una solicitud y registra el empleado que toma la decisión.
   * Este helper puede ser reutilizado desde flujos de aprobación/rechazo si se requiere
   * un camino simplificado fuera de la lógica transaccional de préstamos.
   */
  actualizarEstado: async (id, estado, motivo, id_empleado) => {
    const conn = await getConnection();
    try {
      const sql = `UPDATE SOLICITUDES_PRESTAMOS
                   SET estado = :estado,
                       fecha_respuesta = SYSDATE,
                       id_empleado = :id_empleado
                   WHERE id_solicitud_prestamo = :id`;
      const r = await conn.execute(
        sql,
        {
          id,
          estado,
          motivo: motivo || null,
          id_empleado: id_empleado ?? null,
        },
        { autoCommit: true }
      );
      if (r.rowsAffected === 0) throw new Error('Solicitud no encontrada');
      return { id_solicitud_prestamo: id, estado };
    } catch (err) {
      throw new Error(err.message || 'Error actualizando solicitud');
    } finally {
      await conn.close();
    }
  },
};
