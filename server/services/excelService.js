const fs = require('fs');
const path = require('path');
const ExcelJS = require('exceljs');
const { getDataRoot } = require('../paths');

const DB_DIR = path.join(getDataRoot(), 'dados');
const DB_PATH = path.join(DB_DIR, 'banco.xlsx');
const BACKUP_DIR = path.join(DB_DIR, 'backups');

const DEFAULT_CONFIG = {
  RazaoSocial: 'CLÍNICA PIERRO LTDA',
  CNPJ: '51.879.500/0001-86',
  Endereco: 'Rua Bernardino de Campos, 804',
  Bairro: 'Centro',
  CidadeUf: 'Campinas/SP',
  Cep: '13.010-150',
  Telefone: '(19) 3733-4333',
  HospitalNome: 'Santa Tereza Hospital e Maternidade',
  Medico: 'Dr. Jefferson Cauz Caminoto',
  CRM: 'CRM-SP 78.266',
  Especialidade: 'Médico do Trabalho',
  RQE: 'RQE Nº 80.149',
  IconeMedico: 'medical_services'
};

const DEFAULT_GRUPOS_RISCO = [
  { Nome: 'Biológico', Cor: '#D93025', Ordem: 1 },
  { Nome: 'Físico', Cor: '#1A73E8', Ordem: 2 },
  { Nome: 'Químico', Cor: '#F9AB00', Ordem: 3 },
  { Nome: 'Ergonômico', Cor: '#188038', Ordem: 4 },
  { Nome: 'Acidente', Cor: '#7030A0', Ordem: 5 }
];

const DEFAULT_TIPOS_EXAME = [
  { Chave: 'admissional', Nome: 'Admissional', Ordem: 1 },
  { Chave: 'periodico', Nome: 'Periódico', Ordem: 2 },
  { Chave: 'retorno', Nome: 'Retorno ao Trabalho', Ordem: 3 },
  { Chave: 'mudanca', Nome: 'Mudança de Função', Ordem: 4 },
  { Chave: 'demissional', Nome: 'Demissional', Ordem: 5 }
];

const DEFAULT_EXAMES = [
  { Nome: 'Hemograma completo', Ordem: 1 },
  { Nome: 'Sorologia B e C', Ordem: 2 },
  { Nome: 'VDRL', Ordem: 3 },
  { Nome: 'Protoparasitológico', Ordem: 4 },
  { Nome: 'Coprocultura', Ordem: 5 },
  { Nome: 'Micológico de unha', Ordem: 6 }
];

const SCHEMAS = {
  Setores: ['ID', 'Nome'],
  Cargos: ['ID', 'Nome'],
  Riscos: ['ID', 'Grupo', 'Descricao'],
  GruposRisco: ['ID', 'Nome', 'Cor', 'Ordem'],
  Cargo_Risco: ['ID', 'CargoID', 'RiscoID'],
  Cargo_Exame: ['ID', 'CargoID', 'ExameID'],
  Funcionarios: ['ID', 'Nome', 'CPF', 'DataNascimento', 'SetorID', 'CargoID'],
  HistoricoPDF: [
    'ID', 'Nome', 'CPF', 'DataNascimento', 'Cargo', 'Setor',
    'DataGeracao', 'ArquivoPDF', 'TipoExame', 'CargoID', 'SetorID',
    'Conclusao', 'ExamesDatas', 'DataAvaliacaoClinica', 'RiscosSnapshot', 'DocumentoSnapshot'
  ],
  ConfigGeral: [
    'ID', 'RazaoSocial', 'CNPJ', 'Endereco', 'Bairro', 'CidadeUf', 'Cep', 'Telefone',
    'HospitalNome', 'Medico', 'CRM', 'Especialidade', 'RQE', 'IconeMedico'
  ],
  TiposExame: ['ID', 'Chave', 'Nome', 'Ordem'],
  ExamesComplementares: ['ID', 'Nome', 'Ordem']
};

let queue = Promise.resolve();
function withLock(fn) {
  const run = queue.then(() => fn());
  queue = run.then(() => {}, () => {});
  return run;
}

function extractCellValue(cell) {
  const v = cell.value;
  if (v === null || v === undefined) return '';
  if (typeof v === 'object') {
    if (Array.isArray(v.richText)) return v.richText.map(rt => rt.text).join('');
    if (v.hyperlink !== undefined) return v.text !== undefined ? v.text : v.hyperlink;
    if (v.result !== undefined) return v.result;
    if (v.text !== undefined) return v.text;
    if (v instanceof Date) return v;
    return '';
  }
  return v;
}

function getSheetOrThrow(wb, sheetName) {
  const sheet = wb.getWorksheet(sheetName);
  if (!sheet) {
    const nomes = wb.worksheets.map(w => w.name).join(', ');
    throw new Error(
      `A planilha "${sheetName}" não foi encontrada no banco.xlsx (planilhas existentes: ${nomes || 'nenhuma'}). ` +
      'Feche o arquivo no Excel e tente novamente, ou apague /dados/banco.xlsx para recriá-lo.'
    );
  }
  return sheet;
}

function sheetToObjects(sheet, headers) {
  const rows = [];
  sheet.eachRow((row, rowNumber) => {
    if (rowNumber === 1) return;
    const obj = {};
    headers.forEach((h, idx) => {
      obj[h] = extractCellValue(row.getCell(idx + 1));
    });
    if (Object.values(obj).some(v => v !== '' && v !== null && v !== undefined)) {
      obj.__rowNumber = rowNumber;
      rows.push(obj);
    }
  });
  return rows;
}

function addSheetWithHeaders(wb, sheetName) {
  const sheet = wb.addWorksheet(sheetName);
  sheet.addRow(SCHEMAS[sheetName]);
  sheet.getRow(1).font = { bold: true };
  return sheet;
}

function seedDefaults(wb) {
  const cfg = wb.getWorksheet('ConfigGeral');
  if (cfg && sheetToObjects(cfg, SCHEMAS.ConfigGeral).length === 0) {
    cfg.addRow([1, ...SCHEMAS.ConfigGeral.slice(1).map(h => DEFAULT_CONFIG[h] || '')]);
  }

  const tipos = wb.getWorksheet('TiposExame');
  if (tipos && sheetToObjects(tipos, SCHEMAS.TiposExame).length === 0) {
    DEFAULT_TIPOS_EXAME.forEach((t, i) => {
      tipos.addRow([i + 1, t.Chave, t.Nome, t.Ordem]);
    });
  }

  const exames = wb.getWorksheet('ExamesComplementares');
  if (exames && sheetToObjects(exames, SCHEMAS.ExamesComplementares).length === 0) {
    DEFAULT_EXAMES.forEach((e, i) => {
      exames.addRow([i + 1, e.Nome, e.Ordem]);
    });
  }

  const grupos = wb.getWorksheet('GruposRisco');
  if (grupos && sheetToObjects(grupos, SCHEMAS.GruposRisco).length === 0) {
    DEFAULT_GRUPOS_RISCO.forEach((grupo, i) => grupos.addRow([i + 1, grupo.Nome, grupo.Cor, grupo.Ordem]));
  }
}

async function ensureDb() {
  if (!fs.existsSync(DB_DIR)) fs.mkdirSync(DB_DIR, { recursive: true });

  if (!fs.existsSync(DB_PATH)) {
    const wb = new ExcelJS.Workbook();
    for (const sheetName of Object.keys(SCHEMAS)) {
      addSheetWithHeaders(wb, sheetName);
    }
    seedDefaults(wb);
    await writeWorkbook(wb);
    console.log('Banco de dados criado em', DB_PATH);
    return;
  }

  // Migra planilhas novas / colunas novas em bancos antigos
  await withLock(async () => {
    const wb = new ExcelJS.Workbook();
    await wb.xlsx.readFile(DB_PATH);
    let changed = false;
    for (const sheetName of Object.keys(SCHEMAS)) {
      if (!wb.getWorksheet(sheetName)) {
        addSheetWithHeaders(wb, sheetName);
        changed = true;
      } else if (syncSheetHeaders(wb.getWorksheet(sheetName), SCHEMAS[sheetName])) {
        changed = true;
      }
    }
    const beforeCfg = sheetToObjects(getSheetOrThrow(wb, 'ConfigGeral'), SCHEMAS.ConfigGeral).length;
    const beforeTipos = sheetToObjects(getSheetOrThrow(wb, 'TiposExame'), SCHEMAS.TiposExame).length;
    const beforeEx = sheetToObjects(getSheetOrThrow(wb, 'ExamesComplementares'), SCHEMAS.ExamesComplementares).length;
    seedDefaults(wb);
    const afterCfg = sheetToObjects(getSheetOrThrow(wb, 'ConfigGeral'), SCHEMAS.ConfigGeral).length;
    const afterTipos = sheetToObjects(getSheetOrThrow(wb, 'TiposExame'), SCHEMAS.TiposExame).length;
    const afterEx = sheetToObjects(getSheetOrThrow(wb, 'ExamesComplementares'), SCHEMAS.ExamesComplementares).length;
    if (changed || beforeCfg !== afterCfg || beforeTipos !== afterTipos || beforeEx !== afterEx) {
      await writeWorkbook(wb);
      console.log('Banco migrado/atualizado em', DB_PATH);
    }
  });
}

/** Acrescenta colunas faltantes no cabeçalho (migração suave). */
function syncSheetHeaders(sheet, expectedHeaders) {
  const headerRow = sheet.getRow(1);
  const current = [];
  headerRow.eachCell({ includeEmpty: false }, (cell, col) => {
    current[col - 1] = String(extractCellValue(cell) || '').trim();
  });
  let changed = false;
  expectedHeaders.forEach((h, idx) => {
    const cell = headerRow.getCell(idx + 1);
    if (String(extractCellValue(cell) || '').trim() !== h) {
      cell.value = h;
      changed = true;
    }
  });
  if (changed) headerRow.font = { bold: true };
  return changed;
}

async function readWorkbook() {
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.readFile(DB_PATH);
  return wb;
}

async function writeWorkbook(wb) {
  const stamp = new Date().toISOString().replace(/[:.]/g, '-');
  const tempPath = path.join(DB_DIR, `banco.${process.pid}.${stamp}.tmp.xlsx`);

  // O ExcelJS nunca grava diretamente sobre o arquivo em uso: primeiro gera uma
  // cópia íntegra temporária e só então troca o banco.
  await wb.xlsx.writeFile(tempPath);
  try {
    if (fs.existsSync(DB_PATH)) {
      if (!fs.existsSync(BACKUP_DIR)) fs.mkdirSync(BACKUP_DIR, { recursive: true });
      fs.copyFileSync(DB_PATH, path.join(BACKUP_DIR, `banco-${stamp}.xlsx`));
    }
    await fs.promises.rename(tempPath, DB_PATH);
  } catch (err) {
    // A falha preserva o banco anterior e deixa explícito que a gravação não ocorreu.
    if (fs.existsSync(tempPath)) fs.unlinkSync(tempPath);
    throw err;
  }
}

async function getAll(sheetName) {
  return withLock(async () => {
    const wb = await readWorkbook();
    const sheet = getSheetOrThrow(wb, sheetName);
    const headers = SCHEMAS[sheetName];
    return sheetToObjects(sheet, headers);
  });
}

async function getById(sheetName, id) {
  const rows = await getAll(sheetName);
  return rows.find(r => String(r.ID) === String(id));
}

async function insert(sheetName, data) {
  return withLock(async () => {
    const wb = await readWorkbook();
    const sheet = getSheetOrThrow(wb, sheetName);
    const headers = SCHEMAS[sheetName];
    const existing = sheetToObjects(sheet, headers);
    const nextId = existing.reduce((max, r) => Math.max(max, Number(r.ID) || 0), 0) + 1;
    const rowValues = headers.map(h => (h === 'ID' ? nextId : (data[h] !== undefined ? data[h] : '')));
    sheet.addRow(rowValues);
    await writeWorkbook(wb);
    const result = { ID: nextId };
    headers.forEach(h => { if (h !== 'ID') result[h] = data[h] !== undefined ? data[h] : ''; });
    return result;
  });
}

async function update(sheetName, id, data) {
  return withLock(async () => {
    const wb = await readWorkbook();
    const sheet = getSheetOrThrow(wb, sheetName);
    const headers = SCHEMAS[sheetName];
    let updated = null;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (String(row.getCell(1).value) === String(id)) {
        headers.forEach((h, idx) => {
          if (h === 'ID') return;
          if (data[h] !== undefined) row.getCell(idx + 1).value = data[h];
        });
        updated = { ID: Number(id) };
        headers.forEach((h, idx) => { if (h !== 'ID') updated[h] = extractCellValue(row.getCell(idx + 1)); });
      }
    });
    if (updated) await writeWorkbook(wb);
    return updated;
  });
}

async function remove(sheetName, id) {
  return withLock(async () => {
    const wb = await readWorkbook();
    const sheet = getSheetOrThrow(wb, sheetName);
    let rowToDelete = null;
    sheet.eachRow((row, rowNumber) => {
      if (rowNumber === 1) return;
      if (String(row.getCell(1).value) === String(id)) rowToDelete = rowNumber;
    });
    if (rowToDelete) {
      sheet.spliceRows(rowToDelete, 1);
      await writeWorkbook(wb);
      return true;
    }
    return false;
  });
}

async function getRiscosByCargo(cargoId) {
  const rows = await getAll('Cargo_Risco');
  return rows.filter(r => String(r.CargoID) === String(cargoId)).map(r => String(r.RiscoID));
}

async function setRiscosForCargo(cargoId, riscoIds) {
  return withLock(async () => {
    const wb = await readWorkbook();
    const sheet = getSheetOrThrow(wb, 'Cargo_Risco');
    const headers = SCHEMAS.Cargo_Risco;
    const existing = sheetToObjects(sheet, headers);

    const rowsToRemove = existing
      .filter(r => String(r.CargoID) === String(cargoId))
      .map(r => r.__rowNumber)
      .sort((a, b) => b - a);
    rowsToRemove.forEach(rn => sheet.spliceRows(rn, 1));

    const remaining = sheetToObjects(sheet, headers);
    let nextId = remaining.reduce((max, r) => Math.max(max, Number(r.ID) || 0), 0) + 1;

    riscoIds.forEach(riscoId => {
      sheet.addRow([nextId, Number(cargoId), Number(riscoId)]);
      nextId++;
    });

    await writeWorkbook(wb);
    return true;
  });
}

async function getExamesByCargo(cargoId) {
  const rows = await getAll('Cargo_Exame');
  return rows.filter(r => String(r.CargoID) === String(cargoId)).map(r => String(r.ExameID));
}

async function setExamesForCargo(cargoId, exameIds) {
  return withLock(async () => {
    const wb = await readWorkbook();
    const sheet = getSheetOrThrow(wb, 'Cargo_Exame');
    const headers = SCHEMAS.Cargo_Exame;
    const existing = sheetToObjects(sheet, headers);
    const rowsToRemove = existing
      .filter(r => String(r.CargoID) === String(cargoId))
      .map(r => r.__rowNumber)
      .sort((a, b) => b - a);
    rowsToRemove.forEach(rn => sheet.spliceRows(rn, 1));

    const remaining = sheetToObjects(sheet, headers);
    let nextId = remaining.reduce((max, r) => Math.max(max, Number(r.ID) || 0), 0) + 1;
    [...new Set(exameIds.map(String))].forEach(exameId => {
      sheet.addRow([nextId++, Number(cargoId), Number(exameId)]);
    });
    await writeWorkbook(wb);
    return true;
  });
}

async function getConfig() {
  const rows = await getAll('ConfigGeral');
  if (!rows.length) return { ...DEFAULT_CONFIG, ID: 1 };
  const row = rows[0];
  return {
    ID: row.ID,
    RazaoSocial: row.RazaoSocial || DEFAULT_CONFIG.RazaoSocial,
    CNPJ: row.CNPJ || DEFAULT_CONFIG.CNPJ,
    Endereco: row.Endereco || DEFAULT_CONFIG.Endereco,
    Bairro: row.Bairro || DEFAULT_CONFIG.Bairro,
    CidadeUf: row.CidadeUf || DEFAULT_CONFIG.CidadeUf,
    Cep: row.Cep || DEFAULT_CONFIG.Cep,
    Telefone: row.Telefone || DEFAULT_CONFIG.Telefone,
    HospitalNome: row.HospitalNome || DEFAULT_CONFIG.HospitalNome,
    Medico: row.Medico || DEFAULT_CONFIG.Medico,
    CRM: row.CRM || DEFAULT_CONFIG.CRM,
    Especialidade: row.Especialidade || DEFAULT_CONFIG.Especialidade,
    RQE: row.RQE || DEFAULT_CONFIG.RQE,
    IconeMedico: row.IconeMedico || DEFAULT_CONFIG.IconeMedico
  };
}

async function saveConfig(data) {
  const rows = await getAll('ConfigGeral');
  const payload = {};
  SCHEMAS.ConfigGeral.slice(1).forEach(h => {
    if (data[h] !== undefined) payload[h] = data[h];
  });
  if (!rows.length) {
    return insert('ConfigGeral', { ...DEFAULT_CONFIG, ...payload });
  }
  return update('ConfigGeral', rows[0].ID, payload);
}

async function getTiposExame() {
  const rows = await getAll('TiposExame');
  return rows.sort((a, b) => Number(a.Ordem) - Number(b.Ordem));
}

async function getExamesComplementares() {
  const rows = await getAll('ExamesComplementares');
  return rows.sort((a, b) => Number(a.Ordem) - Number(b.Ordem));
}

async function getGruposRisco() {
  const rows = await getAll('GruposRisco');
  return rows.sort((a, b) => Number(a.Ordem) - Number(b.Ordem));
}

async function getUsage(sheetName, id) {
  const equalsId = (row, field) => String(row[field]) === String(id);
  const usage = [];

  if (sheetName === 'Setores') {
    const [funcionarios, historico] = await Promise.all([getAll('Funcionarios'), getAll('HistoricoPDF')]);
    const funcs = funcionarios.filter(r => equalsId(r, 'SetorID')).length;
    const hist = historico.filter(r => equalsId(r, 'SetorID')).length;
    if (funcs) usage.push(`${funcs} funcionário(s)`);
    if (hist) usage.push(`${hist} registro(s) no histórico`);
  }

  if (sheetName === 'Cargos') {
    const [funcionarios, historico, vinculos, examesVinculados] = await Promise.all([
      getAll('Funcionarios'), getAll('HistoricoPDF'), getAll('Cargo_Risco'), getAll('Cargo_Exame')
    ]);
    const funcs = funcionarios.filter(r => equalsId(r, 'CargoID')).length;
    const hist = historico.filter(r => equalsId(r, 'CargoID')).length;
    const links = vinculos.filter(r => equalsId(r, 'CargoID')).length;
    const exames = examesVinculados.filter(r => equalsId(r, 'CargoID')).length;
    if (funcs) usage.push(`${funcs} funcionário(s)`);
    if (links) usage.push(`${links} vínculo(s) com riscos`);
    if (exames) usage.push(`${exames} vínculo(s) com exames`);
    if (hist) usage.push(`${hist} registro(s) no histórico`);
  }

  if (sheetName === 'Riscos') {
    const vinculos = await getAll('Cargo_Risco');
    const links = vinculos.filter(r => equalsId(r, 'RiscoID')).length;
    if (links) usage.push(`${links} vínculo(s) com cargos`);
  }

  if (sheetName === 'ExamesComplementares') {
    const vinculos = await getAll('Cargo_Exame');
    const links = vinculos.filter(r => equalsId(r, 'ExameID')).length;
    if (links) usage.push(`${links} vínculo(s) com cargos`);
  }

  return usage;
}

module.exports = {
  DB_PATH,
  DB_DIR,
  SCHEMAS,
  DEFAULT_CONFIG,
  ensureDb,
  getAll,
  getById,
  insert,
  update,
  remove,
  getRiscosByCargo,
  setRiscosForCargo,
  getExamesByCargo,
  setExamesForCargo,
  getConfig,
  saveConfig,
  getTiposExame,
  getExamesComplementares,
  getGruposRisco,
  getUsage
};
