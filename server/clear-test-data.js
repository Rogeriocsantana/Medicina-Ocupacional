const db = require('./services/mysqlService');
const { runMigrations } = require('./services/migrationService');

async function clearTestData() {
  if (process.env.CONFIRM_CLEAR_TEST_DATA !== 'SIM') {
    throw new Error('Limpeza cancelada. Defina CONFIRM_CLEAR_TEST_DATA=SIM para confirmar.');
  }
  await runMigrations(db.pool);
  await db.withTransaction(async connection => {
    await connection.query('DELETE FROM importacoes_funcionarios');
    await connection.query('DELETE FROM historico_aso');
    await connection.query('DELETE FROM funcionarios');
    await connection.query('DELETE FROM cargo_risco');
    await connection.query('DELETE FROM cargo_exame');
    await connection.query('DELETE FROM riscos');
    await connection.query('DELETE FROM setores');
    await connection.query('DELETE FROM cargos');
  });
  console.log('Dados de teste removidos. Empresas e configurações institucionais foram preservadas.');
}

clearTestData()
  .finally(() => db.close())
  .catch(error => {
    console.error(error.message);
    process.exitCode = 1;
  });
