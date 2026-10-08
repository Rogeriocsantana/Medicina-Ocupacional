const ExcelJS = require('exceljs');
const dayjs = require('dayjs');
const db = require('./mysqlService');
const { onlyDigits, isValidCpf, formatCpf } = require('../utils/cpf');

const TIPOS = {
  exames: {
    table: 'exames_realizados', date: 'data_exame', required: ['cpf', 'data', 'tipo_exame'],
    headers: ['CPF', 'Data do Exame', 'Tipo do Exame', 'Alteração de PA', 'Alteração de Glicemia', 'Observação']
  },
  acidentes: {
    table: 'acidentes_trabalho', date: 'data_acidente', required: ['cpf', 'data', 'descricao'],
    headers: ['CPF', 'Data do Acidente', 'Descrição', 'Agente Causador', 'Perfurocortante', 'CAT Emitida', 'Afastamento', 'Dias de Atestado', 'CID', 'Acompanhamento 30 dias', 'Acompanhamento 90 dias', 'Observação']
  },
  encaminhamentos: {
    table: 'encaminhamentos_ocupacionais', date: 'data_encaminhamento', required: ['cpf', 'data', 'especialidade', 'motivo'],
    headers: ['CPF', 'Data', 'Especialidade/Destino', 'Motivo', 'Situação', 'Data de Conclusão', 'Observação']
  },
  atestados: {
    table: 'atestados_medicos', date: 'data_inicio', required: ['cpf', 'data', 'tipo', 'quantidade'],
    headers: ['CPF', 'Código Funcionário', 'Cod + Nome', 'CNPJ da empresa', 'Data de Emissão', 'Data de Início', 'Data de Retorno', 'Tipo', 'Quantidade', 'CID', 'Médico/Dentista', 'CRM/CRO', 'CNES', 'Afastamento INSS', 'Observação']
  }
};

function config(tipo) {
  const value = TIPOS[tipo];
  if (!value) throw Object.assign(new Error('Tipo de registro inválido.'), { status: 400 });
  return value;
}

function isoDate(value) {
  if (!value) return null;
  if (value instanceof Date && !Number.isNaN(value.valueOf())) {
    return `${value.getUTCFullYear()}-${String(value.getUTCMonth() + 1).padStart(2, '0')}-${String(value.getUTCDate()).padStart(2, '0')}`;
  }
  const text = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(text)) return text.slice(0, 10);
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  if (match) return `${match[3]}-${match[2].padStart(2, '0')}-${match[1].padStart(2, '0')}`;
  const parsed = dayjs(text);
  return parsed.isValid() ? parsed.format('YYYY-MM-DD') : null;
}

function yesNo(value) {
  const text = String(value ?? '').trim().toUpperCase();
  if (!text) return null;
  return ['SIM', 'S', '1', 'TRUE', 'VERDADEIRO'].includes(text) ? 1 : 0;
}

function normalizedHeader(value) {
  return String(value || '').normalize('NFD').replace(/[\u0300-\u036f]/g, '').replace(/\s+/g, ' ').trim().toUpperCase();
}

function spreadsheetValue(value) {
  if (value && typeof value === 'object' && !(value instanceof Date)) {
    if ('result' in value) return value.result;
    if (value.richText) return value.richText.map(part => part.text).join('');
    if ('text' in value) return value.text;
  }
  return value;
}

async function funcionarioPorCpf(connection, cpf) {
  const [rows] = await connection.query(
    `SELECT f.id, f.nome, f.cpf, f.empresa_id, f.setor_id, f.cargo_id,
            e.razao_social empresa, s.nome setor, c.nome cargo
       FROM funcionarios f
       JOIN empresas e ON e.id=f.empresa_id JOIN setores s ON s.id=f.setor_id JOIN cargos c ON c.id=f.cargo_id
      WHERE REPLACE(REPLACE(REPLACE(f.cpf,'.',''),'-',''),' ','')=? LIMIT 1`, [onlyDigits(cpf)]
  );
  return rows[0] || null;
}

async function funcionarioPorId(connection, id) {
  const [rows] = await connection.query(
    `SELECT f.id, f.nome, f.cpf, f.empresa_id, f.setor_id, f.cargo_id,
            e.razao_social empresa, s.nome setor, c.nome cargo
       FROM funcionarios f
       JOIN empresas e ON e.id=f.empresa_id JOIN setores s ON s.id=f.setor_id JOIN cargos c ON c.id=f.cargo_id
      WHERE f.id=? LIMIT 1`, [Number(id)]
  );
  return rows[0] || null;
}

async function recalcularFuncionario(connection, funcionarioId) {
  const [funcs] = await connection.query('SELECT * FROM funcionarios WHERE id=? FOR UPDATE', [funcionarioId]);
  if (!funcs.length) return;
  const funcionario = funcs[0];
  const [events] = await connection.query(
    `SELECT data_exame FROM exames_realizados
      WHERE funcionario_id=? AND ativo=1 AND LOWER(tipo_exame) NOT LIKE 'demissional%'
      ORDER BY data_exame DESC, id DESC LIMIT 1`, [funcionarioId]
  );
  const ultimo = events[0]?.data_exame ? dayjs(events[0].data_exame).format('YYYY-MM-DD') : null;
  const [profiles] = await connection.query(
    `SELECT periodicidade_vencimento_meses FROM perfis_ocupacionais
      WHERE setor_id=? AND cargo_id=? AND ativo=1 LIMIT 1`, [funcionario.setor_id, funcionario.cargo_id]
  );
  const meses = Number(profiles[0]?.periodicidade_vencimento_meses || 12);
  const vencimento = ultimo ? dayjs(ultimo).add(meses, 'month').format('YYYY-MM-DD') : null;
  const status = vencimento ? (dayjs(vencimento).isBefore(dayjs(), 'day') ? 'ATRASADO' : 'NO PRAZO') : 'SEM VENCIMENTO';
  await connection.query('UPDATE funcionarios SET ultimo_exame=?, vencimento=?, status=? WHERE id=?', [ultimo, vencimento, status, funcionarioId]);
}

async function sincronizarEdicaoFuncionario(funcionarioId, dataExame) {
  return db.withTransaction(async connection => {
    const [rows] = await connection.query(
      `SELECT id FROM exames_realizados WHERE funcionario_id=? AND ativo=1 AND LOWER(tipo_exame) NOT LIKE 'demissional%'
       ORDER BY data_exame DESC,id DESC LIMIT 1 FOR UPDATE`, [funcionarioId]
    );
    const data = isoDate(dataExame);
    if (rows.length && data) await connection.query('UPDATE exames_realizados SET data_exame=? WHERE id=?', [data, rows[0].id]);
    else if (!rows.length && data) await connection.query(
      `INSERT INTO exames_realizados (funcionario_id,data_exame,tipo_exame,origem) VALUES (?,?,'PERIÓDICO','MANUAL')`, [funcionarioId, data]
    );
    else if (rows.length && !data) await connection.query('UPDATE exames_realizados SET ativo=0 WHERE id=?', [rows[0].id]);
    await recalcularFuncionario(connection, funcionarioId);
  });
}

async function vincularAso({ historicoId, funcionarioId, dataExame, tipoExame, exameExistenteId = null }) {
  return db.withTransaction(async connection => {
    let exameId = exameExistenteId;
    if (!exameId) {
      const [result] = await connection.query(
        `INSERT INTO exames_realizados (funcionario_id,historico_aso_id,data_exame,tipo_exame,origem)
         VALUES (?,?,?,?,'SISTEMA')`, [funcionarioId, historicoId, isoDate(dataExame), String(tipoExame || 'PERIÓDICO').toUpperCase()]
      );
      exameId = result.insertId;
    }
    await connection.query('UPDATE historico_aso SET exame_realizado_id=? WHERE id=?', [exameId, historicoId]);
    await recalcularFuncionario(connection, funcionarioId);
    return exameId;
  });
}

async function desvincularAso(historicoId, funcionarioId, exameId) {
  if (!exameId || !funcionarioId) return;
  await db.withTransaction(async connection => {
    const [links] = await connection.query('SELECT COUNT(*) total FROM historico_aso WHERE exame_realizado_id=? AND id<>?', [exameId, historicoId]);
    if (!Number(links[0].total)) await connection.query('UPDATE exames_realizados SET ativo=0,historico_aso_id=NULL WHERE id=?', [exameId]);
    await recalcularFuncionario(connection, funcionarioId);
  });
}

function payloadFromBody(tipo, body) {
  const base = { funcionario_id: Number(body.funcionario_id), origem: body.origem || 'MANUAL' };
  if (tipo === 'exames') return { ...base, data_exame: isoDate(body.data), tipo_exame: String(body.tipo_exame || '').trim().toUpperCase(), alteracao_pa: yesNo(body.alteracao_pa), alteracao_glicemia: yesNo(body.alteracao_glicemia), observacao: String(body.observacao || '').trim() || null, ativo: 1 };
  if (tipo === 'acidentes') return { ...base, data_acidente: isoDate(body.data), descricao: String(body.descricao || '').trim(), agente_causador: String(body.agente_causador || '').trim() || null, perfurocortante: yesNo(body.perfurocortante) || 0, cat_emitida: ['SIM','NAO','PENDENTE'].includes(String(body.cat_emitida || '').normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase()) ? String(body.cat_emitida).normalize('NFD').replace(/[\u0300-\u036f]/g,'').toUpperCase() : 'PENDENTE', afastamento: yesNo(body.afastamento), dias_atestado: Number(body.dias_atestado) || null, cid: String(body.cid || '').trim() || null, acompanhamento_30: isoDate(body.acompanhamento_30), acompanhamento_90: isoDate(body.acompanhamento_90), observacao: String(body.observacao || '').trim() || null };
  if (tipo === 'atestados') return { ...base, data_emissao: isoDate(body.data_emissao || body.data), data_inicio: isoDate(body.data_inicio || body.data), data_retorno: isoDate(body.data_retorno), tipo: String(body.tipo || 'DIAS').toUpperCase()==='HORAS'?'HORAS':'DIAS', quantidade: Number(body.quantidade) || 0, cid: String(body.cid || '').trim().toUpperCase() || null, profissional: String(body.profissional || '').trim() || null, registro_profissional: String(body.registro_profissional || '').trim() || null, cnes: String(body.cnes || '').trim() || null, afastamento_inss: yesNo(body.afastamento_inss) || 0, observacao: String(body.observacao || '').trim() || null };
  return { ...base, data_encaminhamento: isoDate(body.data), especialidade: String(body.especialidade || '').trim(), motivo: String(body.motivo || '').trim(), situacao: ['PENDENTE','AGENDADO','CONCLUIDO','CANCELADO'].includes(String(body.situacao || '').toUpperCase()) ? String(body.situacao).toUpperCase() : 'PENDENTE', data_conclusao: isoDate(body.data_conclusao), observacao: String(body.observacao || '').trim() || null };
}

function validatePayload(tipo, data) {
  if (!data.funcionario_id) return 'Funcionário é obrigatório.';
  if (!data[config(tipo).date]) return 'Data é obrigatória.';
  if (tipo === 'exames' && !data.tipo_exame) return 'Tipo do exame é obrigatório.';
  if (tipo === 'acidentes' && !data.descricao) return 'Descrição é obrigatória.';
  if (tipo === 'encaminhamentos' && (!data.especialidade || !data.motivo)) return 'Especialidade e motivo são obrigatórios.';
  if (tipo === 'atestados' && (!Number.isFinite(data.quantidade) || data.quantidade <= 0)) return 'Quantidade é obrigatória.';
  return null;
}

async function list(tipo, query = {}) {
  const cfg = config(tipo);
  const params = [];
  const where = tipo === 'exames' ? ['r.ativo=1'] : ['1=1'];
  if (query.inicio) { where.push(`r.${cfg.date}>=?`); params.push(query.inicio); }
  if (query.fim) { where.push(`r.${cfg.date}<=?`); params.push(query.fim); }
  if (query.empresa) { where.push('f.empresa_id=?'); params.push(query.empresa); }
  if (query.setor) { where.push('f.setor_id=?'); params.push(query.setor); }
  const [rows] = await db.pool.query(
    `SELECT r.*,f.nome funcionario,f.cpf,e.razao_social empresa,s.nome setor,c.nome cargo
       FROM ${cfg.table} r JOIN funcionarios f ON f.id=r.funcionario_id
       JOIN empresas e ON e.id=f.empresa_id JOIN setores s ON s.id=f.setor_id JOIN cargos c ON c.id=f.cargo_id
      WHERE ${where.join(' AND ')} ORDER BY r.${cfg.date} DESC,r.id DESC LIMIT 5000`, params
  );
  return rows;
}

async function save(tipo, id, body) {
  if (tipo === 'atestados' && (body.codigo_funcionario || body.cod_nome || body.cnpj || body.origem === 'IMPORTACAO')) {
    try { const matched = await require('./identificadorFuncionarioService').resolve(db.pool, body); if (body.funcionario_id && Number(body.funcionario_id) !== Number(matched.id)) throw new Error('Identificadores correspondem a outro funcionário.'); body = { ...body, cpf: matched.cpf, funcionario_id: matched.id }; }
    catch (err) { throw Object.assign(err, { status: 400 }); }
  }
  if (tipo === 'atestados' && body.origem === 'IMPORTACAO' && !['DIAS','HORAS'].includes(String(body.tipo || '').trim().toUpperCase())) throw Object.assign(new Error('Tipo deve ser DIAS ou HORAS.'), { status: 400 });
  const cfg = config(tipo), data = payloadFromBody(tipo, body);
  const funcionarioId = Number(body.funcionario_id);
  let funcionario = Number.isInteger(funcionarioId) && funcionarioId > 0
    ? await funcionarioPorId(db.pool, funcionarioId)
    : null;
  if (!funcionario && body.cpf) funcionario = await funcionarioPorCpf(db.pool, body.cpf);
  if (!funcionario) throw Object.assign(new Error('Funcionário é obrigatório.'), { status: 400 });
  if (body.cpf && (!isValidCpf(body.cpf) || onlyDigits(body.cpf) !== onlyDigits(funcionario.cpf))) {
    throw Object.assign(new Error('CPF sem funcionário correspondente.'), { status: 400 });
  }
  data.funcionario_id = funcionario.id;
  const error = validatePayload(tipo, data);
  if (error) throw Object.assign(new Error(error), { status: 400 });
  if (!id && body.origem === 'IMPORTACAO') {
    const duplicateSql = tipo === 'exames'
      ? 'SELECT id FROM exames_realizados WHERE funcionario_id=? AND data_exame=? AND tipo_exame=? AND ativo=1 LIMIT 1'
      : tipo === 'acidentes'
        ? 'SELECT id FROM acidentes_trabalho WHERE funcionario_id=? AND data_acidente=? AND descricao=? LIMIT 1'
        : tipo === 'atestados'
          ? 'SELECT id FROM atestados_medicos WHERE funcionario_id=? AND data_inicio=? AND tipo=? AND quantidade=? LIMIT 1'
        : 'SELECT id FROM encaminhamentos_ocupacionais WHERE funcionario_id=? AND data_encaminhamento=? AND especialidade=? AND motivo=? LIMIT 1';
    const duplicateParams = tipo === 'exames' ? [data.funcionario_id,data.data_exame,data.tipo_exame] : tipo === 'acidentes' ? [data.funcionario_id,data.data_acidente,data.descricao] : tipo === 'atestados' ? [data.funcionario_id,data.data_inicio,data.tipo,data.quantidade] : [data.funcionario_id,data.data_encaminhamento,data.especialidade,data.motivo];
    const [duplicates] = await db.pool.query(duplicateSql, duplicateParams);
    if (duplicates.length) return null;
  }
  const keys = Object.keys(data), values = Object.values(data);
  if (id) {
    await db.pool.query(`UPDATE ${cfg.table} SET ${keys.map(key => `${key}=?`).join(',')} WHERE id=?`, [...values, id]);
  } else {
    const [result] = await db.pool.query(`INSERT INTO ${cfg.table} (${keys.join(',')}) VALUES (${keys.map(() => '?').join(',')})`, values);
    id = result.insertId;
  }
  if (tipo === 'exames') await db.withTransaction(connection => recalcularFuncionario(connection, data.funcionario_id));
  return id;
}

async function remove(tipo, id) {
  const cfg = config(tipo);
  const [rows] = await db.pool.query(`SELECT * FROM ${cfg.table} WHERE id=?`, [id]);
  if (!rows.length) return false;
  if (tipo === 'exames') {
    if (rows[0].historico_aso_id) throw Object.assign(new Error('Exclua o ASO vinculado pelo Histórico.'), { status: 409 });
    await db.pool.query('UPDATE exames_realizados SET ativo=0 WHERE id=?', [id]);
    await db.withTransaction(connection => recalcularFuncionario(connection, rows[0].funcionario_id));
  } else await db.pool.query(`DELETE FROM ${cfg.table} WHERE id=?`, [id]);
  return true;
}

async function template(tipo) {
  const cfg = config(tipo), workbook = new ExcelJS.Workbook(), sheet = workbook.addWorksheet('Registros');
  sheet.addRow(cfg.headers); sheet.views = [{ state: 'frozen', ySplit: 1 }]; sheet.autoFilter = `A1:${String.fromCharCode(64 + cfg.headers.length)}1`;
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } }; sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075CAE' } };
  cfg.headers.forEach((header, index) => { sheet.getColumn(index + 1).width = Math.max(18, Math.min(36, header.length + 5)); });
  cfg.headers.forEach((header, index) => { if (['CPF','Código Funcionário','Cod + Nome','CNPJ da empresa'].includes(header)) sheet.getColumn(index + 1).numFmt = '@'; });
  if (tipo === 'atestados') {
    const note = 'Preencha pelo menos um: CPF, Código Funcionário ou Cod + Nome (ex.: 1109 - NOME). Ao usar código, informe também o CNPJ da empresa. Identificadores adicionais devem corresponder ao mesmo funcionário. Tipo: DIAS ou HORAS. Quantidade: maior que zero.';
    ['A1','B1','C1','D1'].forEach(cell => { sheet.getCell(cell).note = note; });
    sheet.dataValidations.add('H2:H1000', { type: 'list', allowBlank: false, formulae: ['"DIAS,HORAS"'], showErrorMessage: true, error: 'Selecione DIAS ou HORAS.' });
    ['E','F','G'].forEach(column => { sheet.getColumn(column).numFmt = 'dd/mm/yyyy'; });
    sheet.getColumn('I').numFmt = '0.##';
    const instructions = workbook.addWorksheet('Instruções');
    instructions.getColumn(1).width = 105;
    [
      'Como preencher o modelo de atestados',
      'Preencha CPF OU Código Funcionário OU Cod + Nome em cada linha.',
      'CPF sozinho: não precisa informar código nem CNPJ.',
      'Código ou Cod + Nome: informe o CNPJ da empresa do nosso cadastro.',
      'Cod + Nome aceita o formato 1109 - NOME. O vínculo é pelo código e empresa; o nome do cadastro será preservado.',
      'Se preencher mais de um identificador, todos devem corresponder ao mesmo funcionário.',
      'Informe Data de Início, Tipo (DIAS ou HORAS) e Quantidade maior que zero.',
      'Data de Emissão, Retorno, CID, profissional e demais campos são opcionais.',
      'Use a aba Registros. Confira a prévia antes de importar. Linhas com erro não serão importadas.'
    ].forEach(text => instructions.addRow([text]));
    instructions.getCell('A1').font = { bold: true };
  }
  return workbook.xlsx.writeBuffer();
}

async function analyze(tipo, buffer) {
  const cfg = config(tipo), workbook = new ExcelJS.Workbook(); await workbook.xlsx.load(buffer);
  const legacyName = tipo === 'exames' ? 'Exames' : tipo === 'acidentes' ? 'CAT' : tipo === 'atestados' ? 'Atestados' : 'Encaminhamentos';
  const sheet = workbook.getWorksheet('Registros') || workbook.getWorksheet(legacyName) || workbook.worksheets[0];
  if (!sheet) throw Object.assign(new Error('Planilha sem aba de registros.'), { status: 400 });
  let headerRow = 1;
  for (let candidate = 1; candidate <= Math.min(12, sheet.actualRowCount); candidate += 1) {
    let foundCpf = false; sheet.getRow(candidate).eachCell(cell => { if (normalizedHeader(cell.value) === 'CPF' || (tipo === 'atestados' && ['CODIGO FUNCIONARIO','COD + NOME'].includes(normalizedHeader(cell.value)))) foundCpf = true; });
    if (foundCpf) { headerRow = candidate; break; }
  }
  const headers = {}; sheet.getRow(headerRow).eachCell((cell, col) => { headers[normalizedHeader(cell.value)] = col; });
  const pick = (row, names) => { for (const name of names) { const col = headers[normalizedHeader(name)]; if (col) return spreadsheetValue(row.getCell(col).value); } return null; };
  if (tipo === 'atestados' && !['CPF','CODIGO FUNCIONARIO','COD + NOME'].some(name => headers[name])) throw Object.assign(new Error('Use o modelo de atestados com CPF, Código Funcionário ou Cod + Nome.'), { status: 400 });
  const result = [];
  for (let index = headerRow + 1; index <= sheet.actualRowCount; index += 1) {
    const row = sheet.getRow(index); if (!row.hasValues) continue;
    let cpf = onlyDigits(pick(row, ['CPF'])), funcionario, identifierError = '';
    const identifiers = tipo === 'atestados' ? { cpf: pick(row, ['CPF']), codigo_funcionario: pick(row, ['Código Funcionário']), cod_nome: pick(row, ['Cod + Nome']), cnpj: pick(row, ['CNPJ da empresa','CNPJ']) } : {};
    if (tipo === 'atestados') { try { funcionario = await require('./identificadorFuncionarioService').resolve(db.pool, identifiers); cpf = funcionario.cpf; } catch (err) { identifierError = err.message; } }
    else { if (!cpf) continue; funcionario = await funcionarioPorCpf(db.pool, cpf); }
    const raw = { ...identifiers, cpf: formatCpf(cpf), data: isoDate(pick(row, tipo === 'exames' ? ['Data do Exame','Data'] : tipo === 'acidentes' ? ['Data do Acidente','Data acidente'] : tipo === 'atestados' ? ['Data de Início','Data'] : ['Data'])) };
    if (tipo === 'exames') Object.assign(raw, { tipo_exame: pick(row, ['Tipo do Exame','Tipo exame']), alteracao_pa: pick(row, ['Alteração de PA']), alteracao_glicemia: pick(row, ['Alteração de Glicemia']), observacao: pick(row, ['Observação']) });
    if (tipo === 'acidentes') { const descricao = pick(row, ['Descrição']); Object.assign(raw, { descricao, agente_causador: pick(row, ['Agente Causador']) || descricao, perfurocortante: pick(row, ['Perfurocortante']) || (/PERFURO/i.test(String(descricao || '')) ? 'SIM' : 'NÃO'), cat_emitida: pick(row, ['CAT Emitida','CAT emitida?']), afastamento: pick(row, ['Afastamento']), dias_atestado: pick(row, ['Dias de Atestado','Dias Atestado']), cid: pick(row, ['CID']), acompanhamento_30: isoDate(pick(row, ['Acompanhamento 30 dias'])), acompanhamento_90: isoDate(pick(row, ['Acompanhamento 90 dias'])), observacao: pick(row, ['Observação']) }); }
    if (tipo === 'encaminhamentos') Object.assign(raw, { especialidade: pick(row, ['Especialidade/Destino','Especialidade','Destino']), motivo: pick(row, ['Motivo']), situacao: pick(row, ['Situação']), data_conclusao: isoDate(pick(row, ['Data de Conclusão'])), observacao: pick(row, ['Observação']) });
    if (tipo === 'atestados') Object.assign(raw, { data_emissao: isoDate(pick(row, ['Data de Emissão'])), data_inicio: isoDate(pick(row, ['Data de Início','Data'])), data_retorno: isoDate(pick(row, ['Data de Retorno'])), tipo: pick(row, ['Tipo']), quantidade: pick(row, ['Quantidade']), cid: pick(row, ['CID']), profissional: pick(row, ['Médico/Dentista','Médico','Dentista']), registro_profissional: pick(row, ['CRM/CRO','CRM','CRO']), cnes: pick(row, ['CNES']), afastamento_inss: pick(row, ['Afastamento INSS']), observacao: pick(row, ['Observação']) });
    const normalized = payloadFromBody(tipo, { ...raw, funcionario_id: funcionario?.id, origem: 'IMPORTACAO' });
    const errors = []; if (identifierError) errors.push(identifierError); if (tipo === 'atestados' && !['DIAS','HORAS'].includes(String(raw.tipo || '').trim().toUpperCase())) errors.push('Tipo deve ser DIAS ou HORAS'); if (!isValidCpf(cpf)) errors.push('CPF inválido'); if (!funcionario) errors.push('CPF sem cadastro correspondente'); const validation = validatePayload(tipo, normalized); if (validation) errors.push(validation);
    result.push({ linha: index, funcionario: funcionario?.nome || '', ...raw, funcionario_id: funcionario?.id || null, erros: errors });
  }
  return result;
}

async function importRows(tipo, rows) {
  let imported = 0;
  for (const row of rows || []) { if (row.erros?.length) continue; const id = await save(tipo, null, { ...row, origem: 'IMPORTACAO' }); if (id) imported += 1; }
  return imported;
}

module.exports = { TIPOS, list, save, remove, template, analyze, importRows, vincularAso, desvincularAso, sincronizarEdicaoFuncionario, recalcularFuncionario };
