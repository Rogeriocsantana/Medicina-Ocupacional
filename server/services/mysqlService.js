const mysql = require('mysql2/promise');
require('../config');
const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);

const DB_CONFIG = {
  host: process.env.DB_HOST || 'mysql',
  port: Number(process.env.DB_PORT || 3306),
  user: process.env.DB_USER || 'hst',
  password: process.env.DB_PASSWORD || '',
  database: process.env.DB_NAME || 'medicina_db',
  charset: 'utf8mb4',
  waitForConnections: true,
  connectionLimit: Number(process.env.DB_CONNECTION_LIMIT || 10),
  queueLimit: 0,
  dateStrings: true
};

const pool = mysql.createPool(DB_CONFIG);
const DB_DESCRIPTION = `mysql://${DB_CONFIG.host}:${DB_CONFIG.port}/${DB_CONFIG.database}`;

const DEFAULT_CONFIG = {
  RazaoSocial: '',
  CNPJ: '',
  Endereco: '',
  Bairro: '',
  CidadeUf: '',
  Cep: '',
  Telefone: '',
  HospitalNome: 'Santa Tereza Hospital e Maternidade',
  Medico: 'Dr. Jefferson Cauz Caminoto',
  CRM: 'CRM-SP 78.266',
  Especialidade: 'Médico do Trabalho',
  RQE: 'RQE Nº 80.149',
  IconeMedico: 'medical_services'
};

const SCHEMAS = {
  Setores: ['ID', 'Nome'],
  Cargos: ['ID', 'Nome'],
  Riscos: ['ID', 'Grupo', 'Descricao'],
  GruposRisco: ['ID', 'Nome', 'Cor', 'Ordem'],
  Cargo_Risco: ['ID', 'CargoID', 'RiscoID'],
  Cargo_Exame: ['ID', 'CargoID', 'ExameID'],
  Empresas: ['ID', 'RazaoSocial', 'CNPJ', 'Endereco', 'Bairro', 'CidadeUf', 'Cep', 'Telefone'],
  Funcionarios: ['ID', 'Nome', 'CPF', 'DataNascimento', 'SetorID', 'CargoID', 'EmpresaID'],
  HistoricoPDF: [
    'ID', 'Nome', 'CPF', 'DataNascimento', 'Cargo', 'Setor',
    'DataGeracao', 'ArquivoPDF', 'TipoExame', 'CargoID', 'SetorID',
    'Conclusao', 'ExamesDatas', 'DataAvaliacaoClinica', 'RiscosSnapshot',
    'DocumentoSnapshot', 'EmpresaID', 'Empresa'
  ],
  ConfigGeral: ['ID', 'HospitalNome', 'Medico', 'CRM', 'Especialidade', 'RQE', 'IconeMedico'],
  TiposExame: ['ID', 'Chave', 'Nome', 'Ordem'],
  ExamesComplementares: ['ID', 'Nome', 'Ordem']
};

const MODELS = {
  Setores: {
    table: 'setores',
    fields: { ID: 'id', Nome: 'nome' }
  },
  Cargos: {
    table: 'cargos',
    fields: { ID: 'id', Nome: 'nome' }
  },
  Empresas: {
    table: 'empresas',
    fields: {
      ID: 'id', RazaoSocial: 'razao_social', CNPJ: 'cnpj', Endereco: 'endereco',
      Bairro: 'bairro', CidadeUf: 'cidade_uf', Cep: 'cep', Telefone: 'telefone'
    }
  },
  GruposRisco: {
    table: 'grupos_risco',
    fields: { ID: 'id', Nome: 'nome', Cor: 'cor', Ordem: 'ordem' }
  },
  Cargo_Risco: {
    table: 'cargo_risco',
    fields: { ID: 'id', CargoID: 'cargo_id', RiscoID: 'risco_id' }
  },
  Cargo_Exame: {
    table: 'cargo_exame',
    fields: { ID: 'id', CargoID: 'cargo_id', ExameID: 'exame_id' }
  },
  ExamesComplementares: {
    table: 'exames_complementares',
    fields: { ID: 'id', Nome: 'nome', Ordem: 'ordem' }
  },
  TiposExame: {
    table: 'tipos_exame',
    fields: { ID: 'id', Chave: 'chave', Nome: 'nome', Ordem: 'ordem' }
  },
  Funcionarios: {
    table: 'funcionarios',
    fields: {
      ID: 'id', Nome: 'nome', CPF: 'cpf', DataNascimento: 'data_nascimento',
      SetorID: 'setor_id', CargoID: 'cargo_id', EmpresaID: 'empresa_id'
    }
  },
  HistoricoPDF: {
    table: 'historico_aso',
    fields: {
      ID: 'id', Nome: 'nome', CPF: 'cpf', DataNascimento: 'data_nascimento',
      Cargo: 'cargo', Setor: 'setor', DataGeracao: 'data_geracao',
      ArquivoPDF: 'arquivo_pdf', TipoExame: 'tipo_exame', CargoID: 'cargo_id',
      SetorID: 'setor_id', Conclusao: 'conclusao', ExamesDatas: 'exames_datas',
      DataAvaliacaoClinica: 'data_avaliacao_clinica', RiscosSnapshot: 'riscos_snapshot',
      DocumentoSnapshot: 'documento_snapshot', EmpresaID: 'empresa_id', Empresa: 'empresa'
    }
  },
  ConfigGeral: {
    table: 'config_geral',
    fields: {
      ID: 'id', HospitalNome: 'hospital_nome', Medico: 'medico', CRM: 'crm',
      Especialidade: 'especialidade', RQE: 'rqe', IconeMedico: 'icone_medico'
    }
  }
};

function modelOrThrow(sheetName) {
  const model = MODELS[sheetName];
  if (!model) throw new Error(`Entidade MySQL não mapeada: ${sheetName}`);
  return model;
}

function selectColumns(model, alias = '') {
  const prefix = alias ? `${alias}.` : '';
  return Object.entries(model.fields)
    .map(([api, column]) => `${prefix}\`${column}\` AS \`${api}\``)
    .join(', ');
}

function normalizeJsonOutput(sheetName, row) {
  if (sheetName !== 'HistoricoPDF' || !row) return row;
  if (row.DataGeracao && /^\d{4}-\d{2}-\d{2}/.test(String(row.DataGeracao))) {
    const parsed = dayjs(String(row.DataGeracao));
    if (parsed.isValid()) row.DataGeracao = parsed.format('DD/MM/YYYY HH:mm');
  }
  for (const field of ['ExamesDatas', 'RiscosSnapshot', 'DocumentoSnapshot']) {
    if (row[field] !== null && row[field] !== undefined && typeof row[field] === 'object') {
      row[field] = JSON.stringify(row[field]);
    }
  }
  return row;
}

function normalizeInput(sheetName, apiField, value) {
  if (sheetName === 'Funcionarios' && apiField === 'CPF') {
    return String(value || '').replace(/\D/g, '');
  }
  if (sheetName === 'HistoricoPDF' && apiField === 'CPF') {
    return String(value || '').replace(/\D/g, '');
  }
  if (sheetName === 'HistoricoPDF' && apiField === 'DataGeracao') {
    const parsed = dayjs(String(value || ''), 'DD/MM/YYYY HH:mm', true);
    return parsed.isValid() ? parsed.format('YYYY-MM-DD HH:mm:ss') : value;
  }
  if (sheetName === 'HistoricoPDF' &&
      ['ExamesDatas', 'RiscosSnapshot', 'DocumentoSnapshot'].includes(apiField)) {
    if (value === '' || value === undefined) return null;
    return typeof value === 'string' ? value : JSON.stringify(value);
  }
  if (value === '') return null;
  return value;
}

async function ensureDb() {
  const connection = await pool.getConnection();
  try {
    await connection.query('SELECT 1');
    const required = Object.values(MODELS).map(model => model.table);
    const [rows] = await connection.query(
      `SELECT table_name
         FROM information_schema.tables
        WHERE table_schema = ?`,
      [DB_CONFIG.database]
    );
    const existing = new Set(rows.map(row => row.TABLE_NAME || row.table_name));
    const missing = [...new Set(required)].filter(table => !existing.has(table));
    if (missing.length) {
      throw new Error(`Estrutura MySQL incompleta. Tabelas ausentes: ${missing.join(', ')}`);
    }
  } finally {
    connection.release();
  }
}

async function getAll(sheetName) {
  if (sheetName === 'Riscos') {
    const [rows] = await pool.query(
      `SELECT r.id AS ID, g.nome AS Grupo, r.descricao AS Descricao
         FROM riscos r
         JOIN grupos_risco g ON g.id = r.grupo_id
        ORDER BY r.id`
    );
    return rows;
  }
  const model = modelOrThrow(sheetName);
  const [rows] = await pool.query(
    `SELECT ${selectColumns(model)} FROM \`${model.table}\` ORDER BY \`id\``
  );
  return rows.map(row => normalizeJsonOutput(sheetName, row));
}

async function getById(sheetName, id) {
  if (sheetName === 'Riscos') {
    const [rows] = await pool.query(
      `SELECT r.id AS ID, g.nome AS Grupo, r.descricao AS Descricao
         FROM riscos r
         JOIN grupos_risco g ON g.id = r.grupo_id
        WHERE r.id = ?`,
      [id]
    );
    return rows[0] || null;
  }
  const model = modelOrThrow(sheetName);
  const [rows] = await pool.query(
    `SELECT ${selectColumns(model)} FROM \`${model.table}\` WHERE \`id\` = ?`,
    [id]
  );
  return normalizeJsonOutput(sheetName, rows[0] || null);
}

async function resolveGrupoId(connection, grupo) {
  const [rows] = await connection.query('SELECT id FROM grupos_risco WHERE nome = ?', [grupo]);
  if (!rows.length) throw new Error(`Grupo de risco não encontrado: ${grupo}`);
  return rows[0].id;
}

async function insert(sheetName, data) {
  if (sheetName === 'Riscos') {
    const connection = await pool.getConnection();
    try {
      const grupoId = await resolveGrupoId(connection, data.Grupo);
      const [result] = await connection.query(
        'INSERT INTO riscos (grupo_id, descricao) VALUES (?, ?)',
        [grupoId, data.Descricao]
      );
      return getById('Riscos', result.insertId);
    } finally {
      connection.release();
    }
  }

  const model = modelOrThrow(sheetName);
  const fields = Object.keys(data).filter(field => field !== 'ID' && model.fields[field]);
  if (!fields.length) throw new Error(`Nenhum campo válido para inserir em ${sheetName}.`);
  const columns = fields.map(field => `\`${model.fields[field]}\``).join(', ');
  const values = fields.map(field => normalizeInput(sheetName, field, data[field]));
  const placeholders = fields.map(() => '?').join(', ');
  const [result] = await pool.query(
    `INSERT INTO \`${model.table}\` (${columns}) VALUES (${placeholders})`,
    values
  );
  return getById(sheetName, result.insertId);
}

async function update(sheetName, id, data) {
  if (sheetName === 'Riscos') {
    const connection = await pool.getConnection();
    try {
      const sets = [];
      const values = [];
      if (data.Grupo !== undefined) {
        sets.push('grupo_id = ?');
        values.push(await resolveGrupoId(connection, data.Grupo));
      }
      if (data.Descricao !== undefined) {
        sets.push('descricao = ?');
        values.push(data.Descricao);
      }
      if (!sets.length) return getById(sheetName, id);
      values.push(id);
      const [result] = await connection.query(
        `UPDATE riscos SET ${sets.join(', ')} WHERE id = ?`,
        values
      );
      return result.affectedRows ? getById(sheetName, id) : null;
    } finally {
      connection.release();
    }
  }

  const model = modelOrThrow(sheetName);
  const fields = Object.keys(data).filter(field => field !== 'ID' && model.fields[field]);
  if (!fields.length) return getById(sheetName, id);
  const sets = fields.map(field => `\`${model.fields[field]}\` = ?`).join(', ');
  const values = fields.map(field => normalizeInput(sheetName, field, data[field]));
  values.push(id);
  const [result] = await pool.query(
    `UPDATE \`${model.table}\` SET ${sets} WHERE \`id\` = ?`,
    values
  );
  return result.affectedRows ? getById(sheetName, id) : null;
}

async function remove(sheetName, id) {
  if (sheetName === 'Riscos') {
    const [result] = await pool.query('DELETE FROM riscos WHERE id = ?', [id]);
    return result.affectedRows > 0;
  }
  const model = modelOrThrow(sheetName);
  const [result] = await pool.query(`DELETE FROM \`${model.table}\` WHERE \`id\` = ?`, [id]);
  return result.affectedRows > 0;
}

async function getRiscosByCargo(cargoId) {
  const [rows] = await pool.query(
    'SELECT risco_id FROM cargo_risco WHERE cargo_id = ? ORDER BY id',
    [cargoId]
  );
  return rows.map(row => String(row.risco_id));
}

async function setRiscosForCargo(cargoId, riscoIds) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM cargo_risco WHERE cargo_id = ?', [cargoId]);
    for (const riscoId of [...new Set((riscoIds || []).map(String))]) {
      await connection.query(
        'INSERT INTO cargo_risco (cargo_id, risco_id) VALUES (?, ?)',
        [cargoId, riscoId]
      );
    }
    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getExamesByCargo(cargoId) {
  const [rows] = await pool.query(
    'SELECT exame_id FROM cargo_exame WHERE cargo_id = ? ORDER BY id',
    [cargoId]
  );
  return rows.map(row => String(row.exame_id));
}

async function setExamesForCargo(cargoId, exameIds) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    await connection.query('DELETE FROM cargo_exame WHERE cargo_id = ?', [cargoId]);
    for (const exameId of [...new Set((exameIds || []).map(String))]) {
      await connection.query(
        'INSERT INTO cargo_exame (cargo_id, exame_id) VALUES (?, ?)',
        [cargoId, exameId]
      );
    }
    await connection.commit();
    return true;
  } catch (err) {
    await connection.rollback();
    throw err;
  } finally {
    connection.release();
  }
}

async function getConfig() {
  const row = await getById('ConfigGeral', 1);
  return { ...DEFAULT_CONFIG, ...(row || {}), ID: 1 };
}

async function saveConfig(data) {
  const payload = {
    HospitalNome: data.HospitalNome ?? DEFAULT_CONFIG.HospitalNome,
    Medico: data.Medico ?? DEFAULT_CONFIG.Medico,
    CRM: data.CRM ?? DEFAULT_CONFIG.CRM,
    Especialidade: data.Especialidade ?? DEFAULT_CONFIG.Especialidade,
    RQE: data.RQE ?? DEFAULT_CONFIG.RQE,
    IconeMedico: data.IconeMedico ?? DEFAULT_CONFIG.IconeMedico
  };
  await pool.query(
    `INSERT INTO config_geral
       (id, hospital_nome, medico, crm, especialidade, rqe, icone_medico)
     VALUES (1, ?, ?, ?, ?, ?, ?)
     ON DUPLICATE KEY UPDATE
       hospital_nome = VALUES(hospital_nome),
       medico = VALUES(medico),
       crm = VALUES(crm),
       especialidade = VALUES(especialidade),
       rqe = VALUES(rqe),
       icone_medico = VALUES(icone_medico)`,
    [
      payload.HospitalNome, payload.Medico, payload.CRM,
      payload.Especialidade, payload.RQE, payload.IconeMedico
    ]
  );
  return getConfig();
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
  const checks = {
    Setores: [
      ['funcionarios', 'setor_id', 'funcionário(s)'],
      ['historico_aso', 'setor_id', 'registro(s) no histórico']
    ],
    Cargos: [
      ['funcionarios', 'cargo_id', 'funcionário(s)'],
      ['historico_aso', 'cargo_id', 'registro(s) no histórico'],
      ['cargo_risco', 'cargo_id', 'vínculo(s) com riscos'],
      ['cargo_exame', 'cargo_id', 'vínculo(s) com exames']
    ],
    Riscos: [['cargo_risco', 'risco_id', 'vínculo(s) com cargos']],
    ExamesComplementares: [['cargo_exame', 'exame_id', 'vínculo(s) com cargos']],
    Empresas: [
      ['funcionarios', 'empresa_id', 'funcionário(s)'],
      ['historico_aso', 'empresa_id', 'registro(s) no histórico']
    ]
  };
  const usage = [];
  for (const [table, column, label] of checks[sheetName] || []) {
    const [rows] = await pool.query(
      `SELECT COUNT(*) AS total FROM \`${table}\` WHERE \`${column}\` = ?`,
      [id]
    );
    if (Number(rows[0].total)) usage.push(`${rows[0].total} ${label}`);
  }
  return usage;
}

async function close() {
  await pool.end();
}

module.exports = {
  DB_DESCRIPTION,
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
  getUsage,
  close
};
