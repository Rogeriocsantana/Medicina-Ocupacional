const test = require('node:test');
const assert = require('node:assert/strict');
const ExcelJS = require('exceljs');
const db = require('../services/mysqlService');
const service = require('../services/registrosOcupacionaisService');
const cpf = '52998224725', cnpj = '05029064000139';
test('modelo e prévia identificam corretamente sem gravar atestados', async () => {
  const original = db.pool.query;
  db.pool.query = async (sql) => {
    assert.match(sql, /^SELECT/);
    return [[{id: 1,nome:'NOME DO CADASTRO',cpf,codigo_funcionario:'1109',cnpj}]];
  };
  try {
    const w = new ExcelJS.Workbook(); await w.xlsx.load(await service.template('atestados'));
    const s = w.getWorksheet('Registros');
    assert.deepEqual(s.getRow(1).values.slice(1,5),['CPF','Código Funcionário','Cod + Nome','CNPJ da empresa']);
    assert.ok(w.getWorksheet('Instruções'));
    const row = values => s.addRow([values.cpf||'',values.code||'',values.name||'',values.cnpj||'', '06/10/2026','06/10/2026','',values.tipo||'DIAS',2]);
    row({cpf});
    row({code:'1109',cnpj});
    row({name:'1109 - NOME DA ORIGEM',cnpj});
    row({code:'1109'});
    row({cpf,code:'22',cnpj});
    row({name:'1109 - NOME',code:'22',cnpj});
    row({});
    row({cpf:'abc',code:'1109',cnpj});
    row({cpf,tipo:'INVALIDO'});
    const result = await service.analyze('atestados',await w.xlsx.writeBuffer());
    assert.equal(result.length,9);
    result.slice(0,3).forEach(r=>{assert.deepEqual(r.erros,[]);assert.equal(r.funcionario_id,1);assert.equal(r.funcionario,'NOME DO CADASTRO');});
    result.slice(3).forEach(r=>assert.ok(r.erros.length));
    assert.equal(result[2].cod_nome,'1109 - NOME DA ORIGEM');
    assert.equal(result[2].cpf,'529.982.247-25');
    await assert.rejects(service.save('atestados',null,{origem:'IMPORTACAO',cpf,funcionario_id:2,tipo:'DIAS',quantidade:2,data:'2026-10-06'}),/outro funcionário/);
  } finally { db.pool.query = original; await db.close(); }
});
