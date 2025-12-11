const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');
const usersModel = require('../models/users.model');
const prestatariosModel = require('../models/prestatarios.model');
const empleadosModel = require('../models/empleados.model');
const { getConnection } = require('../config/oracle');
const oracledb = require('oracledb');

/**
 * Servicio de autenticación: login, creación mínima de usuarios
 * y flujos de registro completos (prestatario / empleado).
 */

const getSaltRounds = () => {
  const fromEnv = Number(process.env.BCRYPT_SALT_ROUNDS);
  return Number.isFinite(fromEnv) && fromEnv > 0 ? fromEnv : 10;
};

module.exports = {
  login: async (username, password) => {
    // Logs ANTES de cualquier throw
    // eslint-disable-next-line no-console
    console.log('[LOGIN] username recibido:', username);

    const user = await usersModel.findByUsername(username);

    // eslint-disable-next-line no-console
    console.log('[LOGIN] usuario encontrado:', !!user, user && {
      id: user.ID_USUARIO || user.id,
      username: user.USERNAME || user.username,
      role: user.ROLE || user.role,
    });

    if (!user) {
      // eslint-disable-next-line no-console
      console.log('[LOGIN] user es null para username:', username);
      throw new Error('Usuario o contraseña inválidos');
    }

    const passwordHash = user.PASSWORD_HASH || user.password_hash;

    // eslint-disable-next-line no-console
    console.log('[LOGIN] passwordHash existe?', !!passwordHash);

    if (!passwordHash) {
      // eslint-disable-next-line no-console
      console.error('[LOGIN] Usuario sin password_hash en DB:', {
        id: user.ID_USUARIO || user.id,
        username: user.USERNAME || user.username,
        role: user.ROLE || user.role,
      });
      throw new Error('Usuario o contraseña inválidos');
    }

    const ok = await bcrypt.compare(password, String(passwordHash));

    // eslint-disable-next-line no-console
    console.log('[LOGIN] resultado bcrypt.compare:', ok);

    if (!ok) {
      // eslint-disable-next-line no-console
      console.warn('[LOGIN] Password incorrecto para usuario:', {
        id: user.ID_USUARIO || user.id,
        username: user.USERNAME || user.username,
      });
      throw new Error('Usuario o contraseña inválidos');
    }

    const payload = {
      id: user.ID_USUARIO || user.ID || user.id,
      username: user.USERNAME || user.username,
      role: user.ROLE || user.role,
      id_prestatario: user.ID_PRESTATARIO || user.id_prestatario || null,
      id_empleado: user.ID_EMPLEADO || user.id_empleado || null,
    };

    const token = jwt.sign(
      payload,
      process.env.JWT_SECRET || 'dev_secret',
      { expiresIn: process.env.JWT_EXPIRY || '1h' },
    );

    return token;
  },

  // Crear usuario nuevo (hash password) — uso administrativo.
  createUser: async (username, password, role = 'EMPLEADO') => {
    const saltRounds = getSaltRounds();
    const hash = await bcrypt.hash(password, saltRounds);
    return usersModel.createUser(username, hash, role);
  },

  /**
   * Registro completo de prestatario + usuario.
   * Inserta en PRESTATARIOS y USUARIOS en una misma transacción.
   */
  registerPrestatario: async ({ username, password, prestatario }) => {
    if (!username || !password || !prestatario) {
      const err = new Error('username, password y datos de prestatario son requeridos');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const required = ['ci', 'nombre', 'apellido', 'direccion', 'email', 'telefono', 'fecha_nacimiento', 'estado_cliente', 'usuario_registro'];
    for (const f of required) {
      if (!prestatario[f]) {
        const err = new Error(`Campo requerido faltante en prestatario: ${f}`);
        err.code = 'VALIDATION_ERROR';
        throw err;
      }
    }

    const conn = await getConnection();
    try {
      const saltRounds = getSaltRounds();
      const hash = await bcrypt.hash(password, saltRounds);

      // 1) Insertar prestatario y obtener id_prestatario
      let id_prestatario;
      try {
        const sql = `INSERT INTO PRESTATARIOS (
            ci, nombre, apellido, direccion, email, telefono, fecha_nacimiento,
            estado_cliente, fecha_registro, usuario_registro
          ) VALUES (
            :ci, :nombre, :apellido, :direccion, :email, :telefono,
            TO_DATE(:fecha_nacimiento, 'YYYY-MM-DD'),
            :estado_cliente, SYSDATE, :usuario_registro
          )
          RETURNING id_prestatario INTO :id_out`;

        const binds = {
          ci: Number(prestatario.ci),
          nombre: prestatario.nombre,
          apellido: prestatario.apellido,
          direccion: prestatario.direccion,
          email: prestatario.email,
          telefono: prestatario.telefono,
          fecha_nacimiento: prestatario.fecha_nacimiento,
          estado_cliente: prestatario.estado_cliente,
          usuario_registro: prestatario.usuario_registro,
          id_out: { dir: oracledb.BIND_OUT, type: oracledb.NUMBER },
        };

        const result = await conn.execute(sql, binds, { autoCommit: false });
        id_prestatario = result.outBinds.id_out[0];
      } catch (err) {
        // ORA-00001 unique constraint violated (CI duplicada, etc.)
        if (err && err.errorNum === 1) {
          const e = new Error('La cédula ya está registrada');
          e.code = 'DUP_CI';
          throw e;
        }
        throw err;
      }

      // 2) Crear usuario vinculado al prestatario
      try {
        await usersModel.createUserWithConnection(conn, username, hash, 'PRESTATARIO', id_prestatario, null);
      } catch (err) {
        if (err && err.errorNum === 1) {
          const e = new Error('El nombre de usuario ya existe');
          e.code = 'DUP_USERNAME';
          throw e;
        }
        throw err;
      }

      await conn.commit();

      // Cargar prestatario completo usando el modelo estándar (otra conexión)
      const prestatarioDb = await prestatariosModel.getByCedula(prestatario.ci);

      return {
        user: {
          username,
          role: 'PRESTATARIO',
          id_prestatario,
        },
        prestatario: prestatarioDb,
      };
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore rollback errors
      }
      throw err;
    } finally {
      try {
        await conn.close();
      } catch {
        // ignore close errors
      }
    }
  },

  /**
   * Registro completo de empleado + usuario.
   * Inserta en EMPLEADOS y USUARIOS en una misma transacción.
   */
  registerEmpleado: async ({ username, password, empleado }) => {
    if (!username || !password || !empleado) {
      const err = new Error('username, password y datos de empleado son requeridos');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    if (!empleado.nombre || !empleado.apellido) {
      const err = new Error('Campos obligatorios faltantes en empleado: nombre, apellido');
      err.code = 'VALIDATION_ERROR';
      throw err;
    }

    const conn = await getConnection();
    try {
      const saltRounds = getSaltRounds();
      const hash = await bcrypt.hash(password, saltRounds);

      // 1) Insertar empleado y obtener id_empleado
      let id_empleado;
      try {
        id_empleado = await empleadosModel.createEmpleadoWithConnection(conn, empleado);
      } catch (err) {
        // ORA-00001 unique constraint violated (si hubiera alguna constraint relevante)
        if (err && err.errorNum === 1) {
          const e = new Error('Error de duplicidad al crear empleado');
          e.code = 'DUP_EMPLEADO';
          throw e;
        }
        throw err;
      }

      // 2) Crear usuario vinculado al empleado
      try {
        await usersModel.createUserWithConnection(conn, username, hash, 'EMPLEADO', null, id_empleado);
      } catch (err) {
        if (err && err.errorNum === 1) {
          const e = new Error('El nombre de usuario ya existe');
          e.code = 'DUP_USERNAME';
          throw e;
        }
        throw err;
      }

      await conn.commit();

      // Cargar empleado completo usando el modelo estándar (otra conexión)
      const empleadoDb = await empleadosModel.getEmpleadoById(id_empleado);

      return {
        user: {
          username,
          role: 'EMPLEADO',
          id_empleado,
        },
        empleado: empleadoDb,
      };
    } catch (err) {
      try {
        await conn.rollback();
      } catch {
        // ignore rollback errors
      }
      throw err;
    } finally {
      try {
        await conn.close();
      } catch {
        // ignore
      }
    }
  },
};
