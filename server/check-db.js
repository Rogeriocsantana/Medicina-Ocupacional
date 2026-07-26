const db = require('./services/mysqlService');

(async () => {
  try {
    await db.ensureDb();
    console.log(`Conexão MySQL validada: ${db.DB_DESCRIPTION}`);
  } finally {
    await db.close();
  }
})().catch(err => {
  console.error('Falha na validação do MySQL:', err.message);
  process.exit(1);
});
