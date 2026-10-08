const ExcelJS = require('exceljs');
const db = require('../services/mysqlService');

const TIPOS = {
  setores: { tabela: 'Setores', nome: 'setores', arquivo: 'setores', colunas: ['Nome'], exemplo: ['Ex.: Internação'] },
  cargos: { tabela: 'Cargos', nome: 'cargos', arquivo: 'cargos', colunas: ['Nome'], exemplo: ['Ex.: Auxiliar de enfermagem'] },
  riscos: { tabela: 'Riscos', nome: 'riscos', arquivo: 'riscos', colunas: ['Grupo', 'Descricao', 'Agravos'], exemplo: ['Biológico', 'Ex.: Vírus e bactérias', 'Ex.: Doenças infectocontagiosas'] },
  exames: { tabela: 'ExamesComplementares', nome: 'exames', arquivo: 'exames', colunas: ['Nome', 'Ordem'], exemplo: ['Ex.: Audiometria tonal', 1] }
};

function tipo(req) {
  const config = TIPOS[String(req.params.tipo || '').toLowerCase()];
  if (!config) throw new Error('Tipo de cadastro inválido.');
  return config;
}

module.exports = {
  async modelo(req, res) {
    try {
      const config = tipo(req);
      const workbook = new ExcelJS.Workbook();
      const sheet = workbook.addWorksheet(config.nome[0].toUpperCase() + config.nome.slice(1));
      sheet.columns = config.colunas.map(nome => ({ header: nome, key: nome, width: nome === 'Descricao' || nome === 'Agravos' ? 48 : 32 }));
      sheet.getRow(1).font = { bold: true, color: { argb: 'FFFFFFFF' } };
      sheet.getRow(1).fill = { type: 'pattern', pattern: 'solid', fgColor: { argb: 'FF075CAE' } };
      sheet.addRow(Object.fromEntries(config.colunas.map((nome, indice) => [nome, config.exemplo[indice]])));
      const buffer = await workbook.xlsx.writeBuffer();
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': `attachment; filename="modelo-${config.arquivo}.xlsx"`,
        'Cache-Control': 'no-store'
      });
      res.send(Buffer.from(buffer));
    } catch (error) {
      console.error(error);
      res.status(400).json({ erro: error.message || 'Falha ao gerar modelo.' });
    }
  },

  async importar(req, res) {
    try {
      const config = tipo(req);
      if (!Buffer.isBuffer(req.body) || !req.body.length) return res.status(400).json({ erro: 'Selecione um arquivo XLSX.' });
      const workbook = new ExcelJS.Workbook();
      await workbook.xlsx.load(req.body);
      const sheet = workbook.worksheets[0];
      if (!sheet) return res.status(400).json({ erro: 'A planilha não possui abas.' });
      const existentes = await db.getAll(config.tabela);
      const campoChave = config.tabela === 'Riscos' ? 'Descricao' : 'Nome';
      const nomes = new Set(existentes.map(item => String(item[campoChave] || '').trim().toLocaleLowerCase('pt-BR')));
      let importados = 0;
      let ignorados = 0;
      for (let linha = 2; linha <= sheet.rowCount; linha += 1) {
        const registro = Object.fromEntries(config.colunas.map((nome, indice) => [nome, String(sheet.getRow(linha).getCell(indice + 1).text || '').trim()]));
        if (config.tabela === 'ExamesComplementares') registro.Ordem = Number(registro.Ordem) || linha - 1;
        const nome = String(registro[campoChave] || '').trim();
        if (!nome || /^ex\.:/i.test(nome)) continue;
        if (config.tabela === 'Riscos' && !registro.Grupo) throw new Error(`Informe o grupo na linha ${linha}.`);
        const chave = nome.toLocaleLowerCase('pt-BR');
        if (nomes.has(chave)) { ignorados += 1; continue; }
        await db.insert(config.tabela, registro);
        nomes.add(chave);
        importados += 1;
      }
      res.json({ sucesso: true, importados, ignorados });
    } catch (error) {
      console.error(error);
      res.status(400).json({ erro: error.message || 'Falha ao importar planilha.' });
    }
  }
};
