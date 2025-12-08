const { init, getConnection, close } = require('./src/config/oracle');
const oracledb = require('oracledb');
(async ()=>{
  try {
    await init();
    const conn = await getConnection();
    const id = Number(process.argv[2]);
    const r = await conn.execute(
      SELECT id_cuota FROM cuotas WHERE id_prestamo = :id ORDER BY nro_cuota,
      { id },
      { outFormat: oracledb.OUT_FORMAT_OBJECT }
    );
    console.log(JSON.stringify(r.rows || []));
    await conn.close();
    await close();
  } catch (e) { console.error(e); process.exit(1) }
})();
