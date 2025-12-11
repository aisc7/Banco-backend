const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

module.exports = {
  // 1. Crear préstamo: consume PAK_PRESTAMOS.PRO_CREAR_PRESTAMO
  createPrestamo: async (data) => {
    const { id_prestatario, monto, nro_cuotas, tipo_interes, id_empleado } = data;
    const conn = await getConnection();
    try {
      const binds = {
        p_id_prestatario: id_prestatario,
        p_monto: monto,
        p_nro_cuotas: nro_cuotas,
        p_tipo_interes: tipo_interes, // 'BAJA' | 'MEDIA' | 'ALTA'
        p_id_empleado: id_empleado ?? null,
        p_out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      };

      const plsql = `BEGIN PAK_PRESTAMOS.PRO_CREAR_PRESTAMO(:p_id_prestatario, :p_monto, :p_nro_cuotas, :p_tipo_interes, :p_id_empleado, :p_out_id); END;`;
      const r = await conn.execute(plsql, binds, { autoCommit: true });

      const id_prestamo = r.outBinds?.p_out_id?.[0] ?? null;
      return { id_prestamo };
    } catch (err) {
      // Superficial mapping: if Oracle enforces max 2 activos, bubble up message
      throw new Error(err.message || 'Error creando préstamo');
    } finally {
      await conn.close();
    }
  },

  // 1b. Crear préstamo dentro de una transacción existente (sin cerrar/autoCommit)
  createPrestamoTransactional: async (conn, data) => {
    const { id_prestatario, monto, nro_cuotas, tipo_interes, id_empleado } = data;
    const binds = {
      p_id_prestatario: id_prestatario,
      p_monto: monto,
      p_nro_cuotas: nro_cuotas,
      p_tipo_interes: tipo_interes,
      p_id_empleado: id_empleado ?? null,
      p_out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
    };
    const plsql = `BEGIN PAK_PRESTAMOS.PRO_CREAR_PRESTAMO(:p_id_prestatario, :p_monto, :p_nro_cuotas, :p_tipo_interes, :p_id_empleado, :p_out_id); END;`;
    const r = await conn.execute(plsql, binds, { autoCommit: false });
    const id_prestamo = r.outBinds?.p_out_id?.[0] ?? null;
    if (!id_prestamo) throw new Error('No se obtuvo ID_PRESTAMO');
    return { id_prestamo };
  },

  // 1c. Crear préstamo manualmente dentro de una transacción existente (sin paquete PL/SQL)
  // Requiere: id_solicitud_prestamo, id_prestatario, monto, nro_cuotas, tipo_interes
  createPrestamoManualTransactional: async (conn, data) => {
    const { id_solicitud_prestamo, id_prestatario, monto, nro_cuotas, tipo_interes } = data;
    // Cálculo simple de interés y total
    const rateMap = { BAJA: 0.05, MEDIA: 0.10, ALTA: 0.15 };
    const rate = rateMap[(tipo_interes || 'MEDIA').toUpperCase()] ?? rateMap.MEDIA;
    const interes = Math.round(monto * rate);
    const total_prestado = monto + interes;
    // Fechas
    const rFecha = await conn.execute(`SELECT SYSDATE AS F FROM DUAL`, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false });
    const fecha_emision = rFecha.rows?.[0]?.F;
    // Para fecha_vencimiento, asumimos +nro_cuotas meses desde emisión
    const rVenc = await conn.execute(
      `SELECT ADD_MONTHS(SYSDATE, :n) AS FV FROM DUAL`,
      { n: Number(nro_cuotas) },
      { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
    );
    const fecha_vencimiento = rVenc.rows?.[0]?.FV;

    // Insert préstamo; soportar secuencia y/o trigger con RETURNING
    let id_prestamo;
    try {
      const sql = `INSERT INTO PRESTAMOS (
          id_solicitud_prestamo, id_prestatario, total_prestado, nro_cuotas,
          interes, fecha_emision, fecha_vencimiento, estado
        ) VALUES (
          :id_solicitud_prestamo, :id_prestatario, :total_prestado, :nro_cuotas,
          :interes, :fecha_emision, :fecha_vencimiento, 'ACTIVO'
        ) RETURNING id_prestamo INTO :id_out`;
      const binds = {
        id_solicitud_prestamo: Number(id_solicitud_prestamo),
        id_prestatario: Number(id_prestatario),
        total_prestado: Number(total_prestado),
        nro_cuotas: Number(nro_cuotas),
        interes: Number(interes),
        fecha_emision,
        fecha_vencimiento,
        id_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      };
      const r = await conn.execute(sql, binds, { autoCommit: false });
      id_prestamo = r.outBinds?.id_out?.[0];
      if (!id_prestamo) throw new Error('No se obtuvo ID_PRESTAMO');
    } catch (err) {
      throw new Error(err.message || 'Error creando préstamo (manual)');
    }

    return { id_prestamo, total_prestado, interes, fecha_emision, fecha_vencimiento };
  },

  // 1d. Generar cuotas manualmente dentro de la misma transacción
  generateCuotasTransactional: async (conn, args) => {
    const { id_prestamo, id_prestatario, total_prestado, nro_cuotas } = args;
    // Monto por cuota simple: dividir total por número de cuotas (redondeo básico)
    const valor_cuota = Math.round(Number(total_prestado) / Number(nro_cuotas));
    // Generar vencimientos: modo minutos en dev (base de 3 min), mensual en prod
    const isProd = (process.env.NODE_ENV || 'development') === 'production';
    const baseMinutes = Number(process.env.CUOTAS_MINUTES_BASE || (isProd ? '0' : '3'));
    for (let i = 1; i <= Number(nro_cuotas); i++) {
      let fv;
      if (baseMinutes > 0) {
        const minutes = baseMinutes * i; // 3, 6, 9, ...
        const fractionOfDay = minutes / 1440;
        const rV = await conn.execute(
          `SELECT (SYSDATE + :days_fraction) AS FV FROM DUAL`,
          { days_fraction: fractionOfDay },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        fv = rV.rows?.[0]?.FV;
      } else {
        const rV = await conn.execute(
          `SELECT ADD_MONTHS(SYSDATE, :n) AS FV FROM DUAL`,
          { n: i },
          { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
        );
        fv = rV.rows?.[0]?.FV;
      }
      // Insert cuota con ID_CUOTA asignado por secuencia o trigger
      const seqName = process.env.CUOTAS_SEQ_NAME || null;
      let inserted = false;
      if (seqName) {
        // Usar secuencia del entorno
        const getIdSql = `SELECT ${seqName}.NEXTVAL AS ID FROM DUAL`;
        const rSeq = await conn.execute(getIdSql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false });
        const nextId = rSeq.rows?.[0]?.ID;
        if (nextId) {
          const sqlCuota = `INSERT INTO CUOTAS (
              id_cuota, id_prestamo, id_prestatario, monto, nro_cuota, fecha_vencimiento, estado
            ) VALUES (
              :id_cuota, :id_prestamo, :id_prestatario, :monto, :nro_cuota, :fecha_vencimiento, 'PENDIENTE'
            )`;
          const bindsCuota = {
            id_cuota: Number(nextId),
            id_prestamo: Number(id_prestamo),
            id_prestatario: Number(id_prestatario),
            monto: Number(valor_cuota),
            nro_cuota: i,
            fecha_vencimiento: fv,
          };
          await conn.execute(sqlCuota, bindsCuota, { autoCommit: false });
          inserted = true;
        }
      }
      if (!inserted) {
        // Intentar secuencias comunes; luego fallback a trigger + RETURNING
        const trySeq = async (name) => {
          try {
            const rSeq = await conn.execute(
              `SELECT ${name}.NEXTVAL AS ID FROM DUAL`,
              {},
              { outFormat: oracledb.OUT_FORMAT_OBJECT, autoCommit: false }
            );
            const nextId = rSeq.rows?.[0]?.ID;
            if (!nextId) return false;
            const sqlCuota = `INSERT INTO CUOTAS (
                id_cuota, id_prestamo, id_prestatario, monto, nro_cuota, fecha_vencimiento, estado
              ) VALUES (
                :id_cuota, :id_prestamo, :id_prestatario, :monto, :nro_cuota, :fecha_vencimiento, 'PENDIENTE'
              )`;
            const bindsCuota = {
              id_cuota: Number(nextId),
              id_prestamo: Number(id_prestamo),
              id_prestatario: Number(id_prestatario),
              monto: Number(valor_cuota),
              nro_cuota: i,
              fecha_vencimiento: fv,
            };
            await conn.execute(sqlCuota, bindsCuota, { autoCommit: false });
            return true;
          } catch (_) {
            return false;
          }
        };
        inserted = (await trySeq('CUOTAS_SEQ')) || (await trySeq('SEQ_CUOTAS'));
        if (!inserted) {
          // Fallback: confiar en trigger y usar RETURNING
          const sqlCuota = `INSERT INTO CUOTAS (
              id_prestamo, id_prestatario, monto, nro_cuota, fecha_vencimiento, estado
            ) VALUES (
              :id_prestamo, :id_prestatario, :monto, :nro_cuota, :fecha_vencimiento, 'PENDIENTE'
            ) RETURNING id_cuota INTO :id_out`;
          const bindsCuota = {
            id_prestamo: Number(id_prestamo),
            id_prestatario: Number(id_prestatario),
            monto: Number(valor_cuota),
            nro_cuota: i,
            fecha_vencimiento: fv,
            id_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
          };
          const rIns = await conn.execute(sqlCuota, bindsCuota, { autoCommit: false });
          const idCuota = rIns.outBinds?.id_out?.[0];
          if (!idCuota) throw new Error('No se obtuvo ID_CUOTA');
        }
      }
    }
    return { valor_cuota };
  },

  // 2. Registrar refinanciación: consume PAK_PRESTAMOS.PRO_REGISTRAR_REFINANCIACION
  createRefinanciacion: async (idPrestamo, data) => {
    const { nro_cuotas } = data;
    const conn = await getConnection();
    try {
      const binds = {
        p_id_prestamo: idPrestamo,
        p_nro_cuotas: nro_cuotas,
        p_out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      };
      const plsql = `BEGIN PAK_PRESTAMOS.PRO_REGISTRAR_REFINANCIACION(:p_id_prestamo, :p_nro_cuotas, :p_out_id); END;`;
      await conn.execute(plsql, binds, { autoCommit: true });

      const id_solicitud_refinanciacion = binds.p_out_id;
      return { id_solicitud_refinanciacion };
    } catch (err) {
      throw new Error(err.message || 'Error registrando refinanciación');
    } finally {
      await conn.close();
    }
  },

  // 3. Obtener préstamos por prestatario (via PRESTATARIOS, PRESTAMOS y VW_RESUMEN_CUOTAS)
  findByPrestatario: async (ci) => {
    const conn = await getConnection();
    try {
      // 3.1 Obtener id_prestatario por CI
      const qPrestatario = `SELECT id_prestatario FROM prestatarios WHERE ci = :ci`;
      const rPrestatario = await conn.execute(qPrestatario, { ci }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      if (!rPrestatario.rows?.length) {
        return { prestatario: null, prestamos: [], cuotas: [] };
      }
      const id_prestatario = rPrestatario.rows[0].ID_PRESTATARIO ?? rPrestatario.rows[0].id_prestatario;

      // 3.2 Obtener préstamos del prestatario
      const qPrestamos = `
        SELECT p.ID_PRESTAMO, p.ID_SOLICITUD_PRESTAMO, p.ID_PRESTATARIO, p.TOTAL_PRESTADO, p.NRO_CUOTAS,
               p.INTERES, p.FECHA_EMISION, p.FECHA_VENCIMIENTO, p.ESTADO
        FROM PRESTAMOS p
        WHERE p.ID_PRESTATARIO = :id_prestatario
        ORDER BY p.ID_PRESTAMO DESC`;
      const rPrestamos = await conn.execute(qPrestamos, { id_prestatario }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

      // 3.3 Resumen de cuotas por vista
      const qCuotas = `
        SELECT id_prestamo, nro_cuota, valor_cuota, saldo, estado, fecha_vencimiento
        FROM vw_resumen_cuotas
        WHERE id_prestamo IN (
          SELECT p.id_prestamo FROM prestamos p WHERE p.id_prestatario = :id_prestatario
        )
        ORDER BY id_prestamo, nro_cuota`;
      let rCuotas = { rows: [] };
      try {
        rCuotas = await conn.execute(qCuotas, { id_prestatario }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      } catch (err) {
        // Tolerar errores en la vista/resumen de cuotas y devolver vacío para no romper la consulta de préstamos
        // eslint-disable-next-line no-console
        console.warn('Resumen de cuotas no disponible, devolviendo cuotas vacías:', err && err.message);
        rCuotas = { rows: [] };
      }

      return {
        prestatario: { id_prestatario, ci },
        prestamos: rPrestamos.rows || [],
        cuotas: rCuotas.rows || [],
      };
    } catch (err) {
      throw new Error(err.message || 'Error obteniendo préstamos del prestatario');
    } finally {
      await conn.close();
    }
  },

  // 3b. Obtener préstamos por id_prestatario (usado cuando el PRESTATARIO consulta sus propios préstamos)
  findByPrestatarioId: async (id_prestatario) => {
    const conn = await getConnection();
    try {
      const id = Number(id_prestatario);
      if (!Number.isFinite(id)) {
        throw new Error('id_prestatario inválido');
      }
      const qPrestatario = `SELECT ci FROM prestatarios WHERE id_prestatario = :id_prestatario`;
      const rPrestatario = await conn.execute(
        qPrestatario,
        { id_prestatario: id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!rPrestatario.rows?.length) {
        return { prestatario: null, prestamos: [], cuotas: [] };
      }
      const ci = rPrestatario.rows[0].CI ?? rPrestatario.rows[0].ci;

      const qPrestamos = `
        SELECT p.ID_PRESTAMO, p.ID_SOLICITUD_PRESTAMO, p.ID_PRESTATARIO, p.TOTAL_PRESTADO, p.NRO_CUOTAS,
               p.INTERES, p.FECHA_EMISION, p.FECHA_VENCIMIENTO, p.ESTADO
        FROM PRESTAMOS p
        WHERE p.ID_PRESTATARIO = :id_prestatario
          AND p.ESTADO <> 'CANCELADO'
        ORDER BY p.ID_PRESTAMO DESC`;
      const rPrestamos = await conn.execute(
        qPrestamos,
        { id_prestatario: id },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const qCuotas = `
        SELECT id_prestamo, nro_cuota, valor_cuota, saldo, estado, fecha_vencimiento
        FROM vw_resumen_cuotas
        WHERE id_prestamo IN (
          SELECT p.id_prestamo FROM prestamos p WHERE p.id_prestatario = :id_prestatario
        )
        ORDER BY id_prestamo, nro_cuota`;
      let rCuotas = { rows: [] };
      try {
        rCuotas = await conn.execute(
          qCuotas,
          { id_prestatario: id },
          { outFormat: oracledb.OUT_FORMAT_OBJECT }
        );
      } catch (err) {
        // Tolerar cualquier error en la vista/resumen de cuotas y devolver vacío
        // eslint-disable-next-line no-console
        console.warn('Resumen de cuotas no disponible, devolviendo cuotas vacías:', err && err.message);
        rCuotas = { rows: [] };
      }

      return {
        prestatario: { id_prestatario, ci },
        prestamos: rPrestamos.rows || [],
        cuotas: rCuotas.rows || [],
      };
    } catch (err) {
      throw new Error(err.message || 'Error obteniendo préstamos del prestatario');
    } finally {
      await conn.close();
    }
  },

  // Listar todos los préstamos
  findAll: async () => {
    const conn = await getConnection();
    try {
      const q = `
        SELECT p.ID_PRESTAMO,
               p.ID_SOLICITUD_PRESTAMO,
               p.ID_PRESTATARIO,
               pr.CI,
               pr.NOMBRE,
               pr.APELLIDO,
               pr.NOMBRE || ' ' || pr.APELLIDO AS NOMBRE_PRESTATARIO,
               p.TOTAL_PRESTADO,
               p.NRO_CUOTAS,
               p.INTERES,
               p.FECHA_EMISION,
               p.FECHA_VENCIMIENTO,
               p.ESTADO
        FROM PRESTAMOS p
        JOIN PRESTATARIOS pr
          ON pr.ID_PRESTATARIO = p.ID_PRESTATARIO
        ORDER BY p.ID_PRESTAMO DESC`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error listando préstamos');
    } finally {
      await conn.close();
    }
  },

  // Obtener préstamo por ID
  findById: async (idPrestamo) => {
    const conn = await getConnection();
    try {
      const q = `
        SELECT ID_PRESTAMO, ID_SOLICITUD_PRESTAMO, ID_PRESTATARIO, TOTAL_PRESTADO, NRO_CUOTAS,
               INTERES, FECHA_EMISION, FECHA_VENCIMIENTO, ESTADO
        FROM PRESTAMOS
        WHERE ID_PRESTAMO = :id_prestamo`;
      const r = await conn.execute(q, { id_prestamo: idPrestamo }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows?.[0] || null;
    } catch (err) {
      throw new Error(err.message || 'Error obteniendo préstamo');
    } finally {
      await conn.close();
    }
  },

  // Actualizar préstamo: solo campo seguro ESTADO
  updatePrestamo: async (idPrestamo, data) => {
    const { estado } = data;
    const conn = await getConnection();
    try {
      const binds = { id_prestamo: idPrestamo, estado: estado ?? null };
      // Actualizar estado si viene
      if (estado != null) {
        await conn.execute(
          `UPDATE PRESTAMOS SET ESTADO = :estado WHERE ID_PRESTAMO = :id_prestamo`,
          { id_prestamo: idPrestamo, estado },
          { autoCommit: false }
        );
      }
      await conn.commit();

      return await module.exports.findById(idPrestamo);
    } catch (err) {
      try { await conn.rollback(); } catch (_) {}
      throw new Error(err.message || 'Error actualizando préstamo');
    } finally {
      await conn.close();
    }
  },

  // Eliminar/cancelar préstamo: marcar ESTADO='CANCELADO'
  deletePrestamo: async (idPrestamo) => {
    const conn = await getConnection();
    try {
      await conn.execute(
        `UPDATE PRESTAMOS SET ESTADO = 'CANCELADO' WHERE ID_PRESTAMO = :id_prestamo`,
        { id_prestamo: idPrestamo },
        { autoCommit: true }
      );
      return { id_prestamo: idPrestamo, estado: 'CANCELADO' };
    } catch (err) {
      throw new Error(err.message || 'Error cancelando préstamo');
    } finally {
      await conn.close();
    }
  },
};
