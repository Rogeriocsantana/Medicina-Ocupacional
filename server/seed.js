// Script utilitário para popular o banco.xlsx com dados de teste conhecidos.
// Uso: npm run seed
// ATENÇÃO: isto APAGA o banco.xlsx atual e recria do zero com os dados de teste abaixo.

const fs = require('fs');
const db = require('./services/excelService');

async function seed() {
  if (fs.existsSync(db.DB_PATH)) {
    fs.unlinkSync(db.DB_PATH);
    console.log('banco.xlsx anterior removido.');
  }

  await db.ensureDb();

  const setor = await db.insert('Setores', { Nome: 'Informatica' });
  const cargo = await db.insert('Cargos', { Nome: 'Analista de Sistema' });
  const riscoErgonomico = await db.insert('Riscos', { Grupo: 'Ergonômico', Descricao: 'teste' });
  const riscoFisico = await db.insert('Riscos', { Grupo: 'Físico', Descricao: 'teste2' });
  await db.setRiscosForCargo(cargo.ID, [riscoErgonomico.ID, riscoFisico.ID]);

  console.log('Banco de dados de teste recriado com sucesso:');
  console.log('  Setor:', setor);
  console.log('  Cargo:', cargo);
  console.log('  Riscos:', riscoErgonomico, riscoFisico);
}

seed().catch(err => {
  console.error('Erro ao popular banco de teste:', err);
  process.exit(1);
});
