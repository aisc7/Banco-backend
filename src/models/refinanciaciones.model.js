const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');
const prestamosModel = require('./prestamos.model');

/**
 * Modelo de acceso a datos para SOLICITUDES_REFINANCIACION.
 *  - crearSolicitudRefinanciacion: registra la solicitud en estado PENDIENTE.
 *  - listarSolicitudes / listarPorPrestatario: consulta con filtros.
 *  - aprobarSolicitud: recalcula cuotas del préstamo y marca la solicitud como APROBADA.
 *  - rechazarSolicitud: marca la solicitud como RECHAZADA (sin tocar el préstamo).
 */
async function crearSolicitudRefinanciacion({
  id_prestamo,
  id_prestatario,
  nuevo_nro_cuotas,
}) {
  const conn = await getConnection();
  try {
    const idPrestamo = Number(id_prestamo);
    const idPrestatario = Number(id_prestatario);
    const nroCuotas = Number(nuevo_nro_cuotas);

    if (!Number.isFinite(idPrestamo) || idPrestamo <= 0) {
      throw new Error('id_prestamo inválido');
    }
    if (!Number.isFinite(idPrestatario) || idPrestatario <= 0) {
      throw new Error('id_prestatario inválido');
    }
    if (!Number.isInteger(nroCuotas) || nroCuotas <= 0) {
      throw new Error('nuevo_nro_cuotas inválido: debe ser un entero positivo');
    }

    // Verificar que el préstamo exista y esté ACTIVO
    const qPrestamo = `
      SELECT id_prestamo,
             id_prestatario,
             total_prestado,
             nro_cuotas,
             interes,
             fecha_emision,
             fecha_vencimiento,
             estado
      FROM PRESTAMOS
      WHERE id_prestamo = :id_prestamo`;
    const rPrestamo = await conn.execute(
      qPrestamo,
      { id_prestamo: idPrestamo },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    const prestamo = rPrestamo.rows?.[0];
    if (!prestamo) {
      throw new Error('Préstamo no encontrado para refinanciación');
    }
    const estadoPrestamo = prestamo.ESTADO || prestamo.estado;
    if (estadoPrestamo !== 'ACTIVO') {
      throw new Error('Solo se pueden refinanciar préstamos en estado ACTIVO');
    }

    // Insertar solicitud en estado PENDIENTE usando secuencia o trigger.
    let idSolicitud = null;

    try {
      // 1) Intentar con secuencia explícita
      const seqSql =
        'SELECT SOLICITUDES_REFINANCIACION_SEQ.NEXTVAL AS ID FROM DUAL';
      const rSeq = await conn.execute(
        seqSql,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
      );
      const nextId = rSeq.rows?.[0]?.ID;
      if (!nextId) {
        throw new Error(
          'NEXTVAL de secuencia SOLICITUDES_REFINANCIACION_SEQ no disponible'
        );
      }

      const insertSql = `
        INSERT INTO SOLICITUDES_REFINANCIACION (
          id_solicitud_refinanciacion,
          id_prestatario,
          id_prestamo,
          nro_cuotas,
          fecha_realizacion,
          estado
        ) VALUES (
          :id_solicitud,
          :id_prestatario,
          :id_prestamo,
          :nro_cuotas,
          SYSDATE,
          'PENDIENTE'
        )`;
      await conn.execute(
        insertSql,
        {
          id_solicitud: nextId,
          id_prestatario: idPrestatario,
          id_prestamo: idPrestamo,
          nro_cuotas: nroCuotas,
        },
        { autoCommit: true }
      );
      idSolicitud = nextId;
    } catch (seqErr) {
      // 2) Si no hay secuencia, confiar en trigger + RETURNING
      const insertSql = `
        INSERT INTO SOLICITUDES_REFINANCIACION (
          id_prestatario,
          id_prestamo,
          nro_cuotas,
          fecha_realizacion,
          estado
        ) VALUES (
          :id_prestatario,
          :id_prestamo,
          :nro_cuotas,
          SYSDATE,
          'PENDIENTE'
        )
        RETURNING id_solicitud_refinanciacion INTO :id_out`;
      const rIns = await conn.execute(
        insertSql,
        {
          id_prestatario: idPrestatario,
          id_prestamo: idPrestamo,
          nro_cuotas: nroCuotas,
          id_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: true }
      );
      idSolicitud = rIns.outBinds.id_out[0];
    }

    return {
      id_solicitud_refinanciacion: idSolicitud,
      estado: 'PENDIENTE',
    };
  } catch (err) {
    throw new Error(
      err.message || 'Error creando solicitud de refinanciación'
    );
  } finally {
    await conn.close();
  }
}

async function listarSolicitudes(filters = {}) {
  const conn = await getConnection();
  try {
    const clauses = [];
    const binds = {};

    if (filters.estado) {
      clauses.push('r.estado = :estado');
      binds.estado = String(filters.estado).toUpperCase();
    }
    if (filters.id_prestatario) {
      const id = Number(filters.id_prestatario);
      if (Number.isFinite(id)) {
        clauses.push('r.id_prestatario = :id_prestatario');
        binds.id_prestatario = id;
      }
    }

    const where = clauses.length ? `WHERE ${clauses.join(' AND ')}` : '';

    const sql = `
      SELECT
        r.id_solicitud_refinanciacion,
        r.id_prestatario,
        r.id_prestamo,
        r.nro_cuotas,
        r.fecha_realizacion,
        r.estado,
        p.id_prestatario   AS PREST_ID,
        p.ci               AS PREST_CI,
        p.nombre           AS PREST_NOMBRE,
        p.apellido         AS PREST_APELLIDO
      FROM SOLICITUDES_REFINANCIACION r
      /* LEFT JOIN para NO perder solicitudes aunque la FK esté rara */
      LEFT JOIN PRESTATARIOS p
        ON (
          p.id_prestatario = r.id_prestatario
          OR p.ci = r.id_prestatario
        )
      ${where}
      ORDER BY r.id_solicitud_refinanciacion DESC`;

    const r = await conn.execute(sql, binds, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });

    // Debug útil mientras probamos
    // eslint-disable-next-line no-console
    console.log(
      '[REFINANCIACIONES] listarSolicitudes filters=',
      filters,
      'rows=',
      r.rows?.length || 0
    );

    return r.rows || [];
  } catch (err) {
    throw new Error(
      err.message || 'Error listando solicitudes de refinanciación'
    );
  } finally {
    await conn.close();
  }
}

async function listarPorPrestatario(id_prestatario) {
  const id = Number(id_prestatario);
  if (!Number.isFinite(id)) {
    throw new Error('id_prestatario inválido');
  }
  return listarSolicitudes({ id_prestatario: id });
}

async function obtenerPorId(id_solicitud) {
  const conn = await getConnection();
  try {
    const id = Number(id_solicitud);
    if (!Number.isFinite(id)) {
      throw new Error('id_solicitud inválido');
    }
    const sql = `
      SELECT
        r.id_solicitud_refinanciacion,
        r.id_prestatario,
        r.id_prestamo,
        r.nro_cuotas,
        r.fecha_realizacion,
        r.estado
      FROM SOLICITUDES_REFINANCIACION r
      WHERE r.id_solicitud_refinanciacion = :id`;
    const r = await conn.execute(sql, { id }, {
      outFormat: oracledb.OUT_FORMAT_OBJECT,
    });
    return r.rows?.[0] || null;
  } catch (err) {
    throw new Error(
      err.message || 'Error obteniendo solicitud de refinanciación'
    );
  } finally {
    await conn.close();
  }
}

/**
 * Aprueba una solicitud de refinanciación:
 *  - Verifica que exista y esté PENDIENTE.
 *  - Verifica que el préstamo asociado esté ACTIVO.
 *  - Elimina las cuotas actuales del préstamo y genera nuevas cuotas.
 *  - Actualiza el número de cuotas del préstamo (dejando el estado tal cual, p.ej. ACTIVO).
 *  - Marca la solicitud como APROBADA.
 */
async function aprobarSolicitud({ id_solicitud, id_empleado }) {
  const conn = await getConnection();
  try {
    const idSolicitud = Number(id_solicitud);
    if (!Number.isFinite(idSolicitud)) {
      throw new Error('id_solicitud inválido');
    }

    // Cargar solicitud (FOR UPDATE)
    const rSol = await conn.execute(
      `SELECT id_solicitud_refinanciacion,
              id_prestatario,
              id_prestamo,
              nro_cuotas,
              fecha_realizacion,
              estado
       FROM SOLICITUDES_REFINANCIACION
       WHERE id_solicitud_refinanciacion = :id
       FOR UPDATE`,
      { id: idSolicitud },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
    );
    const sol = rSol.rows?.[0];
    if (!sol) {
      throw new Error('Solicitud de refinanciación no encontrada');
    }
    const estadoSol = sol.ESTADO || sol.estado;
    if (estadoSol !== 'PENDIENTE') {
      throw new Error('Solo se pueden aprobar solicitudes en estado PENDIENTE');
    }

    const idPrestamo = Number(sol.ID_PRESTAMO ?? sol.id_prestamo);
    const idPrestatario = Number(sol.ID_PRESTATARIO ?? sol.id_prestatario);
    const nuevoNroCuotas = Number(sol.NRO_CUOTAS ?? sol.nro_cuotas);

    if (!Number.isFinite(idPrestamo) || !Number.isFinite(idPrestatario)) {
      throw new Error(
        'Datos de préstamo o prestatario inválidos en la solicitud'
      );
    }

    // Cargar préstamo (FOR UPDATE)
    const rPrestamo = await conn.execute(
      `SELECT id_prestamo,
              id_prestatario,
              total_prestado,
              nro_cuotas,
              interes,
              fecha_emision,
              fecha_vencimiento,
              estado
       FROM PRESTAMOS
       WHERE id_prestamo = :id_prestamo
       FOR UPDATE`,
      { id_prestamo: idPrestamo },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
    );
    const prestamo = rPrestamo.rows?.[0];
    if (!prestamo) {
      throw new Error('Préstamo asociado a la solicitud no encontrado');
    }
    const estadoPrestamo = prestamo.ESTADO || prestamo.estado;
    if (estadoPrestamo !== 'ACTIVO') {
      throw new Error('Solo se pueden refinanciar préstamos en estado ACTIVO');
    }

    const totalPrestado =
      prestamo.TOTAL_PRESTADO ?? prestamo.total_prestado ?? null;
    if (!Number.isFinite(Number(totalPrestado))) {
      throw new Error('total_prestado inválido en el préstamo asociado');
    }

    // 1) Borrar cuotas actuales
    await conn.execute(
      `DELETE FROM CUOTAS WHERE id_prestamo = :id_prestamo`,
      { id_prestamo: idPrestamo },
      { autoCommit: false }
    );

    // 2) Generar nuevas cuotas usando lógica existente
    await prestamosModel.generateCuotasTransactional(conn, {
      id_prestamo: idPrestamo,
      id_prestatario: idPrestatario,
      total_prestado: Number(totalPrestado),
      nro_cuotas: nuevoNroCuotas,
    });

    // 3) Actualizar préstamo: SOLO número de cuotas, NO tocamos estado
    await conn.execute(
      `UPDATE PRESTAMOS
       SET nro_cuotas = :nro_cuotas
       WHERE id_prestamo = :id_prestamo`,
      {
        nro_cuotas: nuevoNroCuotas,
        id_prestamo: idPrestamo,
      },
      { autoCommit: false }
    );

    // 4) Marcar solicitud como APROBADA
    await conn.execute(
      `UPDATE SOLICITUDES_REFINANCIACION
       SET estado = 'APROBADA'
       WHERE id_solicitud_refinanciacion = :id`,
      { id: idSolicitud },
      { autoCommit: false }
    );

    await conn.commit();

    return {
      solicitud: {
        id_solicitud: idSolicitud,
        id_prestamo: idPrestamo,
        id_prestatario: idPrestatario,
        nro_cuotas: nuevoNroCuotas,
        estado: 'APROBADA',
      },
      prestamo: {
        id_prestamo: prestamo.ID_PRESTAMO ?? prestamo.id_prestamo,
        id_prestatario: prestamo.ID_PRESTATARIO ?? prestamo.id_prestatario,
        total_prestado: totalPrestado,
        nro_cuotas: nuevoNroCuotas,
        interes: prestamo.INTERES ?? prestamo.interes ?? null,
        fecha_emision: prestamo.FECHA_EMISION ?? prestamo.fecha_emision,
        fecha_vencimiento:
          prestamo.FECHA_VENCIMIENTO ?? prestamo.fecha_vencimiento,
        // OJO: dejamos el estado tal cual estaba en la BD (ACTIVO),
        // no lo cambiamos a REFINANCIADO para no violar el CHECK.
        estado: estadoPrestamo,
      },
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // noop
    }
    throw new Error(
      err.message || 'Error aprobando solicitud de refinanciación'
    );
  } finally {
    await conn.close();
  }
}

/**
 * Rechaza una solicitud de refinanciación sin tocar el préstamo ni sus cuotas.
 */
async function rechazarSolicitud({ id_solicitud }) {
  const conn = await getConnection();
  try {
    const idSolicitud = Number(id_solicitud);
    if (!Number.isFinite(idSolicitud)) {
      throw new Error('id_solicitud inválido');
    }

    const rSol = await conn.execute(
      `SELECT id_solicitud_refinanciacion,
              id_prestatario,
              id_prestamo,
              nro_cuotas,
              fecha_realizacion,
              estado
       FROM SOLICITUDES_REFINANCIACION
       WHERE id_solicitud_refinanciacion = :id
       FOR UPDATE`,
      { id: idSolicitud },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
    );
    const sol = rSol.rows?.[0];
    if (!sol) {
      throw new Error('Solicitud de refinanciación no encontrada');
    }
    const estadoSol = sol.ESTADO || sol.estado;
    if (estadoSol !== 'PENDIENTE') {
      throw new Error('Solo se pueden rechazar solicitudes en estado PENDIENTE');
    }

    await conn.execute(
      `UPDATE SOLICITUDES_REFINANCIACION
       SET estado = 'RECHAZADA'
       WHERE id_solicitud_refinanciacion = :id`,
      { id: idSolicitud },
      { autoCommit: false }
    );

    await conn.commit();

    return {
      solicitud: {
        id_solicitud: idSolicitud,
        id_prestamo: sol.ID_PRESTAMO ?? sol.id_prestamo,
        id_prestatario: sol.ID_PRESTATARIO ?? sol.id_prestatario,
        nro_cuotas: sol.NRO_CUOTAS ?? sol.nro_cuotas,
        estado: 'RECHAZADA',
      },
    };
  } catch (err) {
    try {
      await conn.rollback();
    } catch (_) {
      // noop
    }
    throw new Error(
      err.message || 'Error rechazando solicitud de refinanciación'
    );
  } finally {
    await conn.close();
  }
}

module.exports = {
  crearSolicitudRefinanciacion,
  listarSolicitudes,
  listarPorPrestatario,
  obtenerPorId,
  aprobarSolicitud,
  rechazarSolicitud,
};
