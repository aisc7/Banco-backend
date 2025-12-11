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
  getById: async (id_prestatario) => {
    const conn = await getConnection();
    try {
      const result = await conn.execute(
        `SELECT id_prestatario, ci, nombre, apellido, direccion, email, telefono,
                TO_CHAR(fecha_nacimiento,'YYYY-MM-DD') AS fecha_nacimiento,
                estado_cliente, TO_CHAR(fecha_registro,'YYYY-MM-DD HH24:MI:SS') AS fecha_registro,
                usuario_registro, foto
         FROM PRESTATARIOS WHERE id_prestatario = :id`,
        { id: Number(id_prestatario) },
        {
          outFormat: oracledb.OUT_FORMAT_OBJECT,
          fetchInfo: {
            FOTO: { type: oracledb.BUFFER },
          },
        }
      );
      if (!result.rows || result.rows.length === 0) {
        throw new Error('Prestatario no encontrado');
      }
      const row = result.rows[0];
      let fotoBase64 = null;
      if (row.FOTO) {
        try {
          fotoBase64 = Buffer.from(row.FOTO).toString('base64');
        } catch {
          fotoBase64 = null;
        }
      }
      return {
        ...row,
        FOTO_BASE64: fotoBase64,
      };
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
      // eslint-disable-next-line no-console
      console.log('[CARGA-MASIVA] líneas recibidas (no vacías):', lines.length);

      // Arrays de trabajo: filas aceptadas para inserción y filas rechazadas para el resumen.
      const acceptedRows = [];
      const rejectedRows = [];
      let total = 0;
      const DATE_REGEX = /^\d{4}-\d{2}-\d{2}$/;

      for (const [idx, rawLine] of lines.entries()) {
        const lineaNum = idx + 1;
        const lower = rawLine.toLowerCase();
        // Saltar cabeceras típicas (ej: "ci,nombre,apellido,...").
        if (idx === 0 && (lower.startsWith('ci,') || lower.startsWith('ci;') || lower.startsWith('ci\t'))) {
          // eslint-disable-next-line no-continue
          continue;
        }

        total += 1;

        const parts = rawLine.split(/[,;\t]/).map(s => s.trim());
        if (parts.length !== 9) {
          // Rechazo por número de columnas incorrecto.
          rejectedRows.push({
            linea: lineaNum,
            contenido: rawLine,
            ci: null,
            nombre: null,
            telefono: null,
            motivo: 'Número de columnas inválido',
          });
          // eslint-disable-next-line no-continue
          continue;
        }

        const [ci, nombre, apellido, direccion, email, telefono, fecha_nacimiento, estado_cliente] = parts;
        const ciRaw = (ci || '').toString().trim();
        const nombreTrim = (nombre || '').trim();
        const telefonoTrim = (telefono || '').toString().trim();
        const fechaTrim = (fecha_nacimiento || '').toString().trim();
        const baseInfo = {
          linea: lineaNum,
          contenido: rawLine,
          ci: ciRaw || null,
          nombre: nombreTrim || null,
          telefono: telefonoTrim || null,
        };

        // Validación de CI obligatorio y numérico antes de armar acceptedRows.
        if (!ciRaw || Number.isNaN(Number(ciRaw))) {
          rejectedRows.push({
            ...baseInfo,
            motivo: 'CI vacío o inválido',
          });
          // eslint-disable-next-line no-continue
          continue;
        }

        // Validación de longitud de TELEFONO (no vacío y máximo 20 caracteres).
        if (!telefonoTrim) {
          rejectedRows.push({
            ...baseInfo,
            motivo: 'Teléfono vacío o inválido',
          });
          // eslint-disable-next-line no-continue
          continue;
        }
        if (telefonoTrim.length > 20) {
          rejectedRows.push({
            ...baseInfo,
            motivo: 'Teléfono demasiado largo (máx 20 caracteres)',
          });
          // eslint-disable-next-line no-continue
          continue;
        }

        // Validación de formato de fecha de nacimiento (YYYY-MM-DD).
        if (!DATE_REGEX.test(fechaTrim)) {
          rejectedRows.push({
            ...baseInfo,
            motivo: 'fecha_nacimiento inválida (usa YYYY-MM-DD)',
          });
          // eslint-disable-next-line no-continue
          continue;
        }

        // Si pasa todas las validaciones, se agrega a acceptedRows para inserción posterior.
        acceptedRows.push({
          linea: lineaNum,
          CI: ciRaw,
          NOMBRE: nombreTrim,
          APELLIDO: (apellido || '').trim(),
          DIRECCION: (direccion || '').trim(),
          EMAIL: (email || '').trim(),
          TELEFONO: telefonoTrim,
          FECHA_NACIMIENTO: fechaTrim,
          ESTADO_CLIENTE: (estado_cliente || '').trim(),
          USUARIO_REGISTRO: usuario,
        });
      }

      // eslint-disable-next-line no-console
      console.log('[CARGA-MASIVA] registros válidos:', acceptedRows.length);
      // eslint-disable-next-line no-console
      console.log('[CARGA-MASIVA] registros rechazados por validación:', rejectedRows.length);

      // Inserción de filas válidas en PRESTATARIOS y en CARGA_CLIENTES_DETALLE como ACEPATADAS.
      for (const row of acceptedRows) {
        const ciNumber = Number(row.CI);
        try {
          await conn.execute(
            `INSERT INTO PRESTATARIOS (
              ci, nombre, apellido, direccion, email, telefono, fecha_nacimiento,
              estado_cliente, fecha_registro, usuario_registro
            ) VALUES (
              :ci, :nombre, :apellido, :direccion, :email, :telefono, TO_DATE(:fecha_nacimiento,'YYYY-MM-DD'),
              :estado_cliente, SYSDATE, :usuario_registro
            )`,
            {
              ci: ciNumber,
              nombre: row.NOMBRE,
              apellido: row.APELLIDO,
              direccion: row.DIRECCION,
              email: row.EMAIL,
              telefono: row.TELEFONO,
              fecha_nacimiento: row.FECHA_NACIMIENTO,
              estado_cliente: row.ESTADO_CLIENTE,
              usuario_registro: row.USUARIO_REGISTRO,
            },
            { autoCommit: true }
          );

          await conn.execute(
            `INSERT INTO CARGA_CLIENTES_DETALLE (linea, id_log_fk, estado, descripcion_error, ci, nombre, telefono)
             VALUES (:linea, :id_log_fk, 'ACEPTADA', NULL, :ci, :nombre, :telefono)`,
            {
              linea: row.linea,
              id_log_fk: idLog,
              ci: ciNumber,
              nombre: row.NOMBRE,
              telefono: row.TELEFONO,
            },
            { autoCommit: true }
          );
        } catch (err) {
          const e = new Error('Error insertando registros de carga masiva');
          e.originalError = err;
          throw e;
        }
      }

      // Inserción de filas rechazadas en CARGA_CLIENTES_DETALLE como RECHAZADAS (sin tocar PRESTATARIOS).
      for (const rej of rejectedRows) {
        const ciDb = rej.ci && !Number.isNaN(Number(rej.ci)) ? Number(rej.ci) : 0;
        const telefonoDb =
          typeof rej.telefono === 'string'
            ? rej.telefono.slice(0, 20)
            : null;
        await conn.execute(
          `INSERT INTO CARGA_CLIENTES_DETALLE (linea, id_log_fk, estado, descripcion_error, ci, nombre, telefono)
           VALUES (:linea, :id_log_fk, 'RECHAZADA', :descripcion_error, :ci, :nombre, :telefono)`,
          {
            linea: rej.linea,
            id_log_fk: idLog,
            descripcion_error: rej.motivo,
            ci: ciDb,
            nombre: rej.nombre || null,
            telefono: telefonoDb,
          },
          { autoCommit: true }
        );
      }

      const aceptados = acceptedRows.length;
      const rechazados = rejectedRows.length;

      await conn.execute(
        `UPDATE LOG_CARGA_CLIENTES
         SET registros_validos = :ok, registros_rechazados = :bad
         WHERE id_log_pk = :id`,
        { ok: aceptados, bad: rechazados, id: idLog },
        { autoCommit: true }
      );

      // eslint-disable-next-line no-console
      console.log('[CARGA-MASIVA] resumen en modelo:', {
        total,
        aceptados,
        rechazados,
        id_log_pk: idLog,
      });

      const detalles = rejectedRows.map(r => ({
        linea: r.linea,
        ci: r.ci || null,
        motivo: r.motivo,
        contenido: r.contenido,
      }));

      return { total, aceptados, rechazados, detalles, id_log_pk: idLog };
    } catch (err) {
      const e = new Error(err.message || 'Error procesando carga masiva de prestatarios');
      e.originalError = err;
      throw e;
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
  listMorosos: async () => {
    const conn = await getConnection();
    try {
      const q = `
        SELECT p.ID_PRESTATARIO, p.CI, p.NOMBRE, p.APELLIDO, p.EMAIL, p.TELEFONO,
               COUNT(c.ID_CUOTA) AS CUOTAS_VENCIDAS
        FROM PRESTATARIOS p
        JOIN CUOTAS c ON c.ID_PRESTATARIO = p.ID_PRESTATARIO
        WHERE c.ESTADO <> 'PAGADA' AND c.FECHA_VENCIMIENTO < SYSDATE
        GROUP BY p.ID_PRESTATARIO, p.CI, p.NOMBRE, p.APELLIDO, p.EMAIL, p.TELEFONO
        ORDER BY CUOTAS_VENCIDAS DESC`;
      const r = await conn.execute(q, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows || [];
    } catch (err) {
      throw new Error(err.message || 'Error listando morosos');
    } finally {
      await conn.close();
    }
  },
};
