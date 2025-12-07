const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

module.exports = {
  consolidado: async () => {
    const conn = await getConnection();
    try {
      // Approach 1: table function returns rows
      const q = `SELECT * FROM TABLE(PAK_REPORTES.FUN_RESUMEN_PRESTAMOS)`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      // Approach 2 (if returns SYS_REFCURSOR): uncomment and use cursor consumption
      // const binds = { p_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR } };
      // const plsql = `BEGIN PAK_REPORTES.FUN_RESUMEN_PRESTAMOS(:p_cursor); END;`;
      // const result = await conn.execute(plsql, binds);
      // const cursor = result.outBinds.p_cursor; const rows = await cursor.getRows(1000); await cursor.close();
      throw new Error(err.message || 'Error obteniendo resumen de préstamos');
    } finally {
      await conn.close();
    }
  },
  morosos: async () => {
    const conn = await getConnection();
    try {
      const q = `SELECT * FROM TABLE(PAK_REPORTES.FUN_LISTADO_MOROSOS)`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error obteniendo reporte de morosos');
    } finally {
      await conn.close();
    }
  },
  dataCredito: async () => {
    const conn = await getConnection();
    try {
      const q = `SELECT * FROM TABLE(PAK_REPORTES.FUN_LISTADO_DATACREDITO)`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error obteniendo reporte DataCrédito');
    } finally {
      await conn.close();
    }
  },
  refinanciaciones: async () => {
    const conn = await getConnection();
    try {
      const q = `SELECT * FROM TABLE(PAK_REPORTES.FUN_REFINANCIACIONES_ACTIVAS)`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error obteniendo refinanciaciones activas');
    } finally {
      await conn.close();
    }
  },
};
