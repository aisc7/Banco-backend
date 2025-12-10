const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

module.exports = {
  registrarLog: async (payload) => {
    const conn = await getConnection();
    try {
      // Placeholder for automatic logs if needed by middleware
      return { ok: true };
    } finally {
      await conn.close();
    }
  },
  registrarAuditoria: async ({ usuario, ip, dominio, tabla, operacion, descripcion }) => {
    const conn = await getConnection();
    try {
      const binds = {
        p_usuario: usuario,
        p_ip: ip,
        p_dominio: dominio,
        p_tabla: tabla,
        p_operacion: operacion,
        p_descripcion: descripcion ?? null,
        p_out_id: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      };
      const plsql = `BEGIN PAK_AUDITORIA.REGISTRAR_AUDITORIA(:p_usuario, :p_ip, :p_dominio, :p_tabla, :p_operacion, :p_descripcion, :p_out_id); END;`;
      await conn.execute(plsql, binds, { autoCommit: true });
      return { id_audit: binds.p_out_id };
    } catch (err) {
      throw new Error(err.message || 'Error registrando auditoría');
    } finally {
      await conn.close();
    }
  },
  finalizarSesion: async (id_audit) => {
    const conn = await getConnection();
    try {
      const binds = { p_id_audit: id_audit };
      const plsql = `BEGIN PAK_AUDITORIA.FINALIZAR_SESION(:p_id_audit); END;`;
      await conn.execute(plsql, binds, { autoCommit: true });
      return { id_audit };
    } catch (err) {
      throw new Error(err.message || 'Error finalizando sesión de auditoría');
    } finally {
      await conn.close();
    }
  },
  listarLogs: async ({ usuario, operacion, tabla, limit = 100, offset = 0 }) => {
    const conn = await getConnection();
    try {
      const binds = {};
      const where = [];
      if (usuario) { where.push('USUARIO = :p_usuario'); binds.p_usuario = usuario; }
      if (operacion) { where.push('OPERACION = :p_operacion'); binds.p_operacion = operacion; }
      if (tabla) { where.push('TABLA_AFECTADA = :p_tabla'); binds.p_tabla = tabla; }
      const whereSql = where.length ? `WHERE ${where.join(' AND ')}` : '';
      const sql = `
        SELECT ID_AUDIT_PK, USUARIO, IP, DOMINIO,
               FECHA_ENTRADA, FECHA_SALIDA,
               TABLA_AFECTADA, OPERACION,
               DURACION_SESION, DESCRIPCION
        FROM LOG_AUDITORIA
        ${whereSql}
        ORDER BY FECHA_ENTRADA DESC
        OFFSET :p_offset ROWS FETCH NEXT :p_limit ROWS ONLY`;
      binds.p_offset = offset;
      binds.p_limit = limit;
      const result = await conn.execute(sql, binds, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return result.rows;
    } catch (err) {
      throw new Error(err.message || 'Error consultando LOG_AUDITORIA');
    } finally {
      await conn.close();
    }
  },
};
