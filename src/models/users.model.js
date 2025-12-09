const { getConnection } = require('../config/oracle');
const oracledb = require('oracledb');

/**
 * Modelo simple de usuarios para autenticación.
 * Provee búsqueda por username y creación / inserción básica.
 */

// Helper interno reutilizable para insertar usuario usando una conexión existente.
async function insertUserWithConnection(conn, {
  username,
  password_hash,
  role = 'EMPLEADO',
  id_prestatario = null,
  id_empleado = null,
}, { autoCommit = true } = {}) {
  const sql = `INSERT INTO usuarios (username, password_hash, role, id_prestatario, id_empleado)
               VALUES (:username, :password_hash, :role, :id_prestatario, :id_empleado)`;
  await conn.execute(
    sql,
    { username, password_hash, role, id_prestatario, id_empleado },
    { autoCommit },
  );
  return { created: true };
}

module.exports = {
  findByUsername: async (username) => {
    const conn = await getConnection();
    try {
      const sql = `SELECT id_usuario AS id, username, password_hash, role, id_prestatario, id_empleado
                   FROM usuarios
                   WHERE username = :username`;
      const r = await conn.execute(sql, { username }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows && r.rows.length ? r.rows[0] : null;
    } finally {
      await conn.close();
    }
  },

  /**
   * Crear usuario utilizando una nueva conexión (uso general).
   * password_hash debe venir ya hasheado por el servicio.
   */
  createUser: async (username, password_hash, role = 'EMPLEADO', id_prestatario = null, id_empleado = null) => {
    const conn = await getConnection();
    try {
      return await insertUserWithConnection(
        conn,
        { username, password_hash, role, id_prestatario, id_empleado },
        { autoCommit: true },
      );
    } finally {
      await conn.close();
    }
  },

  /**
   * Crear usuario reutilizando una conexión existente (para flujos transaccionales).
   * No hace commit; el caller es responsable de commit / rollback.
   */
  createUserWithConnection: async (conn, username, password_hash, role = 'EMPLEADO', id_prestatario = null, id_empleado = null) => {
    return insertUserWithConnection(
      conn,
      { username, password_hash, role, id_prestatario, id_empleado },
      { autoCommit: false },
    );
  },
};
