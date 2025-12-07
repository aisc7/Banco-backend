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
};
