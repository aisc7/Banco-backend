const { getConnection } = require('../config/oracle');
const oracledb = require('oracledb');

module.exports = {
  insertPrestatario: async (data) => {
    const conn = await getConnection();
    try {
      const required = ['ci','nombre','apellido','direccion','email','telefono','fecha_nacimiento','estado_cliente','usuario_registro'];
      for (const f of required) {
        if (data[f] === undefined || data[f] === null || data[f] === '') {
          throw new Error(`Campo requerido faltante: ${f}`);
        }
      }

      const sql = `INSERT INTO PRESTATARIOS (
        ci, nombre, apellido, direccion, email, telefono, fecha_nacimiento,
        estado_cliente, fecha_registro, usuario_registro
      ) VALUES (
        :ci, :nombre, :apellido, :direccion, :email, :telefono, TO_DATE(:fecha_nacimiento, 'YYYY-MM-DD'),
        :estado_cliente, SYSDATE, :usuario_registro
      )`;

      const binds = {
        ci: Number(data.ci),
        nombre: data.nombre,
        apellido: data.apellido,
        direccion: data.direccion,
        email: data.email,
        telefono: data.telefono,
        fecha_nacimiento: data.fecha_nacimiento,
        estado_cliente: data.estado_cliente,
        usuario_registro: data.usuario_registro,
      };

      try {
        await conn.execute(sql, binds, { autoCommit: true });
      } catch (err) {
        // ORA-00001 unique constraint violated (CI duplicada)
        if (err && err.errorNum === 1) {
          const e = new Error('La cédula ya está registrada');
          e.code = 'DUP_CI';
          throw e;
        }
        throw err;
      }

      return { inserted: true };
    } finally {
      await conn.close();
    }
  },
  updatePrestatario: async (ci, data) => {
    const conn = await getConnection();
    try {
      const fields = ['nombre','apellido','direccion','email','telefono','fecha_nacimiento','estado_cliente'];
      const sets = [];
      const binds = { ci: Number(ci) };
      for (const f of fields) {
        if (data[f] !== undefined) {
          if (f === 'fecha_nacimiento') {
            sets.push(`fecha_nacimiento = TO_DATE(:${f}, 'YYYY-MM-DD')`);
            binds[f] = data[f];
          } else {
            sets.push(`${f} = :${f}`);
            binds[f] = data[f];
          }
        }
      }
      if (!sets.length) throw new Error('No hay campos para actualizar');

      const sql = `UPDATE PRESTATARIOS SET ${sets.join(', ')} WHERE ci = :ci`;
      const result = await conn.execute(sql, binds, { autoCommit: true });
      if (result.rowsAffected === 0) throw new Error('Cédula no encontrada');
      return { updated: true };
    } finally {
      await conn.close();
    }
  },
  deletePrestatario: async (ci) => {
    const conn = await getConnection();
    try {
      const result = await conn.execute(
        `DELETE FROM PRESTATARIOS WHERE ci = :ci`,
        { ci: Number(ci) },
        { autoCommit: true }
      );
      if (result.rowsAffected === 0) throw new Error('Cédula no encontrada');
      return { deleted: true };
    } finally {
      await conn.close();
    }
  },
  updateFoto: async (ci, file) => {
    const conn = await getConnection();
    try {
      if (!file || !file.buffer) throw new Error('Archivo de foto requerido');
      const sql = `UPDATE PRESTATARIOS SET foto = :foto WHERE ci = :ci`;
      const binds = {
        foto: { val: file.buffer, type: oracledb.BLOB },
        ci: Number(ci),
      };
      const result = await conn.execute(sql, binds, { autoCommit: true });
      if (result.rowsAffected === 0) throw new Error('Cédula no encontrada');
      return { updated: true };
    } finally {
      await conn.close();
    }
  },
  checkCedula: async (ci) => {
    const conn = await getConnection();
    try {
      const result = await conn.execute(
        `SELECT COUNT(*) AS cnt FROM PRESTATARIOS WHERE ci = :ci`,
        { ci: Number(ci) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      const cnt = result.rows?.[0]?.CNT ?? result.rows?.[0]?.count ?? 0;
      return { duplicada: Number(cnt) > 0 };
    } finally {
      await conn.close();
    }
  },
  getByCedula: async (ci) => {
    const conn = await getConnection();
    try {
      const result = await conn.execute(
        `SELECT id_prestatario, ci, nombre, apellido, direccion, email, telefono,
                TO_CHAR(fecha_nacimiento,'YYYY-MM-DD') AS fecha_nacimiento,
                estado_cliente, TO_CHAR(fecha_registro,'YYYY-MM-DD HH24:MI:SS') AS fecha_registro,
                usuario_registro
         FROM PRESTATARIOS WHERE ci = :ci`,
        { ci: Number(ci) },
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      if (!result.rows || result.rows.length === 0) {
        throw new Error('Cédula no encontrada');
      }
      return result.rows[0];
    } finally {
      await conn.close();
    }
  },
  listAll: async () => {
    const conn = await getConnection();
    try {
      const result = await conn.execute(
        `SELECT id_prestatario, ci, nombre, apellido, direccion, email, telefono,
                TO_CHAR(fecha_nacimiento,'YYYY-MM-DD') AS fecha_nacimiento,
                estado_cliente, TO_CHAR(fecha_registro,'YYYY-MM-DD HH24:MI:SS') AS fecha_registro,
                usuario_registro
         FROM PRESTATARIOS ORDER BY fecha_registro DESC`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );
      return result.rows || [];
    } finally {
      await conn.close();
    }
  },
  bulkLoad: async (payload) => {
    const conn = await getConnection();
    try {
      const text = payload?.content || payload?.texto || '';
      const usuario = payload?.usuario || payload?.usuario_registro || 'system';
      const nombreArchivo = payload?.nombre_archivo || payload?.filename || 'carga.csv';
      if (!text) throw new Error('Contenido CSV/TXT requerido en "content"');
      // Crear registro de LOG_CARGA_CLIENTES y obtener id_log_pk
      const logIns = await conn.execute(
        `INSERT INTO LOG_CARGA_CLIENTES (id_log_pk, nombre_archivo, fecha_carga, usuario)
         VALUES (SEQ_LOG_CARGA.NEXTVAL, :nombre_archivo, SYSDATE, :usuario)
         RETURNING id_log_pk INTO :id_out`,
        {
          nombre_archivo: nombreArchivo,
          usuario,
          id_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        },
        { autoCommit: true }
      );
      const idLog = logIns.outBinds.id_out[0];

      const lines = text.split(/\r?\n/).filter(l => l.trim().length);
      let total = lines.length;
      let aceptados = 0;
      let rechazados = 0;
      const detalles = [];

      for (const [idx, line] of lines.entries()) {
        const lineaNum = idx + 1;
        const parts = line.split(/[,;\t]/).map(s => s.trim());
        if (parts.length < 9) {
          rechazados++;
          detalles.push({ linea: lineaNum, motivo: 'Estructura inválida' });
          await conn.execute(
            `INSERT INTO CARGA_CLIENTES_DETALLE (linea, id_log_fk, estado, descripcion_error, ci, nombre, telefono)
             VALUES (:linea, :id_log_fk, 'RECHAZADA', :descripcion_error, NULL, NULL, NULL)`,
            { linea: lineaNum, id_log_fk: idLog, descripcion_error: 'Estructura inválida' },
            { autoCommit: true }
          );
          continue;
        }
        const [ci,nombre,apellido,direccion,email,telefono,fecha_nacimiento,estado_cliente,usuario_registro] = parts;
        let descripcionError = null;
        try {
          await conn.execute(
            `INSERT INTO PRESTATARIOS (
              ci, nombre, apellido, direccion, email, telefono, fecha_nacimiento,
              estado_cliente, fecha_registro, usuario_registro
            ) VALUES (
              :ci, :nombre, :apellido, :direccion, :email, :telefono, TO_DATE(:fecha_nacimiento,'YYYY-MM-DD'),
              :estado_cliente, SYSDATE, :usuario_registro
            )`,
            { ci: Number(ci), nombre, apellido, direccion, email, telefono, fecha_nacimiento, estado_cliente, usuario_registro },
            { autoCommit: true }
          );
          aceptados++;
          await conn.execute(
            `INSERT INTO CARGA_CLIENTES_DETALLE (linea, id_log_fk, estado, descripcion_error, ci, nombre, telefono)
             VALUES (:linea, :id_log_fk, 'ACEPTADA', NULL, :ci, :nombre, :telefono)`,
            { linea: lineaNum, id_log_fk: idLog, ci: Number(ci), nombre, telefono },
            { autoCommit: true }
          );
        } catch (err) {
          rechazados++;
          descripcionError = err && err.errorNum === 1 ? 'Cédula duplicada' : (err.message || 'Error desconocido');
          detalles.push({ linea: lineaNum, motivo: descripcionError });
          await conn.execute(
            `INSERT INTO CARGA_CLIENTES_DETALLE (linea, id_log_fk, estado, descripcion_error, ci, nombre, telefono)
             VALUES (:linea, :id_log_fk, 'RECHAZADA', :descripcion_error, :ci, :nombre, :telefono)`,
            { linea: lineaNum, id_log_fk: idLog, descripcion_error: descripcionError, ci: Number(ci), nombre, telefono },
            { autoCommit: true }
          );
        }
      }

      await conn.execute(
        `UPDATE LOG_CARGA_CLIENTES
         SET registros_validos = :ok, registros_rechazados = :bad
         WHERE id_log_pk = :id`,
        { ok: aceptados, bad: rechazados, id: idLog },
        { autoCommit: true }
      );

      return { total, aceptados, rechazados, detalles, id_log_pk: idLog };
    } finally {
      await conn.close();
    }
  },
  getLoadLogs: async () => {
    const conn = await getConnection();
    try {
      const logs = await conn.execute(
        `SELECT id_log_pk, nombre_archivo, TO_CHAR(fecha_carga,'YYYY-MM-DD HH24:MI:SS') AS fecha_carga,
                usuario, registros_validos, registros_rechazados
         FROM LOG_CARGA_CLIENTES
         ORDER BY fecha_carga DESC`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      const detalles = await conn.execute(
        `SELECT linea, id_log_fk, estado, descripcion_error, ci, nombre, telefono
         FROM CARGA_CLIENTES_DETALLE
         ORDER BY id_log_fk, linea`,
        {},
        { outFormat: oracledb.OUT_FORMAT_OBJECT }
      );

      // Agrupar detalles por log
      const map = new Map();
      for (const row of (detalles.rows || [])) {
        if (!map.has(row.ID_LOG_FK)) map.set(row.ID_LOG_FK, []);
        map.get(row.ID_LOG_FK).push(row);
      }

      const result = (logs.rows || []).map(l => ({
        ...l,
        detalles: map.get(l.ID_LOG_PK) || [],
      }));

      return result;
    } finally {
      await conn.close();
    }
  },
};
