const fs = require('fs');
const path = require('path');
const { getResourceRoot } = require('../paths');

function splitStatements(sql) {
  return sql
    .replace(/^\s*--.*$/gm, '')
    .split(';')
    .map(statement => statement.trim())
    .filter(Boolean)
    .filter(statement => !/^USE\s+/i.test(statement));
}

async function runMigrations(pool) {
  const [migrationTables] = await pool.query("SHOW TABLES LIKE 'schema_migrations'");
  if (!migrationTables.length) {
    await pool.query(`CREATE TABLE schema_migrations (
      versao VARCHAR(50) NOT NULL PRIMARY KEY,
      aplicado_em TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP
    ) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4 COLLATE=utf8mb4_unicode_ci`);
  }

  const [coreTables] = await pool.query("SHOW TABLES LIKE 'funcionarios'");
  if (!coreTables.length) {
    const initialSchema = path.join(getResourceRoot(), 'database', 'mysql-schema.sql');
    if (!fs.existsSync(initialSchema)) throw new Error('Arquivo do esquema inicial MySQL não encontrado.');
    for (const statement of splitStatements(fs.readFileSync(initialSchema, 'utf8'))) {
      await pool.query(statement);
    }
  }

  const migrationDir = path.join(getResourceRoot(), 'database', 'migrations');
  if (!fs.existsSync(migrationDir)) return [];

  const files = fs.readdirSync(migrationDir)
    .filter(file => /^\d+_.+\.(sql|js)$/i.test(file))
    .sort((a, b) => a.localeCompare(b));
  const [appliedRows] = await pool.query('SELECT versao FROM schema_migrations');
  const applied = new Set(appliedRows.map(row => row.versao));
  const executed = [];

  for (const file of files) {
    const version = path.parse(file).name;
    if (applied.has(version)) continue;
    const connection = await pool.getConnection();
    try {
      await connection.beginTransaction();
      const migrationPath = path.join(migrationDir, file);
      if (/\.js$/i.test(file)) {
        delete require.cache[require.resolve(migrationPath)];
        const executeMigration = require(migrationPath);
        if (typeof executeMigration !== 'function') {
          throw new Error('Migração JavaScript deve exportar uma função.');
        }
        await executeMigration(connection);
      } else {
        const sql = fs.readFileSync(migrationPath, 'utf8');
        for (const statement of splitStatements(sql)) {
          await connection.query(statement);
        }
      }
      await connection.query(
        'INSERT IGNORE INTO schema_migrations (versao) VALUES (?)',
        [version]
      );
      await connection.commit();
      executed.push(version);
    } catch (error) {
      await connection.rollback();
      error.message = `Falha na migração ${version}: ${error.message}`;
      throw error;
    } finally {
      connection.release();
    }
  }
  return executed;
}

module.exports = { runMigrations, splitStatements };
