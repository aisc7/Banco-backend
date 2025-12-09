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
      await conn.execute(plsql, binds, { autoCommit: true });

      const id_prestamo = binds.p_out_id;
      return { id_prestamo };
    } catch (err) {
      // Superficial mapping: if Oracle enforces max 2 activos, bubble up message
      throw new Error(err.message || 'Error creando préstamo');
    } finally {
      await conn.close();
    }
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
      const rCuotas = await conn.execute(qCuotas, { id_prestatario }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

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
      const qPrestatario = `SELECT ci FROM prestatarios WHERE id_prestatario = :id_prestatario`;
      const rPrestatario = await conn.execute(
        qPrestatario,
        { id_prestatario },
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
        ORDER BY p.ID_PRESTAMO DESC`;
      const rPrestamos = await conn.execute(
        qPrestamos,
        { id_prestatario },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const qCuotas = `
        SELECT id_prestamo, nro_cuota, valor_cuota, saldo, estado, fecha_vencimiento
        FROM vw_resumen_cuotas
        WHERE id_prestamo IN (
          SELECT p.id_prestamo FROM prestamos p WHERE p.id_prestatario = :id_prestatario
        )
        ORDER BY id_prestamo, nro_cuota`;
      const rCuotas = await conn.execute(
        qCuotas,
        { id_prestatario },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

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
        SELECT ID_PRESTAMO, ID_SOLICITUD_PRESTAMO, ID_PRESTATARIO, TOTAL_PRESTADO, NRO_CUOTAS,
               INTERES, FECHA_EMISION, FECHA_VENCIMIENTO, ESTADO
        FROM PRESTAMOS
        ORDER BY ID_PRESTAMO DESC`;
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
