const oracledb = require("oracledb");

module.exports = {
  init: async () => {
    await oracledb.createPool({
      user: process.env.DB_USER,
      password: process.env.DB_PASS,
      connectString: `${process.env.DB_HOST}:${process.env.DB_PORT}/${process.env.DB_SERVICE}`,
    });
  },
  getConnection: async () => {
    return oracledb.getConnection();
  },
  close: async () => {
    try {
      await oracledb.getPool().close(10);
    } catch (err) {
      // ignore when pool not initialized yet
    }
  },
};
