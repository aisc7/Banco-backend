require("dotenv").config({ path: __dirname + "/../.env" });
const app = require("./app");
const db = require("./config/oracle");   

const PORT = process.env.PORT || 3000;

(async () => {
  try {
    console.log("🔵 Iniciando pool de Oracle...");
    await db.init();

    // 🔥 Test real de conexión
    const conn = await db.getConnection();
    const result = await conn.execute("SELECT USER FROM dual");
    console.log("Usuario conectado desde Node:", result.rows);
    await conn.close();

    // Iniciar servidor
    app.listen(PORT, () => {
      console.log(`LoanSphere backend listening on port ${PORT}`);
    });

  } catch (err) {
    console.error("🔴 Error al iniciar el servidor o conectar a Oracle:", err);
    process.exit(1);
  }
})();
