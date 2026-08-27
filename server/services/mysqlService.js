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
const REQUIRED_SCHEMA_VERSION = '010_perguntas_anamnese';

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
  Riscos: ['ID', 'Grupo', 'Descricao', 'Agravos'],
  GruposRisco: ['ID', 'Nome', 'Cor', 'Ordem'],
  Cargo_Risco: ['ID', 'CargoID', 'RiscoID'],
  Cargo_Exame: ['ID', 'CargoID', 'ExameID'],
  Empresas: ['ID', 'RazaoSocial', 'CNPJ', 'Endereco', 'Bairro', 'CidadeUf', 'Cep', 'Telefone'],
  Funcionarios: ['ID', 'Nome', 'CPF', 'DataNascimento', 'DataAdmissao', 'UltimoExame', 'Vencimento', 'ObservacaoCondicao', 'Condicao', 'Status', 'Situacao', 'SetorID', 'CargoID', 'EmpresaID'],
  HistoricoPDF: [
    'ID', 'FuncionarioID', 'Nome', 'CPF', 'DataNascimento', 'Cargo', 'Setor',
    'DataGeracao', 'ArquivoPDF', 'TipoExame', 'CargoID', 'SetorID',
    'Conclusao', 'ExamesDatas', 'DataAvaliacaoClinica', 'RiscosSnapshot',
    'DocumentoSnapshot', 'ControleFuncionarioAnterior', 'EmpresaID', 'Empresa'
  ],
  ConfigGeral: ['ID', 'HospitalNome', 'Medico', 'CRM', 'Especialidade', 'RQE', 'IconeMedico', 'BackupIntervaloDias', 'UltimoBackupEm'],
  TiposExame: ['ID', 'Chave', 'Nome', 'Ordem', 'SelecionavelASO'],
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
    fields: { ID: 'id', Chave: 'chave', Nome: 'nome', Ordem: 'ordem', SelecionavelASO: 'selecionavel_aso' }
  },
  Funcionarios: {
    table: 'funcionarios',
    fields: {
      ID: 'id', Nome: 'nome', CPF: 'cpf', DataNascimento: 'data_nascimento',
      DataAdmissao: 'data_admissao', UltimoExame: 'ultimo_exame', Vencimento: 'vencimento',
      ObservacaoCondicao: 'observacao_condicao', Condicao: 'condicao', Status: 'status', Situacao: 'situacao',
      SetorID: 'setor_id', CargoID: 'cargo_id', EmpresaID: 'empresa_id'
    }
  },
  HistoricoPDF: {
    table: 'historico_aso',
    fields: {
      ID: 'id', FuncionarioID: 'funcionario_id', Nome: 'nome', CPF: 'cpf', DataNascimento: 'data_nascimento',
      Cargo: 'cargo', Setor: 'setor', DataGeracao: 'data_geracao',
      ArquivoPDF: 'arquivo_pdf', TipoExame: 'tipo_exame', CargoID: 'cargo_id',
      SetorID: 'setor_id', Conclusao: 'conclusao', ExamesDatas: 'exames_datas',
      DataAvaliacaoClinica: 'data_avaliacao_clinica', RiscosSnapshot: 'riscos_snapshot',
      DocumentoSnapshot: 'documento_snapshot', ControleFuncionarioAnterior: 'controle_funcionario_anterior',
      EmpresaID: 'empresa_id', Empresa: 'empresa'
    }
  },
  ConfigGeral: {
    table: 'config_geral',
    fields: {
      ID: 'id', HospitalNome: 'hospital_nome', Medico: 'medico', CRM: 'crm',
      Especialidade: 'especialidade', RQE: 'rqe', IconeMedico: 'icone_medico',
      BackupIntervaloDias: 'backup_intervalo_dias', UltimoBackupEm: 'ultimo_backup_em'
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
  for (const field of ['ExamesDatas', 'RiscosSnapshot', 'DocumentoSnapshot', 'ControleFuncionarioAnterior']) {
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
      ['ExamesDatas', 'RiscosSnapshot', 'DocumentoSnapshot', 'ControleFuncionarioAnterior'].includes(apiField)) {
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
    const required = [
      ...Object.values(MODELS).map(model => model.table),
      'riscos',
      'perfis_ocupacionais',
      'perfil_risco',
      'perfil_exame_regra',
      'importacoes_funcionarios',
      'importacao_empresa_mapeamentos',
      'importacao_funcionarios_itens'
    ];
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
    const [versions] = await connection.query(
      'SELECT versao FROM schema_migrations WHERE versao = ?',
      [REQUIRED_SCHEMA_VERSION]
    );
    if (!versions.length) {
      throw new Error(`Banco desatualizado. Migração necessária: ${REQUIRED_SCHEMA_VERSION}`);
    }
  } finally {
    connection.release();
  }
}

async function withTransaction(callback) {
  const connection = await pool.getConnection();
  try {
    await connection.beginTransaction();
    const result = await callback(connection);
    await connection.commit();
    return result;
  } catch (error) {
    await connection.rollback();
    throw error;
  } finally {
    connection.release();
  }
}

async function getAll(sheetName) {
  if (sheetName === 'Riscos') {
    const [rows] = await pool.query(
      `SELECT r.id AS ID, g.nome AS Grupo, r.descricao AS Descricao, r.agravos AS Agravos
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
      `SELECT r.id AS ID, g.nome AS Grupo, r.descricao AS Descricao, r.agravos AS Agravos
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
        'INSERT INTO riscos (grupo_id, descricao, agravos) VALUES (?, ?, ?)',
        [grupoId, data.Descricao, data.Agravos || null]
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
      if (data.Agravos !== undefined) {
        sets.push('agravos = ?');
        values.push(data.Agravos || null);
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

async function getPerfilBySetorCargo(setorId, cargoId) {
  if (!setorId || !cargoId) return null;
  const [rows] = await pool.query(
    `SELECT p.id AS ID, p.setor_id AS SetorID, p.cargo_id AS CargoID,
            s.nome AS SetorNome, c.nome AS CargoNome, p.ativo AS Ativo,
            p.periodicidade_vencimento_meses AS PeriodicidadeVencimentoMeses
       FROM perfis_ocupacionais p
       JOIN setores s ON s.id = p.setor_id
       JOIN cargos c ON c.id = p.cargo_id
      WHERE p.setor_id = ? AND p.cargo_id = ?`,
    [setorId, cargoId]
  );
  return rows[0] || null;
}

async function syncPerfilAtividade(setorId, cargoId) {
  if (!setorId || !cargoId) return;
  const [rows] = await pool.query(
    `SELECT COUNT(*) AS total FROM funcionarios
      WHERE setor_id = ? AND cargo_id = ? AND situacao <> 'DESLIGADO'`,
    [setorId, cargoId]
  );
  const ativo = Number(rows[0]?.total || 0) > 0 ? 1 : 0;
  if (ativo) {
    await pool.query(
      `INSERT INTO perfis_ocupacionais (setor_id, cargo_id, ativo)
       VALUES (?, ?, 1)
       ON DUPLICATE KEY UPDATE ativo = 1`,
      [setorId, cargoId]
    );
  } else {
    await pool.query(
      'UPDATE perfis_ocupacionais SET ativo = 0 WHERE setor_id = ? AND cargo_id = ?',
      [setorId, cargoId]
    );
  }
}

async function getPerfisResumo() {
  const [rows] = await pool.query(
    `SELECT COALESCE(CAST(p.id AS CHAR), CONCAT('pendente-', base.setor_id, '-', base.cargo_id)) AS ID,
            base.setor_id AS SetorID, base.cargo_id AS CargoID,
            s.nome AS SetorNome, c.nome AS CargoNome,
            CASE WHEN p.id IS NULL THEN 0 ELSE 1 END AS TemPerfil,
            COALESCE(p.periodicidade_vencimento_meses, 12) AS PeriodicidadeVencimentoMeses,
            COUNT(DISTINCT pr.risco_id) AS totalRiscos,
            COUNT(DISTINCT per.exame_id) AS totalExames,
            COUNT(DISTINCT per.id) AS totalRegras
       FROM (
         SELECT setor_id, cargo_id FROM perfis_ocupacionais WHERE ativo = 1
         UNION
         SELECT DISTINCT setor_id, cargo_id FROM funcionarios WHERE situacao <> 'DESLIGADO'
       ) base
       JOIN setores s ON s.id = base.setor_id
       JOIN cargos c ON c.id = base.cargo_id
       LEFT JOIN perfis_ocupacionais p
         ON p.setor_id = base.setor_id AND p.cargo_id = base.cargo_id AND p.ativo = 1
       LEFT JOIN perfil_risco pr ON pr.perfil_id = p.id
       LEFT JOIN perfil_exame_regra per ON per.perfil_id = p.id
      GROUP BY p.id, base.setor_id, base.cargo_id, s.nome, c.nome, p.periodicidade_vencimento_meses
      ORDER BY s.nome, c.nome`
  );
  return rows;
}

async function getRiscosByPerfil(setorId, cargoId) {
  const perfil = await getPerfilBySetorCargo(setorId, cargoId);
  if (!perfil) return [];
  const [rows] = await pool.query(
    'SELECT risco_id FROM perfil_risco WHERE perfil_id = ? ORDER BY id',
    [perfil.ID]
  );
  return rows.map(row => String(row.risco_id));
}

async function setRiscosForPerfil(setorId, cargoId, riscoIds) {
  return withTransaction(async connection => {
    const [profiles] = await connection.query(
      'SELECT id FROM perfis_ocupacionais WHERE setor_id = ? AND cargo_id = ?',
      [setorId, cargoId]
    );
    let perfilId = profiles[0]?.id;
    if (!perfilId) {
      const [result] = await connection.query(
        'INSERT INTO perfis_ocupacionais (setor_id, cargo_id) VALUES (?, ?)',
        [setorId, cargoId]
      );
      perfilId = result.insertId;
    }
    await connection.query('DELETE FROM perfil_risco WHERE perfil_id = ?', [perfilId]);
    for (const riscoId of [...new Set((riscoIds || []).map(String))]) {
      await connection.query(
        'INSERT INTO perfil_risco (perfil_id, risco_id) VALUES (?, ?)',
        [perfilId, riscoId]
      );
    }
    return true;
  });
}

async function getExameRulesByPerfil(setorId, cargoId, tipoChave = null) {
  const perfil = await getPerfilBySetorCargo(setorId, cargoId);
  if (!perfil) return [];
  const params = [perfil.ID];
  let filter = '';
  if (tipoChave) {
    filter = ' AND te.chave = ?';
    params.push(tipoChave);
  }
  const [rows] = await pool.query(
    `SELECT per.id AS ID, per.exame_id AS ExameID, ec.nome AS ExameNome,
            per.tipo_exame_id AS TipoExameID, te.chave AS TipoChave, te.nome AS TipoNome,
            per.obrigatorio AS Obrigatorio, per.periodicidade_meses AS PeriodicidadeMeses,
            per.valor_original AS ValorOriginal
       FROM perfil_exame_regra per
       JOIN exames_complementares ec ON ec.id = per.exame_id
       JOIN tipos_exame te ON te.id = per.tipo_exame_id
      WHERE per.perfil_id = ?${filter}
      ORDER BY te.ordem, ec.ordem, ec.nome`,
    params
  );
  return rows;
}

async function setExameRulesForPerfil(setorId, cargoId, regras) {
  return withTransaction(async connection => {
    const [profiles] = await connection.query(
      'SELECT id FROM perfis_ocupacionais WHERE setor_id = ? AND cargo_id = ?',
      [setorId, cargoId]
    );
    let perfilId = profiles[0]?.id;
    if (!perfilId) {
      const [result] = await connection.query(
        'INSERT INTO perfis_ocupacionais (setor_id, cargo_id) VALUES (?, ?)',
        [setorId, cargoId]
      );
      perfilId = result.insertId;
    }
    await connection.query('DELETE FROM perfil_exame_regra WHERE perfil_id = ?', [perfilId]);
    for (const regra of regras) {
      await connection.query(
        `INSERT INTO perfil_exame_regra
           (perfil_id, exame_id, tipo_exame_id, obrigatorio, periodicidade_meses, valor_original)
         VALUES (?, ?, ?, 1, ?, ?)
         ON DUPLICATE KEY UPDATE
           periodicidade_meses = VALUES(periodicidade_meses),
           valor_original = VALUES(valor_original)`,
        [
          perfilId, regra.exameId, regra.tipoExameId,
          regra.periodicidadeMeses || null,
          regra.periodicidadeMeses ? `${regra.periodicidadeMeses} meses` : 'X'
        ]
      );
    }
    return true;
  });
}

async function setVencimentoForPerfil(setorId, cargoId, periodicidadeMeses) {
  const meses = Number(periodicidadeMeses);
  if (!Number.isInteger(meses) || meses < 1 || meses > 120) throw new Error('Periodicidade deve estar entre 1 e 120 meses.');
  await pool.query(
    `INSERT INTO perfis_ocupacionais (setor_id, cargo_id, periodicidade_vencimento_meses)
     VALUES (?, ?, ?)
     ON DUPLICATE KEY UPDATE periodicidade_vencimento_meses = VALUES(periodicidade_vencimento_meses), ativo = 1`,
    [setorId, cargoId, meses]
  );
  return getPerfilBySetorCargo(setorId, cargoId);
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
  REQUIRED_SCHEMA_VERSION,
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
  getPerfilBySetorCargo,
  syncPerfilAtividade,
  getPerfisResumo,
  getRiscosByPerfil,
  setRiscosForPerfil,
  getExameRulesByPerfil,
  setExameRulesForPerfil,
  setVencimentoForPerfil,
  getConfig,
  saveConfig,
  getTiposExame,
  getExamesComplementares,
  getGruposRisco,
  getUsage,
  pool,
  withTransaction,
  close
};
