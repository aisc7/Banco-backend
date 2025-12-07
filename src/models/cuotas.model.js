const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

module.exports = {
  // 2. Registrar pago de cuota: PAK_CUOTAS.PRO_REGISTRAR_PAGO(p_id_cuota, p_fecha_pago)
  registrarPagoCuota: async (idCuota, data) => {
    const { fecha_pago } = data; // ISO string or date
    const conn = await getConnection();
    try {
      const binds = {
        p_id_cuota: idCuota,
        p_fecha_pago: fecha_pago ? new Date(fecha_pago) : new Date(),
      };
      const plsql = `BEGIN PAK_CUOTAS.PRO_REGISTRAR_PAGO(:p_id_cuota, :p_fecha_pago); END;`;
      await conn.execute(plsql, binds, { autoCommit: true });

      // Devuelve estado actualizado del préstamo y cuota
      const qCuota = `SELECT * FROM CUOTAS WHERE ID_CUOTA = :id`;
      const rCuota = await conn.execute(qCuota, { id: idCuota }, { outFormat: oracledb.OUT_FORMAT_OBJECT });

      // Infer loan id from cuota (assuming ID_PRESTAMO present)
      const idPrestamo = rCuota.rows?.[0]?.ID_PRESTAMO || rCuota.rows?.[0]?.id_prestamo;
      let rPrestamo = { rows: [] };
      if (idPrestamo) {
        const qPrestamo = `SELECT * FROM PRESTAMOS WHERE ID_PRESTAMO = :id`;
        rPrestamo = await conn.execute(qPrestamo, { id: idPrestamo }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      }

      return {
        cuota: rCuota.rows?.[0] || null,
        prestamo: rPrestamo.rows?.[0] || null,
      };
    } catch (err) {
      throw new Error(err.message || 'Error registrando pago de cuota');
    } finally {
      await conn.close();
    }
  },

  // 3. Obtener morosidad: PAK_CUOTAS.FUN_CALC_MOROSIDAD(p_id_prestatario)
  obtenerMorosidad: async (idPrestatario) => {
    const conn = await getConnection();
    try {
      const binds = {
        p_id_prestatario: idPrestatario,
        p_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      };
      const plsql = `BEGIN :p_out := PAK_CUOTAS.FUN_CALC_MOROSIDAD(:p_id_prestatario); END;`;
      const result = await conn.execute(plsql, binds, { autoCommit: false });
      const total_morosidad = result.outBinds.p_out;
      return { id_prestatario: idPrestatario, total_morosidad };
    } catch (err) {
      throw new Error(err.message || 'Error obteniendo morosidad');
    } finally {
      await conn.close();
    }
  },

  // 4. Aplicar penalización: PAK_CUOTAS.PRO_APLICAR_PENALIZACION(p_id_prestatario)
  aplicarPenalizacion: async (idPrestatario) => {
    const conn = await getConnection();
    try {
      const plsql = `BEGIN PAK_CUOTAS.PRO_APLICAR_PENALIZACION(:p_id_prestatario); END;`;
      await conn.execute(plsql, { p_id_prestatario: idPrestatario }, { autoCommit: true });
      return { id_prestatario: idPrestatario, aplicado: true };
    } catch (err) {
      throw new Error(err.message || 'Error aplicando penalización');
    } finally {
      await conn.close();
    }
  },

  // 5. Resumen de cuotas: PAK_CUOTAS.PRO_GENERAR_RESUMEN_CUOTAS -> OUT cursor
  resumenCuotas: async (idPrestatario) => {
    const conn = await getConnection();
    try {
      const binds = {
        p_id_prestatario: idPrestatario,
        p_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      };
      const plsql = `BEGIN PAK_CUOTAS.PRO_GENERAR_RESUMEN_CUOTAS(:p_id_prestatario, :p_cursor); END;`;
      const result = await conn.execute(plsql, binds, { autoCommit: false });

      const cursor = result.outBinds.p_cursor;
      const rows = await cursor.getRows(1000);
      await cursor.close();
      return { id_prestatario: idPrestatario, resumen: rows };
    } catch (err) {
      throw new Error(err.message || 'Error generando resumen de cuotas');
    } finally {
      await conn.close();
    }
  },

  // 6. Vistas de reportes
  listarPendientes: async () => {
    const conn = await getConnection();
    try {
      const q = `SELECT * FROM VW_CUOTAS_PENDIENTES ORDER BY FECHA_VENCIMIENTO`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error listando cuotas pendientes');
    } finally {
      await conn.close();
    }
  },
  listarMorosas: async () => {
    const conn = await getConnection();
    try {
      const q = `SELECT * FROM VW_CUOTAS_MOROSAS ORDER BY FECHA_VENCIMIENTO`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error listando cuotas morosas');
    } finally {
      await conn.close();
    }
  },
};
