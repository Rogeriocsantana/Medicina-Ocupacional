const PDFDocument = require('pdfkit');
const path = require('path');
const db = require('../services/mysqlService');

const TIPOS = {
  atestados: { titulo: 'Atestados por setor', tabela: 'atestados_medicos', data: 'data_inicio', ativo: '', soma: "COALESCE(SUM(IF(a.tipo='DIAS',a.quantidade,a.quantidade/8)),0)", unidade: 'Atestados' },
  'atestados-cid': { titulo: 'Atestados por CID', tabela: 'atestados_medicos', data: 'data_inicio', ativo: '', soma: "COALESCE(SUM(IF(a.tipo='DIAS',a.quantidade,a.quantidade/8)),0)", unidade: 'Atestados' },
  exames: { titulo: 'Exames realizados por setor', tabela: 'exames_realizados', data: 'data_exame', ativo: 'a.ativo=1 AND ', soma: null, unidade: 'Exames' },
  acidentes: { titulo: 'Acidentes / CAT por setor', tabela: 'acidentes_trabalho', data: 'data_acidente', ativo: '', soma: null, unidade: 'Acidentes / CAT' },
  encaminhamentos: { titulo: 'Encaminhamentos por setor', tabela: 'encaminhamentos_ocupacionais', data: 'data_encaminhamento', ativo: '', soma: null, unidade: 'Encaminhamentos' }
};

const MESES = ['Jan', 'Fev', 'Mar', 'Abr', 'Mai', 'Jun', 'Jul', 'Ago', 'Set', 'Out', 'Nov', 'Dez'];
function erroFiltro(message) { const error = new Error(message); error.status = 400; return error; }
function parametros(query) {
  const year = Number(query.ano) || new Date().getFullYear();
  const mes = query.mes ? Number(query.mes) : 12;
  if (!Number.isInteger(year) || year < 1900 || year > 2100) throw erroFiltro('Ano inválido.');
  if (!Number.isInteger(mes) || mes < 1 || mes > 12) throw erroFiltro('Mês inválido.');
  const empresa = query.empresa ? Number(query.empresa) : null;
  if (empresa !== null && (!Number.isInteger(empresa) || empresa < 1)) throw erroFiltro('Empresa inválida.');
  return { year, mes, empresa };
}

async function dadosFechamento(query) {
  const { year, mes, empresa } = parametros(query);
  const filtroFuncionario = empresa ? ' AND f.empresa_id=?' : '';
  const filtroDireto = empresa ? ' AND a.empresa_id=?' : '';
  const params = empresa ? [year, mes, empresa] : [year, mes];
  const fim = `${year}-${String(mes).padStart(2, '0')}-${new Date(year, mes, 0).getDate()}`;
  const inicioAno = `${year}-01-01`;
  const [tiposResult, catsResult, presencasResult, condicoesResult, detalhesCatResult, detalhesGestanteResult, afastamentosAcidenteResult, afastamentosCondicaoResult] = await Promise.all([
    db.pool.query(`SELECT a.tipo_exame nome,MONTH(a.data_exame) mes,COUNT(*) total FROM exames_realizados a JOIN funcionarios f ON f.id=a.funcionario_id WHERE a.ativo=1 AND YEAR(a.data_exame)=? AND MONTH(a.data_exame)<=?${filtroFuncionario} GROUP BY a.tipo_exame,mes`, params),
    db.pool.query(`SELECT MONTH(a.data_acidente) mes,SUM(a.cat_emitida='SIM') cats,SUM(a.afastamento=1) afastamentos FROM acidentes_trabalho a JOIN funcionarios f ON f.id=a.funcionario_id WHERE YEAR(a.data_acidente)=? AND MONTH(a.data_acidente)<=?${filtroFuncionario} GROUP BY mes`, params),
    db.pool.query('SELECT MONTH(a.data_presenca) mes,COUNT(DISTINCT a.data_presenca) dias FROM presencas_medicas a WHERE YEAR(a.data_presenca)=? AND MONTH(a.data_presenca)<=? GROUP BY mes', [year, mes]),
    db.pool.query(`SELECT a.funcionario_id,a.data_inicio,a.data_fim FROM historico_condicoes a WHERE a.condicao='GESTANTE' AND a.corrigido=0 AND a.data_inicio<=? AND (a.data_fim IS NULL OR a.data_fim>=?)${filtroDireto}`, empresa ? [fim, inicioAno, empresa] : [fim, inicioAno]),
    db.pool.query(`SELECT f.id funcionario_id,f.nome funcionario,c.nome cargo,s.nome setor,a.agente_causador agente,a.cat_emitida cat,a.afastamento FROM acidentes_trabalho a JOIN funcionarios f ON f.id=a.funcionario_id JOIN cargos c ON c.id=f.cargo_id JOIN setores s ON s.id=f.setor_id WHERE YEAR(a.data_acidente)=? AND MONTH(a.data_acidente)=?${filtroFuncionario} ORDER BY a.data_acidente,a.id`, empresa ? [year, mes, empresa] : [year, mes]),
    db.pool.query(`SELECT DISTINCT f.id,f.nome funcionario,c.nome cargo,s.nome setor FROM historico_condicoes a JOIN funcionarios f ON f.id=a.funcionario_id JOIN cargos c ON c.id=f.cargo_id JOIN setores s ON s.id=f.setor_id WHERE a.condicao='GESTANTE' AND a.corrigido=0 AND a.data_inicio<=? AND (a.data_fim IS NULL OR a.data_fim>=?)${filtroDireto} ORDER BY f.nome`, empresa ? [fim, `${year}-${String(mes).padStart(2, '0')}-01`, empresa] : [fim, `${year}-${String(mes).padStart(2, '0')}-01`]),
    db.pool.query(`SELECT a.funcionario_id,MONTH(a.data_acidente) mes FROM acidentes_trabalho a JOIN funcionarios f ON f.id=a.funcionario_id WHERE a.afastamento=1 AND YEAR(a.data_acidente)=? AND MONTH(a.data_acidente)<=?${filtroFuncionario}`, params),
    db.pool.query(`SELECT a.funcionario_id,a.data_inicio,a.condicao,f.nome funcionario,c.nome cargo,s.nome setor FROM historico_condicoes a JOIN funcionarios f ON f.id=a.funcionario_id LEFT JOIN cargos c ON c.id=f.cargo_id LEFT JOIN setores s ON s.id=f.setor_id WHERE a.condicao IN ('AFASTADO','LICENÇA MÉDICA') AND a.corrigido=0 AND a.data_inicio>=? AND a.data_inicio<=?${filtroDireto} ORDER BY a.data_inicio,a.id`, empresa ? [inicioAno, fim, empresa] : [inicioAno, fim])
  ]);
  const matrix = new Map();
  for (const item of tiposResult[0]) { const name = String(item.nome || 'NÃO INFORMADO').toUpperCase(); if (!matrix.has(name)) matrix.set(name, Array(mes).fill(0)); matrix.get(name)[Number(item.mes) - 1] += Number(item.total); }
  const linha = (nome, values) => ({ nome, meses: values, total: values.reduce((a, b) => a + b, 0) });
  const tipos = [...matrix].map(([name, values]) => linha(name, values));
  const somar = values => values.reduce((a, b) => a + b, 0);
  const catsMes = Array(mes).fill(0), afastamentosMes = Array(mes).fill(0), presencasMes = Array(mes).fill(0), gestantesMes = Array(mes).fill(0);
  for (const row of catsResult[0]) { catsMes[Number(row.mes) - 1] = Number(row.cats || 0); afastamentosMes[Number(row.mes) - 1] = Number(row.afastamentos || 0); }
  const acidentesAfastados = new Set(afastamentosAcidenteResult[0].map(row => `${row.funcionario_id}:${row.mes}`));
  const condicoesAfastadas = new Set();
  for (const row of afastamentosCondicaoResult[0]) {
    const indice = Number(String(row.data_inicio).slice(5, 7)) - 1;
    const chave = `${row.funcionario_id}:${indice + 1}`;
    if (acidentesAfastados.has(chave) || condicoesAfastadas.has(chave)) continue;
    condicoesAfastadas.add(chave);
    afastamentosMes[indice]++;
  }
  for (const row of presencasResult[0]) presencasMes[Number(row.mes) - 1] = Number(row.dias || 0);
  for (let month = 1; month <= mes; month++) { const start = `${year}-${String(month).padStart(2, '0')}-01`, end = `${year}-${String(month).padStart(2, '0')}-${new Date(year, month, 0).getDate()}`; gestantesMes[month - 1] = new Set(condicoesResult[0].filter(row => String(row.data_inicio).slice(0, 10) <= end && (!row.data_fim || String(row.data_fim).slice(0, 10) >= start)).map(row => row.funcionario_id)).size; }
  const totalMes = Array.from({ length: mes }, (_, index) => tipos.reduce((n, row) => n + row.meses[index], 0));
  const resumo = { atendimentos: somar(totalMes), cats: somar(catsMes), afastamentos: somar(afastamentosMes), presencas: somar(presencasMes), gestantes: gestantesMes[mes - 1] || 0 };
  const afastamentosCatMes = detalhesCatResult[0].filter(row => Number(row.afastamento) === 1);
  const afastadosCatMes = new Set(afastamentosCatMes.map(row => Number(row.funcionario_id)));
  const afastadosCondicaoMes = new Set();
  const afastamentosCondicaoMes = afastamentosCondicaoResult[0].filter(row => {
    if (Number(String(row.data_inicio).slice(5, 7)) !== mes || afastadosCatMes.has(Number(row.funcionario_id)) || afastadosCondicaoMes.has(Number(row.funcionario_id))) return false;
    afastadosCondicaoMes.add(Number(row.funcionario_id));
    return true;
  }).map(row => ({ ...row, agente: row.condicao }));
  return { tipo: 'fechamento', titulo: 'Relatório mensal PCMSO', unidade: 'Atendimentos ocupacionais', year, mes, meses: MESES.slice(0, mes), rows: [], total: resumo.atendimentos, dias: 0, media: 0, resumo, tipos, linhas: [...tipos, linha('TOTAL', totalMes), linha('DIAS MÉDICO TRABALHO', presencasMes), linha('CAT', catsMes), linha('AFASTAMENTOS', afastamentosMes), linha('GESTANTES', gestantesMes)], detalhes: { cat: detalhesCatResult[0].filter(row => row.cat === 'SIM'), afastamentos: [...afastamentosCatMes, ...afastamentosCondicaoMes], gestantes: detalhesGestanteResult[0] } };
}

async function dados(query) {
  const tipo = String(query.tipo || 'atestados');
  if (tipo === 'fechamento') return dadosFechamento(query);
  const config = TIPOS[tipo];
  if (!config) throw erroFiltro('Tipo de relatório inválido.');
  const { year, mes, empresa } = parametros(query);
  const params = [year, mes];
  const filters = [`${config.ativo}YEAR(a.${config.data})=?`, `MONTH(a.${config.data})<=?`];
  if (empresa) { filters.push('f.empresa_id=?'); params.push(empresa); }
  const grupo = tipo === 'atestados-cid' ? "COALESCE(NULLIF(a.cid,''),'Sem CID')" : 's.nome';
  const tituloGrupo = tipo === 'atestados-cid' ? 'CID / descrição' : 'Setor';
  const extra = config.soma ? `,ROUND(${config.soma},1) dias` : '';
  const [result] = await db.pool.query(`SELECT ${grupo} grupo,MONTH(a.${config.data}) mes,COUNT(*) total${extra} FROM ${config.tabela} a JOIN funcionarios f ON f.id=a.funcionario_id JOIN setores s ON s.id=f.setor_id WHERE ${filters.join(' AND ')} GROUP BY grupo,mes ORDER BY grupo,mes`, params);
  const grouped = new Map();
  for (const item of result) {
    const key = String(item.grupo || 'Não informado');
    if (!grouped.has(key)) grouped.set(key, { setor: key, total: 0, dias: 0, meses: Array(mes).fill(0) });
    const row = grouped.get(key);
    row.total += Number(item.total);
    row.dias += Number(item.dias || 0);
    row.meses[Number(item.mes) - 1] = Number(item.total);
  }
  const rows = [...grouped.values()].sort((a, b) => b.total - a.total || a.setor.localeCompare(b.setor, 'pt-BR'));
  if (tipo === 'atestados') rows.forEach(row => { row.atestados = row.total; });
  const total = rows.reduce((n, row) => n + row.total, 0);
  const dias = config.soma ? rows.reduce((n, row) => n + row.dias, 0) : 0;
  return { tipo, titulo: config.titulo, tituloGrupo, unidade: config.unidade, year, mes, meses: MESES.slice(0, mes), rows, total, dias, media: total ? dias / total : 0 };
}

module.exports = {
  async resumo(req, res) {
    try { res.json(await dados(req.query)); }
    catch (error) { console.error(error); res.status(error.status || 500).json({ erro: error.status ? error.message : 'Falha ao gerar relatório.' }); }
  },
  async pdf(req, res) {
    try {
      const report = await dados(req.query);
      let logoEmpresa = null;
      let nomeEmpresa = 'Santa Tereza';
      if (req.query.empresa) {
        const [empresas] = await db.pool.query('SELECT razao_social,logo_data FROM empresas WHERE id=?', [Number(req.query.empresa)]);
        if (empresas[0]?.razao_social) nomeEmpresa = empresas[0].razao_social;
        const logo = String(empresas[0]?.logo_data || '');
        if (/^data:image\/(png|jpeg);base64,[A-Za-z0-9+/=]+$/.test(logo)) logoEmpresa = Buffer.from(logo.split(',')[1], 'base64');
      }
      const doc = new PDFDocument({ size: 'A4', layout: 'landscape', margin: 40 });
      res.set({ 'Content-Type': 'application/pdf', 'Content-Disposition': `attachment; filename="relatorio-${report.tipo}-${report.year}.pdf"`, 'Cache-Control': 'no-store' });
      doc.pipe(res);
      const pageWidth = doc.page.width - 80;
      const period = `Janeiro a ${new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(report.year, report.mes - 1, 1))} de ${report.year}`;
      const header = () => {
        doc.image(logoEmpresa || path.join(__dirname, '../../public/images/logo-relatorios.png'), 40, 29, { fit: [156, 42] });
        doc.fillColor('#111827').fontSize(13).text(report.titulo.toUpperCase(), 240, 34, { width: 360, align: 'center' });
        doc.fontSize(8).fillColor('#667085').text(period, 240, 56, { width: 360, align: 'center' });
        doc.text(`Emitido em ${new Date().toLocaleDateString('pt-BR')}`, 630, 38, { width: 170, align: 'right' });
        doc.strokeColor('#075CAE').lineWidth(1.5).moveTo(40, 79).lineTo(40 + pageWidth, 79).stroke();
      };
      header();
      const stat = (x, label, value) => { doc.strokeColor('#CBD5E1').lineWidth(.6).rect(x, 92, (pageWidth - 20) / 3, 50).stroke(); doc.fillColor('#64748B').fontSize(8).text(label, x + 10, 103); doc.fillColor('#111827').fontSize(15).text(String(value), x + 10, 117); };
      const w = (pageWidth - 20) / 3;
      if (report.tipo === 'fechamento') {
        stat(40, 'Atendimentos ocupacionais', report.resumo.atendimentos);
        stat(50 + w, 'CAT emitidas', report.resumo.cats);
        stat(60 + 2 * w, 'Dias médico do trabalho', report.resumo.presencas);
        const first = 165, totalW = 46, monthW = (pageWidth - first - totalW) / report.meses.length;
        let y = 157;
        doc.rect(40, y, pageWidth, 24).fill('#EAF0F6');
        doc.fillColor('#233448').fontSize(8).text('Indicador', 47, y + 7, { width: first - 8 });
        report.meses.forEach((month, index) => doc.text(month, 40 + first + index * monthW, y + 7, { width: monthW, align: 'center' }));
        doc.text('Geral', 40 + first + report.meses.length * monthW, y + 7, { width: totalW, align: 'center' });
        y += 24;
        for (const row of report.linhas) {
          if (y > 505) { doc.addPage(); header(); y = 105; }
          doc.strokeColor('#CBD5E1').lineWidth(.4).moveTo(40, y + 21).lineTo(40 + pageWidth, y + 21).stroke();
          doc.fillColor('#111827').fontSize(8).text(row.nome, 47, y + 6, { width: first - 8, ellipsis: true });
          row.meses.forEach((value, index) => doc.text(String(value), 40 + first + index * monthW, y + 6, { width: monthW, align: 'center' }));
          doc.text(String(row.total), 40 + first + report.meses.length * monthW, y + 6, { width: totalW, align: 'center' });
          y += 22;
        }
        const sections = [['CAT', report.detalhes.cat], ['AFASTAMENTOS', report.detalhes.afastamentos], ['GESTANTES', report.detalhes.gestantes]];
        if (sections.some(([, rows]) => rows.length)) {
          doc.addPage(); header(); let detailY = 100;
          doc.rect(40, detailY, pageWidth, 22).fill('#E5E9EF');
          doc.fillColor('#000000').fontSize(10).text(new Intl.DateTimeFormat('pt-BR', { month: 'long' }).format(new Date(report.year, report.mes - 1, 1)).toUpperCase(), 40, detailY + 6, { width: pageWidth, align: 'center' });
          detailY += 29;
          for (const [name, rows] of sections) {
            const categoryW = 105, countW = 170, sectorW = 170;
            const agentW = pageWidth - categoryW - countW - sectorW;
            const rowHeights = rows.map(row => {
              const values = [row.cargo, row.setor, name === 'GESTANTES' ? row.funcionario : row.agente];
              return Math.max(18, ...values.map((value, index) => {
                const width = [countW, sectorW, agentW][index] - 8;
                return Math.ceil(doc.fontSize(7.5).heightOfString(String(value || '—'), { width, align: 'center' }) + 10);
              }));
            });
            const rowH = 18, blockH = 24 + (rowHeights.length ? rowHeights.reduce((total, height) => total + height, 0) : rowH);
            if (detailY + blockH > 520) { doc.addPage(); header(); detailY = 100; }
            const x = 40, contentX = x + categoryW, sectorX = contentX + countW, agentX = sectorX + sectorW;
            doc.rect(x, detailY, categoryW, blockH).fillAndStroke('#F3F6F9', '#BFC7D1');
            doc.fillColor('#000000').fontSize(10).text(name === 'GESTANTES' ? 'Gestante' : name === 'AFASTAMENTOS' ? 'Afastamentos' : 'CAT', x + 5, detailY + blockH / 2 - 5, { width: categoryW - 10, align: 'center' });
            doc.rect(contentX, detailY, countW, 24).fillAndStroke('#FF8790', '#BFC7D1');
            doc.fillColor('#000000').fontSize(11).text(String(rows.length), contentX, detailY + 6, { width: countW, align: 'center' });
            doc.rect(sectorX, detailY, sectorW, 24).fillAndStroke('#F7F9FB', '#BFC7D1');
            doc.fillColor('#000000').fontSize(8).text('Setor', sectorX, detailY + 8, { width: sectorW, align: 'center' });
            doc.rect(agentX, detailY, pageWidth - categoryW - countW - sectorW, 24).fillAndStroke('#F7F9FB', '#BFC7D1');
            doc.fillColor('#000000').fontSize(8).text(name === 'GESTANTES' ? 'Funcionário' : 'Agente causador', agentX, detailY + 8, { width: pageWidth - categoryW - countW - sectorW, align: 'center' });
            rows.forEach((row, index) => {
              const rowY = detailY + 24 + rowHeights.slice(0, index).reduce((total, height) => total + height, 0);
              const currentRowH = rowHeights[index];
              const cells = [[contentX, countW, row.cargo], [sectorX, sectorW, row.setor], [agentX, pageWidth - categoryW - countW - sectorW, name === 'GESTANTES' ? row.funcionario : row.agente]];
              cells.forEach(([cellX, cellW, value]) => { doc.rect(cellX, rowY, cellW, currentRowH).stroke('#BFC7D1'); doc.fillColor('#111827').fontSize(7.5).text(String(value || '—'), cellX + 4, rowY + 5, { width: cellW - 8, align: 'center' }); });
            });
            if (!rows.length) {
              const rowY = detailY + 24;
              doc.rect(contentX, rowY, pageWidth - categoryW, rowH).stroke('#BFC7D1');
              doc.fillColor('#64748B').fontSize(8).text('Nenhum registro no mês.', contentX + 4, rowY + 5, { width: pageWidth - categoryW - 8, align: 'center' });
            }
            detailY += blockH + 14;
          }
        }
      } else {
        stat(40, report.unidade, report.total);
        stat(50 + w, report.tipo.startsWith('atestados') ? 'Dias afastados' : 'Grupos com registros', report.tipo.startsWith('atestados') ? report.dias.toFixed(1) : report.rows.length);
        stat(60 + 2 * w, report.tipo.startsWith('atestados') ? 'Média por atestado' : 'Média por grupo', report.tipo.startsWith('atestados') ? `${report.media.toFixed(1)} dia` : (report.rows.length ? (report.total / report.rows.length).toFixed(1) : '0'));
        const columns = report.meses.length;
        const first = 205, totalW = 48, pctW = 42, monthW = (pageWidth - first - totalW - pctW) / columns;
        let y = 160;
        const tableHeader = () => {
          doc.rect(40, y, pageWidth, 24).fill('#EAF0F6');
          doc.fillColor('#233448').fontSize(8).text(report.tituloGrupo, 47, y + 8, { width: first - 12 });
          report.meses.forEach((mes, index) => doc.text(mes, 40 + first + index * monthW, y + 8, { width: monthW, align: 'center' }));
          doc.text('Total', 40 + first + columns * monthW, y + 8, { width: totalW, align: 'center' });
          doc.text('%', 40 + first + columns * monthW + totalW, y + 8, { width: pctW, align: 'center' });
          y += 24;
        };
        tableHeader();
        for (const row of report.rows) {
          if (y > 515) { doc.addPage(); header(); y = 100; tableHeader(); }
          doc.strokeColor('#CBD5E1').lineWidth(.4).moveTo(40, y + 22).lineTo(40 + pageWidth, y + 22).stroke();
          doc.fillColor('#111827').fontSize(8).text(row.setor, 47, y + 7, { width: first - 12, ellipsis: true });
          row.meses.forEach((value, index) => doc.text(String(value), 40 + first + index * monthW, y + 7, { width: monthW, align: 'center' }));
          doc.text(String(row.total), 40 + first + columns * monthW, y + 7, { width: totalW, align: 'center' });
          doc.text(`${report.total ? (row.total / report.total * 100).toFixed(1) : '0,0'}%`, 40 + first + columns * monthW + totalW, y + 7, { width: pctW, align: 'center' });
          y += 23;
        }
        if (!report.rows.length) doc.fillColor('#667085').fontSize(9).text('Nenhum registro no período.', 48, y + 12);
      }
      doc.strokeColor('#CBD5E1').moveTo(40, 537).lineTo(40 + pageWidth, 537).stroke();
      doc.fillColor('#64748B').fontSize(8).text(nomeEmpresa, 40, 542);
      doc.end();
    } catch (error) {
      console.error(error);
      if (!res.headersSent) res.status(error.status || 500).json({ erro: error.status ? error.message : 'Falha ao gerar PDF.' });
    }
  }
};
