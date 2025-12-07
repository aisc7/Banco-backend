const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

module.exports = {
  // 1. Consultar notificaciones pendientes (enviado='N')
  listarPendientes: async () => {
    const conn = await getConnection();
    try {
      const q = `SELECT id_notificacion, id_prestatario, id_cuota, tipo, mensaje
                 FROM NOTIFICACIONES
                 WHERE enviado = 'N'
                 ORDER BY id_notificacion`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error consultando notificaciones pendientes');
    } finally {
      await conn.close();
    }
  },

  // 2. Marcar notificaciones como enviadas: PAK_NOTIFICACIONES.PRO_ENVIAR_NOTIFICACIONES_MASIVAS(p_tipo)
  enviarMasivas: async (tipo) => {
    const conn = await getConnection();
    try {
      const plsql = `BEGIN PAK_NOTIFICACIONES.PRO_ENVIAR_NOTIFICACIONES_MASIVAS(:p_tipo); END;`;
      await conn.execute(plsql, { p_tipo: tipo }, { autoCommit: true });
      return { tipo, enviado: true };
    } catch (err) {
      throw new Error(err.message || 'Error enviando notificaciones masivas');
    } finally {
      await conn.close();
    }
  },

  // 3. Recordatorios de pago: inserta notificaciones
  recordatoriosPago: async () => {
    const conn = await getConnection();
    try {
      const plsql = `BEGIN PAK_NOTIFICACIONES.PRO_RECORDATORIOS_PAGO; END;`;
      await conn.execute(plsql, {}, { autoCommit: true });
      return { ok: true };
    } catch (err) {
      throw new Error(err.message || 'Error generando recordatorios de pago');
    } finally {
      await conn.close();
    }
  },

  // 4. Notificaciones de mora
  notificarMora: async () => {
    const conn = await getConnection();
    try {
      const plsql = `BEGIN PAK_NOTIFICACIONES.PRO_NOTIFICAR_MORA; END;`;
      await conn.execute(plsql, {}, { autoCommit: true });
      return { ok: true };
    } catch (err) {
      throw new Error(err.message || 'Error generando notificaciones de mora');
    } finally {
      await conn.close();
    }
  },

  // 5. Notificaciones de cancelación
  notificarCancelacion: async () => {
    const conn = await getConnection();
    try {
      const plsql = `BEGIN PAK_NOTIFICACIONES.PRO_NOTIFICAR_CANCELACION; END;`;
      await conn.execute(plsql, {}, { autoCommit: true });
      return { ok: true };
    } catch (err) {
      throw new Error(err.message || 'Error generando notificaciones de cancelación');
    } finally {
      await conn.close();
    }
  },

  // 7. Histórico: leer todas
  listarHistorico: async () => {
    const conn = await getConnection();
    try {
      const q = `SELECT id_notificacion, id_prestatario, id_cuota, tipo, mensaje, enviado
                 FROM NOTIFICACIONES
                 ORDER BY id_notificacion DESC`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error listando histórico de notificaciones');
    } finally {
      await conn.close();
    }
  },
};
