const ExcelJS = require('exceljs');
const db = require('./mysqlService');
const conditions = require('./condicoesPresencaService');
const { onlyDigits, isValidCpf } = require('../utils/cpf');

function check(tipo) {
  if (!['condicoes', 'presencas'].includes(tipo)) {
    const error = new Error('Tipo de planilha inválido.'); error.status = 400; throw error;
  }
}
function iso(value) {
  if (value instanceof Date) return conditions.date(value.toISOString().slice(0, 10));
  const text = String(value || '').trim();
  const match = text.match(/^(\d{1,2})\/(\d{1,2})\/(\d{4})$/);
  return conditions.date(match ? match[3] + '-' + match[2].padStart(2, '0') + '-' + match[1].padStart(2, '0') : text);
}
async function template(tipo) {
  check(tipo);
  const wb = new ExcelJS.Workbook(), sheet = wb.addWorksheet('Registros');
  const headers = tipo === 'condicoes' ? ['CPF', 'Condição', 'Data de início', 'Observação'] : ['Data de presença', 'Observação'];
  sheet.addRow(headers);
  sheet.views = [{ state: 'frozen', ySplit: 1 }];
  sheet.autoFilter = 'A1:' + String.fromCharCode(64 + headers.length) + '1';
  sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
  sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075CAE' } };
  headers.forEach((header, index) => { sheet.getColumn(index + 1).width = Math.max(22, header.length + 6); });
  if (tipo === 'condicoes') sheet.getColumn(1).numFmt = '@';
  return wb.xlsx.writeBuffer();
}
async function analyze(tipo, buffer) {
  check(tipo);
  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(buffer);
  const sheet = wb.getWorksheet('Registros') || wb.worksheets[0];
  if (!sheet) { const error = new Error('Planilha sem aba de registros.'); error.status = 400; throw error; }
  const rows = [];
  for (let line = 2; line <= sheet.actualRowCount; line++) {
    const cells = sheet.getRow(line);
    if (tipo === 'condicoes') {
      const cpf = onlyDigits(cells.getCell(1).text), condicao = String(cells.getCell(2).text || '').trim().toUpperCase();
      const data = iso(cells.getCell(3).value), observacao = String(cells.getCell(4).text || '').trim();
      if (!cpf && !condicao && !data) continue;
      const [employee] = cpf ? await db.pool.query("SELECT id,nome FROM funcionarios WHERE REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ','')=? LIMIT 1", [cpf]) : [[]];
      const erros = [];
      if (!isValidCpf(cpf)) erros.push('CPF inválido');
      if (!employee.length) erros.push('Funcionário não encontrado');
      if (!['FÉRIAS','GESTANTE','PUERPÉRIO','LICENÇA MÉDICA','AFASTADO','OUTRA'].includes(condicao)) erros.push('Condição inválida');
      if (!data) erros.push('Data inválida');
      rows.push({ linha: line, cpf, funcionario: employee[0]?.nome || '', funcionario_id: employee[0]?.id || null, condicao, data_inicio: data, observacao, erros });
    } else {
      const data = iso(cells.getCell(1).value), observacao = String(cells.getCell(2).text || '').trim();
      if (!cells.getCell(1).value && !observacao) continue;
      rows.push({ linha: line, data_presenca: data, observacao, erros: data ? [] : ['Data inválida'] });
    }
  }
  return rows;
}
async function importRows(tipo, rows) {
  check(tipo);
  if (!Array.isArray(rows)) { const error = new Error('Prévia inválida.'); error.status = 400; throw error; }
  return conditions.transaction(async connection => {
    let count = 0;
    for (const row of rows) {
      if (row.erros?.length) continue;
      if (tipo === 'condicoes') {
        const cpf = onlyDigits(row.cpf);
        const [employees] = await connection.query("SELECT id FROM funcionarios WHERE REPLACE(REPLACE(REPLACE(cpf,'.',''),'-',''),' ','')=? LIMIT 1", [cpf]);
        if (!employees.length || !isValidCpf(cpf)) conditions.fail('CPF da planilha inválido ou sem cadastro.');
        await conditions.setCondition(connection, employees[0].id, row.condicao, row.data_inicio, row.observacao);
      } else {
        const day = conditions.date(row.data_presenca);
        if (!day) conditions.fail('Data de presença inválida.');
        await connection.query('INSERT INTO presencas_medicas (empresa_id,data_presenca,medico,observacao) VALUES (NULL,?,NULL,?)', [day, String(row.observacao || '').trim() || null]);
      }
      count++;
    }
    return count;
  });
}
module.exports = { template, analyze, importRows };
