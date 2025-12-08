const oracledb = require('oracledb');
const { getConnection } = require('../config/oracle');

/**
 * Model para la entidad EMPLEADOS.
 * Contiene operaciones CRUD usando la conexión de Oracle y bind params.
 */
module.exports = {
  // Crea un empleado. No se proporciona id_empleado en el INSERT (trigger/sequence en BD).
  createEmpleado: async (data) => {
    const { nombre, apellido, cargo, salario, edad } = data;
    const conn = await getConnection();
    try {
      if (!nombre || !apellido) {
        throw new Error('Campos obligatorios faltantes: nombre, apellido');
      }

      const sql = `INSERT INTO EMPLEADOS (nombre, apellido, cargo, salario, edad)
                   VALUES (:nombre, :apellido, :cargo, :salario, :edad)
                   RETURNING id_empleado INTO :id_out`;

      const binds = {
        nombre,
        apellido,
        cargo: cargo ?? null,
        salario: salario ?? null,
        edad: edad ?? null,
        id_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
      };

      const result = await conn.execute(sql, binds, { autoCommit: true });
      const id = result.outBinds && result.outBinds.id_out ? result.outBinds.id_out[0] : null;

      if (id) {
        // Devolver el registro completo
        return await module.exports.getEmpleadoById(id);
      }
      return { inserted: true };
    } finally {
      await conn.close();
    }
  },

  // Listar todos los empleados
  getAllEmpleados: async () => {
    const conn = await getConnection();
    try {
      const sql = `SELECT id_empleado, nombre, apellido, cargo, salario, edad
                   FROM EMPLEADOS ORDER BY id_empleado DESC`;
      const result = await conn.execute(sql, {}, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return result.rows || [];
    } finally {
      await conn.close();
    }
  },

  // Obtener empleado por id
  getEmpleadoById: async (id) => {
    const conn = await getConnection();
    try {
      const sql = `SELECT id_empleado, nombre, apellido, cargo, salario, edad
                   FROM EMPLEADOS WHERE id_empleado = :id`;
      const result = await conn.execute(sql, { id }, { outFormat: oracledb.OUT_FORMAT_OBJECT });
      return result.rows && result.rows.length ? result.rows[0] : null;
    } finally {
      await conn.close();
    }
  },

  // Actualizar empleado: actualiza solo los campos provistos
  updateEmpleado: async (id, data) => {
    const conn = await getConnection();
    try {
      const fields = ['nombre', 'apellido', 'cargo', 'salario', 'edad'];
      const sets = [];
      const binds = { id };
      for (const f of fields) {
        if (data[f] !== undefined) {
          sets.push(`${f} = :${f}`);
          binds[f] = data[f];
        }
      }
      if (!sets.length) throw new Error('No hay campos para actualizar');

      const sql = `UPDATE EMPLEADOS SET ${sets.join(', ')} WHERE id_empleado = :id`;
      const result = await conn.execute(sql, binds, { autoCommit: true });
      if (result.rowsAffected === 0) throw new Error('Empleado no encontrado');
      return await module.exports.getEmpleadoById(id);
    } finally {
      await conn.close();
    }
  },

  // Eliminar empleado (DELETE físico)
  deleteEmpleado: async (id) => {
    const conn = await getConnection();
    try {
      const result = await conn.execute(
        `DELETE FROM EMPLEADOS WHERE id_empleado = :id`,
        { id },
        { autoCommit: true }
      );
      if (result.rowsAffected === 0) throw new Error('Empleado no encontrado');
      return { deleted: true, id };
    } finally {
      await conn.close();
    }
  },
};
