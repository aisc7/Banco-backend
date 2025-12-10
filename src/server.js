require("dotenv").config({ path: __dirname + "/../.env" });
const app = require("./app");
const db = require("./config/oracle");   

// Puerto robusto: si PORT no es numérico, usar 3000
const PORT = (() => {
  const p = Number(process.env.PORT);
  return Number.isFinite(p) && p >= 0 && p < 65536 ? p : 3000;
})();

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

    // DEV-ONLY: tarea periódica para actualizar cuotas vencidas en tiempo real
    if ((process.env.NODE_ENV || 'development') !== 'production') {
      const { marcarVencidasDev } = require('./models/cuotas.model');
      const intervalMs = Number(process.env.CUOTAS_DEV_MARK_INTERVAL_MS || '60000'); // por defecto 60s
      console.log(`⏱️ Scheduler dev activo: marcar vencidas cada ${intervalMs} ms`);
      setInterval(async () => {
        try {
          const r = await marcarVencidasDev();
          if (r && typeof r.updated === 'number' && r.updated > 0) {
            console.log(`⚙️ Dev: cuotas vencidas actualizadas: ${r.updated}`);
          }
        } catch (e) {
          console.warn('Dev scheduler marcarVencidas error:', e && e.message);
        }
      }, intervalMs);
    }

  } catch (err) {
    console.error("🔴 Error al iniciar el servidor o conectar a Oracle:", err);
    process.exit(1);
  }
})();
