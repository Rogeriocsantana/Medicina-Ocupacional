const db = require('./mysqlService');

const CONDICOES = new Set(['FÉRIAS', 'GESTANTE', 'PUERPÉRIO', 'LICENÇA MÉDICA', 'AFASTADO', 'OUTRA']);
const date = value => {
  const text = String(value || '');
  if (!/^\d{4}-\d{2}-\d{2}$/.test(text)) return null;
  const parsed = new Date(`${text}T12:00:00Z`);
  return !Number.isNaN(parsed.getTime()) && parsed.toISOString().slice(0, 10) === text ? text : null;
};
const fail = message => { const error = new Error(message); error.status = 400; throw error; };

async function transaction(work) {
  const connection = await db.pool.getConnection();
  try { await connection.beginTransaction(); const result = await work(connection); await connection.commit(); return result; }
  catch (error) { await connection.rollback(); throw error; }
  finally { connection.release(); }
}

async function setCondition(connection, employeeId, next, start, note = null, correction = false, endDateInput = null) {
  const condition = String(next || '').trim().toUpperCase();
  if (condition && !CONDICOES.has(condition)) fail('Condição inválida.');
  const [employees] = await connection.query('SELECT id, empresa_id, condicao FROM funcionarios WHERE id=? FOR UPDATE', [employeeId]);
  if (!employees.length) fail('Funcionário não encontrado.');
  const employee = employees[0];
  const previous = String(employee.condicao || '').toUpperCase();
  const [opened] = await connection.query('SELECT * FROM historico_condicoes WHERE funcionario_id=? AND data_fim IS NULL AND corrigido=0 ORDER BY id DESC LIMIT 1 FOR UPDATE', [employeeId]);
  const active = opened[0];
  if (previous && !active && previous !== condition && !correction) fail('Complete primeiro a data de início pendente em Registros > Condições.');
  const startDate = condition ? date(start) : null;
  const endDate = endDateInput ? date(endDateInput) : null;
  if (endDateInput && !endDate) fail('Data de fim inválida.');
  if (condition && !startDate && (!active || active.condicao !== condition)) fail('Informe a data de início da nova condição.');
  if (condition === previous) {
    if (active && active.condicao === condition && startDate) await connection.query('UPDATE historico_condicoes SET data_inicio=?, observacao=? WHERE id=?', [startDate, note, active.id]);
    else if (active && active.condicao === condition) await connection.query('UPDATE historico_condicoes SET observacao=? WHERE id=?', [note, active.id]);
    else if (condition && !active && startDate) await connection.query('INSERT INTO historico_condicoes (funcionario_id, empresa_id, condicao, data_inicio, observacao) VALUES (?,?,?,?,?)', [employeeId, employee.empresa_id, condition, startDate, note]);
  } else {
    if (active) {
      if (correction) await connection.query('UPDATE historico_condicoes SET corrigido=1, observacao=CONCAT_WS(" | ",observacao,"Correção de cadastro") WHERE id=?', [active.id]);
      else {
        const end = startDate ? new Date(Date.parse(`${startDate}T00:00:00Z`) - 86400000).toISOString().slice(0, 10) : endDate;
        if (!end) fail('Informe a data de fim da condição atual.');
        if (end < String(active.data_inicio).slice(0, 10)) fail('A data da troca não pode ser anterior ao início da condição atual.');
        await connection.query('UPDATE historico_condicoes SET data_fim=? WHERE id=?', [end, active.id]);
      }
    }
    if (condition) await connection.query('INSERT INTO historico_condicoes (funcionario_id, empresa_id, condicao, data_inicio, observacao) VALUES (?,?,?,?,?)', [employeeId, employee.empresa_id, condition, startDate, note]);
  }
  await connection.query('UPDATE funcionarios SET condicao=?, observacao_condicao=? WHERE id=?', [condition || null, note || null, employeeId]);
}

async function conditions(query = {}) {
  const params = [], where = ['h.corrigido=0'];
  if (query.funcionario) { where.push('h.funcionario_id=?'); params.push(Number(query.funcionario)); }
  if (query.condicao) {
    const condition = String(query.condicao).trim().toUpperCase();
    if (!CONDICOES.has(condition)) fail('Filtro de condição inválido.');
    where.push('h.condicao=?'); params.push(condition);
  }
  if (query.inicio) { where.push('h.data_inicio>=?'); params.push(query.inicio); }
  if (query.fim) { where.push('h.data_inicio<=?'); params.push(query.fim); }
  const [rows] = await db.pool.query(`SELECT h.*,f.nome funcionario,f.cpf,e.razao_social empresa,s.nome setor FROM historico_condicoes h JOIN funcionarios f ON f.id=h.funcionario_id JOIN empresas e ON e.id=h.empresa_id JOIN setores s ON s.id=f.setor_id WHERE ${where.join(' AND ')} ORDER BY h.data_inicio DESC,h.id DESC`, params);
  const missingParams = [], missingWhere = ["COALESCE(f.condicao,'')<>''", 'NOT EXISTS (SELECT 1 FROM historico_condicoes active WHERE active.funcionario_id=f.id AND active.data_fim IS NULL AND active.corrigido=0)'];
  if (query.funcionario) { missingWhere.push('f.id=?'); missingParams.push(Number(query.funcionario)); }
  if (query.condicao) { missingWhere.push('f.condicao=?'); missingParams.push(String(query.condicao).trim().toUpperCase()); }
  const missing = query.inicio || query.fim ? [] : (await db.pool.query(`SELECT NULL id,f.id funcionario_id,f.empresa_id,f.condicao,NULL data_inicio,NULL data_fim,f.observacao_condicao observacao,0 corrigido,f.nome funcionario,f.cpf,e.razao_social empresa,s.nome setor,1 pendente_data FROM funcionarios f JOIN empresas e ON e.id=f.empresa_id JOIN setores s ON s.id=f.setor_id WHERE ${missingWhere.join(' AND ')} ORDER BY f.nome`, missingParams))[0];
  return [...missing, ...rows];
}

async function saveCondition(id, body) {
  const employeeId = Number(body.funcionario_id);
  const condition = String(body.condicao || '').trim().toUpperCase();
  const start = date(body.data_inicio);
  const end = body.data_fim ? date(body.data_fim) : null;
  if (!Number.isInteger(employeeId) || employeeId < 1 || !CONDICOES.has(condition) || !start) fail('Funcionário, condição e data de início são obrigatórios.');
  if (body.data_fim && (!end || end < start)) fail('A data de fim deve ser igual ou posterior ao início.');
  if (id) return transaction(async connection => {
    const [rows] = await connection.query('SELECT * FROM historico_condicoes WHERE id=? AND corrigido=0 FOR UPDATE', [id]);
    if (!rows.length) fail('Registro de condição não encontrado.');
    const old = rows[0];
    if (Number(old.funcionario_id) !== employeeId) fail('Para trocar o funcionário, crie um novo registro.');
    const finalEnd = end || old.data_fim || null;
    if (finalEnd && start > String(finalEnd).slice(0, 10)) fail('Início posterior ao fim do período.');
    await connection.query('UPDATE historico_condicoes SET condicao=?,data_inicio=?,data_fim=?,observacao=? WHERE id=?', [condition, start, finalEnd, String(body.observacao || '').trim() || null, id]);
    if (!old.data_fim) await connection.query('UPDATE funcionarios SET condicao=?, observacao_condicao=? WHERE id=?', [end ? null : condition, end ? null : String(body.observacao || '').trim() || null, employeeId]);
    return Number(id);
  });
  if (end) fail('Para registrar um período já encerrado, crie a condição e depois informe o fim.');
  return transaction(async connection => {
    await setCondition(connection, employeeId, condition, start, String(body.observacao || '').trim() || null, Boolean(body.corrigir_anterior));
    const [rows] = await connection.query('SELECT id FROM historico_condicoes WHERE funcionario_id=? AND data_fim IS NULL AND corrigido=0 ORDER BY id DESC LIMIT 1', [employeeId]);
    return rows[0].id;
  });
}

async function endCondition(id, endDate, correction = false) {
  return transaction(async connection => {
    const [rows] = await connection.query('SELECT * FROM historico_condicoes WHERE id=? AND corrigido=0 FOR UPDATE', [id]);
    if (!rows.length) fail('Registro de condição não encontrado.');
    const row = rows[0];
    if (row.data_fim) fail('Este período já está encerrado.');
    await setCondition(connection, row.funcionario_id, '', null, null, correction, endDate);
  });
}

async function removeCondition(id) {
  return transaction(async connection => {
    const [rows] = await connection.query('SELECT * FROM historico_condicoes WHERE id=? AND corrigido=0 FOR UPDATE', [id]);
    if (!rows.length) fail('Registro de condição não encontrado.');
    if (!rows[0].data_fim) await setCondition(connection, rows[0].funcionario_id, '', null, null, true);
    else await connection.query('UPDATE historico_condicoes SET corrigido=1, observacao=CONCAT_WS(" | ",observacao,"Correção de cadastro") WHERE id=?', [id]);
  });
}

async function presenceList(query = {}) {
  const where = [], params = [];
  if (query.inicio) { where.push('p.data_presenca>=?'); params.push(query.inicio); }
  if (query.fim) { where.push('p.data_presenca<=?'); params.push(query.fim); }
  const [rows] = await db.pool.query(`SELECT p.* FROM presencas_medicas p ${where.length ? `WHERE ${where.join(' AND ')}` : ''} ORDER BY p.data_presenca DESC,p.id DESC`, params);
  return rows;
}

async function savePresence(id, body) {
  const day = date(body.data_presenca);
  if (!day) fail('Data de presença obrigatória.');
  const note = String(body.observacao || '').trim() || null;
  if (id) { const [result] = await db.pool.query('UPDATE presencas_medicas SET empresa_id=NULL,medico=NULL,data_presenca=?,observacao=? WHERE id=?', [day, note, id]); if (!result.affectedRows) fail('Presença não encontrada.'); return Number(id); }
  const [result] = await db.pool.query('INSERT INTO presencas_medicas (empresa_id,data_presenca,medico,observacao) VALUES (NULL,?,NULL,?)', [day, note]);
  return result.insertId;
}

async function removePresence(id) { const [result] = await db.pool.query('DELETE FROM presencas_medicas WHERE id=?', [id]); return Boolean(result.affectedRows); }

module.exports = { transaction, setCondition, conditions, saveCondition, endCondition, removeCondition, presenceList, savePresence, removePresence, date, fail };
