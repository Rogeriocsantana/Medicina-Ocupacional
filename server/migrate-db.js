const db = require('./services/mysqlService');
const { runMigrations } = require('./services/migrationService');

runMigrations(db.pool)
  .then(migrations => {
    console.log(migrations.length ? `Migrações aplicadas: ${migrations.join(', ')}` : 'Banco já está atualizado.');
  })
  .finally(() => db.close())
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
