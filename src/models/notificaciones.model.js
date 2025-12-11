const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

/**
 * Registra una notificación de correo en la tabla NOTIFICACIONES.
 * No gestiona ID_NOTIFICACION ni FECHA_ENVIO: se delega a la BD (secuencia/trigger/DEFAULT).
 */
async function logEmailNotification({ id_prestatario, id_cuota = null, tipo, mensaje, enviado = 'S' }) {
  const conn = await getConnection();
  try {
    const idPrestatarioNum = Number(id_prestatario);
    if (!Number.isFinite(idPrestatarioNum)) {
      throw new Error('[NOTIFICACIONES] id_prestatario inválido en logEmailNotification');
    }

    let idCuotaNum = null;
    if (id_cuota !== null && id_cuota !== undefined) {
      const parsed = Number(id_cuota);
      if (!Number.isFinite(parsed)) {
        throw new Error('[NOTIFICACIONES] id_cuota inválido en logEmailNotification');
      }
      idCuotaNum = parsed;
    }

    const sql = `
      INSERT INTO NOTIFICACIONES (
        ID_PRESTATARIO,
        ID_CUOTA,
        TIPO,
        MENSAJE,
        ENVIADO
      ) VALUES (
        :id_prestatario,
        :id_cuota,
        :tipo,
        :mensaje,
        :enviado
      )`;

    const binds = {
      id_prestatario: idPrestatarioNum,
      id_cuota: idCuotaNum,
      tipo,
      mensaje,
      enviado: enviado || 'S',
    };

    await conn.execute(sql, binds, { autoCommit: true });
    return { logged: true };
  } catch (err) {
    throw new Error(err.message || 'Error registrando notificación de correo');
  } finally {
    try {
      await conn.close();
    } catch (e) {
      // eslint-disable-next-line no-console
      console.warn('[NOTIFICACIONES] error cerrando conexión:', e && e.message);
    }
  }
}

module.exports = {
  // 1. Consultar notificaciones pendientes (enviado='N')
  listarPendientes: async () => {
    const conn = await getConnection();
    try {
      const q = `SELECT id_notificacion, id_prestatario, id_cuota, tipo, mensaje, fecha_envio, enviado
                 FROM NOTIFICACIONES
                 WHERE enviado = 'N'
                 ORDER BY fecha_envio DESC, id_notificacion DESC`;
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
      const q = `SELECT id_notificacion, id_prestatario, id_cuota, tipo, mensaje, fecha_envio, enviado
                 FROM NOTIFICACIONES
                 ORDER BY fecha_envio DESC, id_notificacion DESC`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error listando histórico de notificaciones');
    } finally {
      await conn.close();
    }
  },

  // 8. Crear notificación ad-hoc (ej. refinanciación de préstamo)
  crearNotificacion: async ({ id_prestatario, id_cuota = null, tipo, mensaje }) => {
    const conn = await getConnection();
    try {
      const sql = `INSERT INTO NOTIFICACIONES (
        id_notificacion, id_prestatario, id_cuota, tipo, mensaje, enviado
      ) VALUES (
        NOTIFICACIONES_SEQ.NEXTVAL, :id_prestatario, :id_cuota, :tipo, :mensaje, 'N'
      )`;
      const binds = {
        id_prestatario: Number(id_prestatario),
        id_cuota: id_cuota != null ? Number(id_cuota) : null,
        tipo,
        mensaje,
      };
      await conn.execute(sql, binds, { autoCommit: true });
      return { created: true };
    } catch (err) {
      throw new Error(err.message || 'Error creando notificación');
    } finally {
      await conn.close();
    }
  },

  logEmailNotification,
};
