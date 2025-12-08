const { getConnection } = require('../config/oracle');
const oracledb = require('oracledb');

/**
 * Modelo simple de usuarios para autenticación.
 * Provee búsqueda por username y creación básica.
 */
module.exports = {
  findByUsername: async (username) => {
    const conn = await getConnection();
    try {
      const sql = `SELECT id_usuario AS id, username, password_hash, role, id_prestatario FROM usuarios WHERE username = :username`;
      const r = await conn.execute(sql, { username }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return r.rows && r.rows.length ? r.rows[0] : null;
    } finally {
      await conn.close();
    }
  },
  // Crear usuario (usa password_hash ya generado por el servicio)
  createUser: async (username, password_hash, role = 'EMPLEADO', id_prestatario = null) => {
    const conn = await getConnection();
    try {
      const sql = `INSERT INTO usuarios (username, password_hash, role, id_prestatario) VALUES (:username, :password_hash, :role, :id_prestatario)`;
      await conn.execute(sql, { username, password_hash, role, id_prestatario }, { autoCommit: true });
      return { created: true };
    } finally {
      await conn.close();
    }
  },
};
