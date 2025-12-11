const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

module.exports = {
  consolidado: async () => {
    const conn = await getConnection();
    try {
      // FUN_RESUMEN_PRESTAMOS retorna SYS_REFCURSOR, se consume vía cursor explícito.
      const binds = {
        p_cursor: { dir: oracledb.BIND_OUT, type: oracledb.CURSOR },
      };
      const plsql = `BEGIN :p_cursor := PAK_REPORTES.FUN_RESUMEN_PRESTAMOS(); END;`;
      const result = await conn.execute(plsql, binds, {
        outFormat: oracledb.OUT_FORMAT_OBJECT,
      });
      const cursor = result.outBinds.p_cursor;
      const rows = await cursor.getRows(1000);
      await cursor.close();
      return rows || [];
    } catch (err) {
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
