const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const { isValidCpf, onlyDigits } = require('../utils/cpf');
const db = require('./mysqlService');

function text(value) {
  if (value === null || value === undefined) return '';
  if (typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'result')) {
    return text(value.result);
  }
  if (typeof value === 'object' && Array.isArray(value.richText)) {
    return value.richText.map(part => part.text || '').join('').trim();
  }
  return String(value).trim();
}

function excelDate(value) {
  if (!value) return null;
  if (typeof value === 'object' && Object.prototype.hasOwnProperty.call(value, 'result')) {
    return excelDate(value.result);
  }
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  if (typeof value === 'number') {
    const date = new Date(Date.UTC(1899, 11, 30) + value * 86400000);
    return Number.isNaN(date.valueOf()) ? null : `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, '0')}-${String(date.getUTCDate()).padStart(2, '0')}`;
  }
  const raw = text(value);
  const br = raw.match(/^(\d{2})\/(\d{2})\/(\d{4})$/);
  if (br) {
    const isoDate = `${br[3]}-${br[2]}-${br[1]}`;
    const parsed = dayjs(isoDate);
    return parsed.isValid() && parsed.format('YYYY-MM-DD') === isoDate ? isoDate : null;
  }
  const isoDate = raw.match(/^\d{4}-\d{2}-\d{2}/)?.[0];
  return isoDate && dayjs(isoDate).isValid() ? isoDate : null;
}

function normalizeLabel(value) {
  return text(value)
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .replace(/\s+/g, ' ')
    .trim()
    .toUpperCase();
}

function normalizeHeader(value) {
  return normalizeLabel(value).replace(/[^A-Z0-9]+/g, ' ').trim();
}

const HEADER_ALIASES = {
  numero: ['N', 'Nº', 'NUMERO'],
  nome: ['NOME', 'NOME COMPLETO'],
  empresa: ['EMPRESA', 'CNPJ', 'CODIGO EMPRESA'],
  nascimento: ['NASCIMENTO', 'DATA NASCIMENTO', 'DATA DE NASCIMENTO'],
  cpf: ['CPF'],
  departamento: ['SETOR', 'DEPARTAMENTO'],
  cargo: ['CARGO', 'FUNCAO'],
  admissao: ['ADMISSAO', 'DATA ADMISSAO', 'DATA DE ADMISSAO'],
  ultimoExame: ['ULTIMO EXAME', 'ULTIMO EX REAL', 'ULTIMO EXAME REALIZADO'],
  vencimento: ['VENCIMENTO', 'VENCIMENTO ASO'],
  status: ['STATUS'],
  condicao: ['CONDICAO'],
  observacaoCondicao: ['OBSERVACAO', 'OBSERVACAO DA CONDICAO'],
  situacao: ['SITUACAO']
};

const HEADER_LOOKUP = new Map(
  Object.entries(HEADER_ALIASES).flatMap(([field, aliases]) =>
    aliases.map(alias => [normalizeHeader(alias), field])
  )
);

function detectHeader(worksheet) {
  const limite = Math.min(20, worksheet.rowCount || 20);
  for (let rowNumber = 1; rowNumber <= limite; rowNumber += 1) {
    const row = worksheet.getRow(rowNumber);
    const columns = {};
    row.eachCell({ includeEmpty: false }, (cell, colNumber) => {
      const field = HEADER_LOOKUP.get(normalizeHeader(text(cell.value)));
      if (field && !columns[field]) columns[field] = colNumber;
    });
    if (columns.nome && columns.cpf) return { rowNumber, columns };
  }
  throw new Error('Não foi possível localizar um cabeçalho com as colunas "Nome" e "CPF" nas primeiras 20 linhas.');
}

function cellValue(row, columns, field) {
  return columns[field] ? row.getCell(columns[field]).value : null;
}

function cpfFromCell(value) {
  const raw = text(value);
  let digits = onlyDigits(raw);
  if (digits.length === 10 && typeof value === 'number') digits = digits.padStart(11, '0');
  return { raw, digits };
}

function statusFromCell(value, lastExam, situation) {
  const explicit = text(value).toUpperCase();
  if (explicit && !explicit.startsWith('=')) return explicit;
  if (situation && situation !== 'ATIVO') return situation;
  if (!lastExam) return '';
  return dayjs(lastExam).add(1, 'year').isBefore(dayjs(), 'day') ? 'ATRASADO' : 'NO PRAZO';
}

async function parseWorkbook(buffer) {
  const workbook = new ExcelJS.Workbook();
  await workbook.xlsx.load(buffer);
  const worksheet = workbook.getWorksheet('Funcionarios') || workbook.getWorksheet('Periodicos');
  if (!worksheet) throw new Error('A planilha precisa conter a aba "Funcionarios" (modelo atual) ou "Periodicos" (modelo antigo).');
  const { rowNumber: headerRow, columns } = detectHeader(worksheet);

  const parsed = [];
  worksheet.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber <= headerRow) return;
    const name = text(cellValue(row, columns, 'nome'));
    const cpf = cpfFromCell(cellValue(row, columns, 'cpf'));
    const empresa = normalizeLabel(cellValue(row, columns, 'empresa'));
    const departamento = text(cellValue(row, columns, 'departamento'));
    const cargo = text(cellValue(row, columns, 'cargo'));
    if (!name && !cpf.raw && !empresa && !departamento && !cargo) return;
    const lastExam = excelDate(cellValue(row, columns, 'ultimoExame'));
    const situation = text(cellValue(row, columns, 'situacao')).toUpperCase();
    const status = text(cellValue(row, columns, 'status')).toUpperCase();
    const conditionExplicit = text(cellValue(row, columns, 'condicao')).toUpperCase();
    const conditionFromStatus = ['GESTANTE', 'PUERPÉRIO', 'LICENÇA MÉDICA', 'FÉRIAS', 'AFASTADO', 'OUTRA'].includes(status) ? status : '';
    const legacyAway = situation === 'AFASTADO';
    parsed.push({
      rowNumber,
      numero: text(cellValue(row, columns, 'numero')),
      nome: name,
      empresa,
      nascimento: excelDate(cellValue(row, columns, 'nascimento')),
      cpfRaw: cpf.raw,
      cpf: cpf.digits,
      departamento,
      cargo,
      admissao: excelDate(cellValue(row, columns, 'admissao')),
      ultimoExame: lastExam,
      vencimento: excelDate(cellValue(row, columns, 'vencimento')) || (lastExam ? dayjs(lastExam).add(1, 'year').format('YYYY-MM-DD') : null),
      status: statusFromCell(cellValue(row, columns, 'status'), lastExam, situation),
      condicao: conditionExplicit || (legacyAway ? 'AFASTADO' : conditionFromStatus) || null,
      observacaoCondicao: text(cellValue(row, columns, 'observacaoCondicao')) || null,
      atraso: null,
      situacao: legacyAway ? 'ATIVO' : situation || 'ATIVO'
    });
  });
  if (!parsed.length) throw new Error('Nenhum colaborador foi encontrado abaixo do cabeçalho.');
  return { parsed, worksheetName: worksheet.name, headerRow, columns };
}

async function analyzeWorkbook(buffer, fileName) {
  const { parsed } = await parseWorkbook(buffer);

  return db.withTransaction(async connection => {
    const [batchResult] = await connection.query(
      'INSERT INTO importacoes_funcionarios (nome_arquivo, total_linhas) VALUES (?, ?)',
      [fileName || 'planilha.xlsx', parsed.length]
    );
    const batchId = batchResult.insertId;
    for (const companyCode of [...new Set(parsed.map(row => row.empresa).filter(Boolean))]) {
      await connection.query(
        'INSERT INTO importacao_empresa_mapeamentos (importacao_id, codigo_origem) VALUES (?, ?)',
        [batchId, companyCode]
      );
    }
    const [companies] = await connection.query('SELECT id, razao_social FROM empresas');
    for (const company of companies) {
      await connection.query(
        `UPDATE importacao_empresa_mapeamentos
            SET empresa_id = ?
          WHERE importacao_id = ? AND codigo_origem = ? AND empresa_id IS NULL`,
        [company.id, batchId, normalizeLabel(company.razao_social)]
      );
    }
    for (const row of parsed) {
      await connection.query(
        `INSERT INTO importacao_funcionarios_itens
          (importacao_id, linha_origem, numero_origem, nome, empresa_codigo,
           data_nascimento, cpf, cpf_normalizado, departamento, cargo,
           data_admissao, ultimo_exame, vencimento, status_origem, atraso_dias,
           condicao_origem, observacao_condicao_origem, situacao_origem)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          batchId, row.rowNumber, row.numero || null, row.nome, row.empresa || null,
          row.nascimento, row.cpfRaw || null, row.cpf || null, row.departamento || null,
          row.cargo || null, row.admissao, row.ultimoExame, row.vencimento,
          row.status || null, row.atraso, row.condicao, row.observacaoCondicao, row.situacao || 'ATIVO'
        ]
      );
    }
    await reevaluateBatch(connection, batchId);
    return batchId;
  });
}

async function reevaluateBatch(connection, batchId) {
  const [items] = await connection.query(
    `SELECT i.*, m.empresa_id
       FROM importacao_funcionarios_itens i
       LEFT JOIN importacao_empresa_mapeamentos m
         ON m.importacao_id = i.importacao_id AND m.codigo_origem = i.empresa_codigo
      WHERE i.importacao_id = ?`,
    [batchId]
  );
  const [existing] = await connection.query('SELECT id, cpf FROM funcionarios');
  const [sectors] = await connection.query('SELECT id, nome FROM setores');
  const [roles] = await connection.query('SELECT id, nome FROM cargos');
  const existingByCpf = new Map(existing.map(row => [onlyDigits(row.cpf), row.id]));
  const sectorNames = new Set(sectors.map(row => normalizeLabel(row.nome)));
  const roleNames = new Set(roles.map(row => normalizeLabel(row.nome)));
  const counts = new Map();
  for (const item of items.filter(item => item.acao !== 'IGNORAR')) {
    if (item.cpf_normalizado) counts.set(item.cpf_normalizado, (counts.get(item.cpf_normalizado) || 0) + 1);
  }

  let ready = 0;
  let pending = 0;
  let imported = 0;
  for (const item of items) {
    if (item.estado === 'IMPORTADO') {
      imported += 1;
      continue;
    }
    if (item.acao === 'IGNORAR') {
      await connection.query(
        `UPDATE importacao_funcionarios_itens
            SET estado = 'IGNORADO', conflitos = JSON_ARRAY('Linha marcada para ignorar.')
          WHERE id = ?`,
        [item.id]
      );
      continue;
    }
    const conflicts = [];
    if (!item.nome) conflicts.push('Nome ausente.');
    if (!item.cpf_normalizado || !isValidCpf(item.cpf_normalizado)) conflicts.push('CPF inválido.');
    if (item.cpf_normalizado && counts.get(item.cpf_normalizado) > 1) conflicts.push('CPF repetido dentro da planilha.');
    const funcionarioExistenteId = item.cpf_normalizado ? existingByCpf.get(item.cpf_normalizado) : null;
    if (!item.data_nascimento) conflicts.push('Data de nascimento inválida.');
    if (!item.departamento) conflicts.push('Departamento ausente.');
    else if (!sectorNames.has(normalizeLabel(item.departamento))) conflicts.push(`Setor "${item.departamento}" não está cadastrado.`);
    if (!item.cargo) conflicts.push('Função/cargo ausente.');
    else if (!roleNames.has(normalizeLabel(item.cargo))) conflicts.push(`Cargo "${item.cargo}" não está cadastrado.`);
    if (!item.empresa_codigo) conflicts.push('Código de empresa ausente.');
    else if (!item.empresa_id) conflicts.push(`Empresa "${item.empresa_codigo}" ainda não foi mapeada.`);
    const state = conflicts.length ? 'PENDENTE' : 'PRONTO';
    await connection.query(
      `UPDATE importacao_funcionarios_itens
          SET estado = ?, conflitos = ?, acao = ?, funcionario_id = ?
        WHERE id = ?`,
      [state, JSON.stringify(conflicts), funcionarioExistenteId ? 'ATUALIZAR' : 'IMPORTAR', funcionarioExistenteId || null, item.id]
    );
    if (state === 'PRONTO') ready += 1;
    else pending += 1;
  }
  const batchStatus = pending ? 'COM_PENDENCIAS' : (ready ? 'PRONTO' : (imported ? 'CONCLUIDO' : 'ANALISADO'));
  await connection.query(
    `UPDATE importacoes_funcionarios
        SET linhas_prontas = ?, linhas_pendentes = ?, linhas_importadas = ?, status = ?
      WHERE id = ?`,
    [ready, pending, imported, batchStatus, batchId]
  );
}

async function getBatch(batchId, filters = {}) {
  const [batches] = await db.pool.query('SELECT * FROM importacoes_funcionarios WHERE id = ?', [batchId]);
  if (!batches.length) return null;
  const params = [batchId];
  let where = 'WHERE importacao_id = ?';
  if (filters.estado) {
    where += ' AND estado = ?';
    params.push(filters.estado);
  }
  const [items] = await db.pool.query(
    `SELECT i.*,
            f.nome AS atual_nome, f.cpf AS atual_cpf, f.data_nascimento AS atual_data_nascimento,
            f.data_admissao AS atual_data_admissao, f.ultimo_exame AS atual_ultimo_exame,
            f.condicao AS atual_condicao, f.observacao_condicao AS atual_observacao_condicao,
            f.situacao AS atual_situacao, e.razao_social AS atual_empresa,
            s.nome AS atual_setor, c.nome AS atual_cargo
       FROM importacao_funcionarios_itens i
       LEFT JOIN funcionarios f ON f.id = i.funcionario_id
       LEFT JOIN empresas e ON e.id = f.empresa_id
       LEFT JOIN setores s ON s.id = f.setor_id
       LEFT JOIN cargos c ON c.id = f.cargo_id
       ${where.replace('importacao_id', 'i.importacao_id').replace('estado', 'i.estado')}
      ORDER BY i.linha_origem LIMIT 2000`,
    params
  );
  const [mappings] = await db.pool.query(
    `SELECT m.*, e.razao_social AS empresa_nome
       FROM importacao_empresa_mapeamentos m
       LEFT JOIN empresas e ON e.id = m.empresa_id
      WHERE m.importacao_id = ? ORDER BY m.codigo_origem`,
    [batchId]
  );
  return {
    lote: batches[0],
    mapeamentos: mappings,
    itens: items.map(item => ({
      ...item,
      atual: item.funcionario_id ? {
        nome: item.atual_nome, cpf: item.atual_cpf, data_nascimento: item.atual_data_nascimento,
        data_admissao: item.atual_data_admissao, ultimo_exame: item.atual_ultimo_exame,
        empresa: item.atual_empresa, setor: item.atual_setor, cargo: item.atual_cargo,
        condicao: item.atual_condicao, observacao_condicao: item.atual_observacao_condicao,
        situacao: item.atual_situacao
      } : null,
      conflitos: typeof item.conflitos === 'string' ? JSON.parse(item.conflitos || '[]') : (item.conflitos || [])
    }))
  };
}

async function listBatches() {
  const [rows] = await db.pool.query('SELECT * FROM importacoes_funcionarios ORDER BY id DESC LIMIT 20');
  return rows;
}

async function mapCompany(batchId, code, companyId) {
  await db.withTransaction(async connection => {
    const [company] = await connection.query('SELECT id FROM empresas WHERE id = ?', [companyId]);
    if (!company.length) throw new Error('Empresa não encontrada.');
    const [result] = await connection.query(
      `UPDATE importacao_empresa_mapeamentos SET empresa_id = ?
        WHERE importacao_id = ? AND codigo_origem = ?`,
      [companyId, batchId, normalizeLabel(code)]
    );
    if (!result.affectedRows) throw new Error('Código de empresa não encontrado neste lote.');
    await reevaluateBatch(connection, batchId);
  });
}

async function setItemAction(batchId, itemId, action) {
  if (!['IMPORTAR', 'IGNORAR'].includes(action)) throw new Error('Ação inválida.');
  await db.withTransaction(async connection => {
    const [result] = await connection.query(
      `UPDATE importacao_funcionarios_itens SET acao = ?
        WHERE id = ? AND importacao_id = ? AND estado <> 'IMPORTADO'`,
      [action, itemId, batchId]
    );
    if (!result.affectedRows) throw new Error('Linha da importação não encontrada.');
    await reevaluateBatch(connection, batchId);
  });
}

async function findExisting(connection, table, name) {
  const normalized = normalizeLabel(name);
  const [rows] = await connection.query(`SELECT id, nome FROM \`${table}\``);
  const found = rows.find(row => normalizeLabel(row.nome) === normalized);
  if (found) return found.id;
  throw new Error(`${table === 'setores' ? 'Setor' : 'Cargo'} "${text(name)}" não está cadastrado.`);
}

const CAMPOS_ATUALIZAVEIS = new Set([
  'nome', 'data_nascimento', 'empresa', 'setor', 'cargo',
  'data_admissao', 'ultimo_exame', 'condicao', 'observacao_condicao', 'situacao'
]);

async function applyBatch(batchId, camposAtualizacao = []) {
  const campos = new Set((Array.isArray(camposAtualizacao) ? camposAtualizacao : [])
    .filter(campo => CAMPOS_ATUALIZAVEIS.has(campo)));
  return db.withTransaction(async connection => {
    await reevaluateBatch(connection, batchId);
    const [items] = await connection.query(
      `SELECT i.*, m.empresa_id
         FROM importacao_funcionarios_itens i
         JOIN importacao_empresa_mapeamentos m
           ON m.importacao_id = i.importacao_id AND m.codigo_origem = i.empresa_codigo
        WHERE i.importacao_id = ? AND i.estado = 'PRONTO' AND i.acao IN ('IMPORTAR', 'ATUALIZAR')
        ORDER BY i.linha_origem`,
      [batchId]
    );
    let cadastrados = 0;
    let atualizados = 0;
    const perfisAfetados = new Set();
    for (const item of items) {
      let atual = null;
      if (item.acao === 'ATUALIZAR' && item.funcionario_id) {
        const [rows] = await connection.query('SELECT * FROM funcionarios WHERE id = ?', [item.funcionario_id]);
        atual = rows[0];
        if (!atual) throw new Error(`Funcionário da linha ${item.linha_origem} não foi encontrado.`);
        perfisAfetados.add(`${atual.setor_id}:${atual.cargo_id}`);
      }
      const sectorId = atual && !campos.has('setor')
        ? atual.setor_id : await findExisting(connection, 'setores', item.departamento);
      const roleId = atual && !campos.has('cargo')
        ? atual.cargo_id : await findExisting(connection, 'cargos', item.cargo);
      const empresaId = atual && !campos.has('empresa') ? atual.empresa_id : item.empresa_id;
      perfisAfetados.add(`${sectorId}:${roleId}`);
      const ultimoExame = atual && !campos.has('ultimo_exame') ? atual.ultimo_exame : item.ultimo_exame;
      const [profiles] = await connection.query(
        'SELECT periodicidade_vencimento_meses FROM perfis_ocupacionais WHERE setor_id = ? AND cargo_id = ?',
        [sectorId, roleId]
      );
      const periodicidade = Number(profiles[0]?.periodicidade_vencimento_meses || 12);
      const recalcularVencimento = !atual || campos.has('ultimo_exame') || campos.has('setor') || campos.has('cargo');
      const vencimento = recalcularVencimento
        ? (ultimoExame ? dayjs(ultimoExame).add(periodicidade, 'month').format('YYYY-MM-DD') : null)
        : atual.vencimento;
      const legadoAfastado = String(item.situacao_origem || '').toUpperCase() === 'AFASTADO';
      const condicaoOrigem = item.condicao_origem || (legadoAfastado ? 'AFASTADO' : null);
      const situacaoOrigem = legadoAfastado ? 'ATIVO' : (item.situacao_origem || 'ATIVO');
      if (atual && campos.has('condicao') && String(atual.condicao || '') !== String(condicaoOrigem || '')) {
        const [periodos] = await connection.query('SELECT id FROM historico_condicoes WHERE funcionario_id=? AND data_fim IS NULL AND corrigido=0 LIMIT 1', [atual.id]);
        if (periodos.length) throw new Error(`Linha ${item.linha_origem}: altere a condição em Funcionários ou Registros para informar a data e preservar o histórico.`);
      }
      let funcionarioId = item.funcionario_id;
      if (item.acao === 'ATUALIZAR' && funcionarioId) {
        await connection.query(
          `UPDATE funcionarios SET
             empresa_id = ?, setor_id = ?, cargo_id = ?, nome = ?, cpf = ?, data_nascimento = ?,
             data_admissao = ?, ultimo_exame = ?, vencimento = ?, condicao = ?, observacao_condicao = ?, status = ?, situacao = ?
          WHERE id = ?`,
          [
            empresaId, sectorId, roleId,
            campos.has('nome') ? item.nome : atual.nome,
            atual.cpf,
            campos.has('data_nascimento') ? item.data_nascimento : atual.data_nascimento,
            campos.has('data_admissao') ? item.data_admissao : atual.data_admissao,
            ultimoExame, vencimento,
            campos.has('condicao') ? condicaoOrigem : atual.condicao,
            campos.has('observacao_condicao') ? item.observacao_condicao_origem : atual.observacao_condicao,
            recalcularVencimento
              ? (vencimento ? (dayjs(vencimento).isBefore(dayjs(), 'day') ? 'ATRASADO' : 'NO PRAZO') : 'SEM VENCIMENTO')
              : atual.status,
            campos.has('situacao') ? situacaoOrigem : atual.situacao,
            funcionarioId
          ]
        );
        atualizados += 1;
      } else {
        const [result] = await connection.query(
          `INSERT INTO funcionarios
          (empresa_id, setor_id, cargo_id, nome, cpf, data_nascimento,
           data_admissao, ultimo_exame, vencimento, observacao_condicao, condicao, status, situacao)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)`,
        [
          empresaId, sectorId, roleId, item.nome, item.cpf_normalizado,
          item.data_nascimento, item.data_admissao, ultimoExame, vencimento, item.observacao_condicao_origem, condicaoOrigem,
          vencimento ? (dayjs(vencimento).isBefore(dayjs(), 'day') ? 'ATRASADO' : 'NO PRAZO') : 'SEM VENCIMENTO',
          situacaoOrigem
        ]
        );
        funcionarioId = result.insertId;
        cadastrados += 1;
      }
      await connection.query(
        `UPDATE importacao_funcionarios_itens
            SET estado = 'IMPORTADO', funcionario_id = ?, conflitos = JSON_ARRAY()
          WHERE id = ?`,
        [funcionarioId, item.id]
      );
    }
    for (const chave of perfisAfetados) {
      const [setorId, cargoId] = chave.split(':');
      const [contagens] = await connection.query(
        `SELECT COUNT(*) AS total FROM funcionarios
          WHERE setor_id = ? AND cargo_id = ? AND situacao <> 'DESLIGADO'`,
        [setorId, cargoId]
      );
      if (Number(contagens[0]?.total || 0) > 0) {
        await connection.query(
          `INSERT INTO perfis_ocupacionais (setor_id, cargo_id, ativo)
           VALUES (?, ?, 1) ON DUPLICATE KEY UPDATE ativo = 1`,
          [setorId, cargoId]
        );
      } else {
        await connection.query(
          'UPDATE perfis_ocupacionais SET ativo = 0 WHERE setor_id = ? AND cargo_id = ?',
          [setorId, cargoId]
        );
      }
    }
    await reevaluateBatch(connection, batchId);
    return { processados: items.length, cadastrados, atualizados };
  });
}

async function generateTemplate() {
  const [empresas, setores, cargos] = await Promise.all([
    db.getAll('Empresas'), db.getAll('Setores'), db.getAll('Cargos')
  ]);
  const workbook = new ExcelJS.Workbook();
  workbook.creator = 'Gestão Ocupacional';
  workbook.created = new Date();
  const sheet = workbook.addWorksheet('Funcionarios', { views: [{ state: 'frozen', ySplit: 1 }] });
  const headers = ['Nome', 'CPF', 'Empresa', 'Data de Nascimento', 'Setor', 'Cargo', 'Data de Admissão', 'Último Exame', 'Condição', 'Observação da Condição', 'Situação'];
  sheet.addRow(headers);
  sheet.getRow(1).height = 30;
  sheet.getRow(1).eachCell(cell => {
    cell.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF0057A8' } };
    cell.alignment = { vertical: 'middle', horizontal: 'center', wrapText: true };
    cell.border = { bottom: { style: 'medium', color: { argb: 'FF003B73' } } };
  });
  sheet.autoFilter = 'A1:K1';
  const widths = [34, 16, 38, 20, 34, 34, 19, 17, 22, 34, 16];
  widths.forEach((width, index) => { sheet.getColumn(index + 1).width = width; });
  ['D', 'G', 'H'].forEach(column => { sheet.getColumn(column).numFmt = 'dd/mm/yyyy'; });
  sheet.getColumn('B').numFmt = '@';
  sheet.getRow(2).height = 24;
  sheet.getRow(2).eachCell({ includeEmpty: true }, cell => {
    cell.fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FFFFF4CC' } };
  });

  const lists = workbook.addWorksheet('Listas');
  lists.addRow(['Empresas', 'Setores', 'Cargos', 'Condições', 'Situações']);
  const conditions = ['', 'GESTANTE', 'PUERPÉRIO', 'LICENÇA MÉDICA', 'FÉRIAS', 'AFASTADO', 'OUTRA'];
  const situations = ['ATIVO', 'DESLIGADO'];
  const max = Math.max(empresas.length, setores.length, cargos.length, conditions.length, situations.length);
  for (let i = 0; i < max; i += 1) {
    lists.addRow([
      empresas[i]?.RazaoSocial || '', setores[i]?.Nome || '', cargos[i]?.Nome || '',
      conditions[i] ?? '', situations[i] ?? ''
    ]);
  }
  const listRange = (col, count) => `'Listas'!$${col}$2:$${col}$${Math.max(2, count + 1)}`;
  for (let row = 2; row <= 1001; row += 1) {
    sheet.getCell(`C${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [listRange('A', empresas.length)] };
    sheet.getCell(`E${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [listRange('B', setores.length)] };
    sheet.getCell(`F${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [listRange('C', cargos.length)] };
    sheet.getCell(`I${row}`).dataValidation = { type: 'list', allowBlank: true, formulae: [listRange('D', conditions.length)] };
    sheet.getCell(`K${row}`).dataValidation = { type: 'list', allowBlank: false, formulae: [listRange('E', situations.length)] };
  }
  lists.state = 'veryHidden';

  const instructions = workbook.addWorksheet('Instruções');
  instructions.columns = [{ width: 4 }, { width: 95 }];
  instructions.getCell('B2').value = 'Modelo de importação de funcionários';
  instructions.getCell('B2').font = { bold: true, size: 18, color: { argb: 'FF0057A8' } };
  const notes = [
    'Preencha uma pessoa por linha na aba Funcionarios.',
    'CPF identifica o funcionário: CPF novo será cadastrado; CPF existente será apresentado como atualização.',
    'Use as listas de Empresa, Setor, Cargo, Condição e Situação fornecidas pelo arquivo.',
    'Datas devem ser preenchidas como datas do Excel. Vencimento e status são calculados pelo sistema.',
    'Antes de efetivar, o sistema mostrará conflitos e permitirá escolher quais campos dos cadastros existentes serão atualizados.'
  ];
  notes.forEach((note, index) => { instructions.getCell(`B${index + 4}`).value = `${index + 1}. ${note}`; });
  for (let row = 4; row <= 8; row += 1) {
    instructions.getCell(`B${row}`).alignment = { wrapText: true, vertical: 'top' };
    instructions.getCell(`B${row}`).font = { size: 12 };
  }
  instructions.getRow(2).height = 28;
  instructions.getRow(4).height = 34;
  workbook.views = [{ activeTab: 0 }];
  return workbook.xlsx.writeBuffer();
}

module.exports = {
  analyzeWorkbook,
  parseWorkbook,
  getBatch,
  listBatches,
  mapCompany,
  setItemAction,
  applyBatch,
  generateTemplate,
  normalizeLabel,
  excelDate
};
