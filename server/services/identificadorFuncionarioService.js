const { onlyDigits, isValidCpf } = require('../utils/cpf');
function identifiers(body) {
  if (body.cpf && !/^[\d.\s-]+$/.test(String(body.cpf))) throw new Error('CPF inválido.');
  if (body.cnpj && !/^[\d./\s-]+$/.test(String(body.cnpj))) throw new Error('CNPJ inválido.');
  const cpf = onlyDigits(body.cpf || '');
  const cnpj = onlyDigits(body.cnpj || '');
  let codigo = String(body.codigo_funcionario || '').trim();
  const combinado = String(body.cod_nome || '').trim();
  if (combinado) {
    const match = combinado.match(/^(\d+)\s*-\s*\S.*$/);
    if (!match) throw new Error('Cod + Nome deve estar no formato código - nome.');
    if (codigo && codigo !== match[1]) throw new Error('Código Funcionário e Cod + Nome são diferentes.');
    codigo = match[1];
  }
  if (!cpf && !codigo) throw new Error('Preencha CPF, Código Funcionário ou Cod + Nome.');
  if (cpf && !isValidCpf(cpf)) throw new Error('CPF inválido.');
  if (codigo && !/^\d{1,30}$/.test(codigo)) throw new Error('Código do funcionário inválido.');
  if (codigo && cnpj.length !== 14) throw new Error('Informe o CNPJ da empresa ao usar código.');
  if (cnpj && cnpj.length !== 14) throw new Error('CNPJ inválido.');
  return { cpf, cnpj, codigo };
}
async function resolve(connection, body) {
  const { cpf, cnpj, codigo } = identifiers(body);
  const [rows] = await connection.query('SELECT f.id,f.nome,f.cpf,f.codigo_funcionario,e.cnpj FROM funcionarios f JOIN empresas e ON e.id=f.empresa_id WHERE ' + (cpf ? 'f.cpf=?' : 'f.codigo_funcionario=?') , [cpf || codigo]);
  const matches = rows.filter(r => (!cpf || onlyDigits(r.cpf) === cpf) && (!codigo || String(r.codigo_funcionario || '') === codigo) && (!cnpj || onlyDigits(r.cnpj) === cnpj));
  if (matches.length !== 1) throw new Error('Identificadores sem funcionário único correspondente na empresa.');
  return matches[0];
}
module.exports = { identifiers, resolve };
