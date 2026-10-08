const fs = require('fs');
const path = require('path');
const PDFDocument = require('pdfkit');
const dayjs = require('dayjs');
const { getResourceRoot, getDataRoot } = require('../paths');

require('dayjs/locale/pt-br');
dayjs.locale('pt-br');

const GRUPOS_ORDEM = ['Biológico', 'Físico', 'Químico', 'Ergonômico', 'Acidente'];

const CONCLUSOES = [
  { chave: 'apto', nome: 'Apto' },
  { chave: 'inapto', nome: 'Inapto' },
  { chave: 'apto_altura', nome: 'Apto para trabalho em altura' },
  { chave: 'apto_recomendacao', nome: 'Apto com recomendações' }
];

const MESES_PT = [
  'janeiro', 'fevereiro', 'março', 'abril', 'maio', 'junho',
  'julho', 'agosto', 'setembro', 'outubro', 'novembro', 'dezembro'
];

function resolveLogoPath() {
  const candidates = [
    path.join(getDataRoot(), 'public', 'images', 'logo-completo.png'),
    path.join(getResourceRoot(), 'public', 'images', 'logo-completo.png')
  ];
  return candidates.find(p => fs.existsSync(p)) || null;
}

function resolveLogo(config = {}) {
  const custom = String(config.LogoData || '').trim();
  const match = custom.match(/^data:image\/(?:png|jpe?g);base64,([A-Za-z0-9+/=]+)$/i);
  if (match) {
    try {
      const buffer = Buffer.from(match[1], 'base64');
      if (buffer.length) return buffer;
    } catch (_) {}
  }
  return resolveLogoPath();
}

function formatDataExtenso(date = new Date(), cidade = 'Campinas') {
  return 'Campinas, ____ de __________________ de 2026';
}

function formatDateBR(value) {
  if (!value) return '';
  const d = dayjs(value);
  return d.isValid() ? d.format('DD/MM/YYYY') : String(value);
}

function dataOuLinhas(value) {
  const br = formatDateBR(value);
  return br || '____/____/________';
}

/**
 * Gera o PDF do ASO em memória (Buffer).
 */
function gerarAsoPdf({
  colaborador,
  riscos,
  config,
  tiposExame = [],
  examesComplementares = [],
  dataDocumento = new Date(),
  conclusao = '',
  examesDatas = {},
  dataAvaliacaoClinica = ''
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 36, bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const empresa = {
      razaoSocial: config.RazaoSocial || '',
      cnpj: config.CNPJ || '',
      endereco: config.Endereco || '',
      bairro: config.Bairro || '',
      cidadeUf: config.CidadeUf || '',
      cep: config.Cep || '',
      telefone: config.Telefone || ''
    };
    const responsavel = {
      hospital: config.HospitalNome || '',
      medico: config.Medico || '',
      crm: config.CRM || '',
      especialidade: config.Especialidade || '',
      rqe: config.RQE || ''
    };

    const logoPath = resolveLogo(config);
    const pageWidth = doc.page.width - doc.page.margins.left - doc.page.margins.right;
    const left = doc.page.margins.left;
    const stroke = '#000000';
    const bottomLimit = doc.page.height - doc.page.margins.bottom;

    function strokeRect(x, y, w, h) {
      doc.lineWidth(0.8).rect(x, y, w, h).stroke(stroke);
    }

    function hLine(x1, x2, y) {
      doc.lineWidth(0.6).moveTo(x1, y).lineTo(x2, y).stroke(stroke);
    }

    function vLine(x, y1, y2) {
      doc.lineWidth(0.6).moveTo(x, y1).lineTo(x, y2).stroke(stroke);
    }

    function ensureSpace(currentY, neededHeight) {
      if (currentY + neededHeight > bottomLimit) {
        doc.addPage();
        return doc.page.margins.top;
      }
      return currentY;
    }

    /** Título interno de seção (faixa superior) + retorna y do conteúdo */
    function sectionTitle(text, boxTop, boxLeft, boxW) {
      const titleH = 15;
      doc.rect(boxLeft, boxTop, boxW, titleH).fill('#f0f0f0');
      doc.fillColor('#000').font('Helvetica-Bold').fontSize(9)
        .text(text, boxLeft + 5, boxTop + 3.5, { width: boxW - 10 });
      hLine(boxLeft, boxLeft + boxW, boxTop + titleH);
      return boxTop + titleH;
    }

    // ---- CABEÇALHO ----
    let y = doc.page.margins.top;
    const headerH = 56;
    strokeRect(left, y, pageWidth, headerH);
    if (logoPath) {
      doc.image(logoPath, left + 8, y + 8, { fit: [140, 40] });
      doc.font('Helvetica-Bold').fontSize(10)
        .text('Programa de Controle Médico de Saúde Ocupacional', left + 155, y + 12, {
          width: pageWidth - 165, align: 'center'
        });
      doc.font('Helvetica-Bold').fontSize(10)
        .text('Atestado de Saúde Ocupacional - ASO (NR-7)', left + 155, y + 30, {
          width: pageWidth - 165, align: 'center'
        });
    } else {
      doc.font('Helvetica-Bold').fontSize(11)
        .text(responsavel.hospital || empresa.razaoSocial, left + 8, y + 8, { width: pageWidth - 16 });
      doc.font('Helvetica-Bold').fontSize(10)
        .text('Programa de Controle Médico de Saúde Ocupacional', left + 8, y + 24, {
          width: pageWidth - 16, align: 'center'
        });
      doc.font('Helvetica-Bold').fontSize(10)
        .text('Atestado de Saúde Ocupacional - ASO (NR-7)', left + 8, y + 38, {
          width: pageWidth - 16, align: 'center'
        });
    }
    y += headerH + 4;

    // ---- EMPRESA ----
    const empH = 78;
    y = ensureSpace(y, empH);
    const empTop = y;
    let cy = sectionTitle('EMPRESA', empTop, left, pageWidth);
    const midX = left + pageWidth / 2;
    const rowH = (empH - 15) / 4;
    // Linhas de grade
    for (let i = 1; i < 4; i++) hLine(left, left + pageWidth, cy + i * rowH);
    vLine(midX, cy + rowH, cy + 4 * rowH); // coluna a partir da 2ª linha

    doc.font('Helvetica').fontSize(8);
    const pad = 4;
    // Linha 1: Razão Social (largura total)
    doc.font('Helvetica-Bold').text('Razão Social: ', left + pad, cy + 3, { continued: true });
    doc.font('Helvetica').text(empresa.razaoSocial, { width: pageWidth - 12 });

    // Linha 2: CNPJ | Endereço
    doc.font('Helvetica-Bold').text('CNPJ: ', left + pad, cy + rowH + 3, { continued: true });
    doc.font('Helvetica').text(empresa.cnpj);
    doc.font('Helvetica-Bold').text('Endereço: ', midX + pad, cy + rowH + 3, { continued: true });
    doc.font('Helvetica').text(empresa.endereco, { width: pageWidth / 2 - 12 });

    // Linha 3: Cidade/UF | Bairro
    doc.font('Helvetica-Bold').text('Cidade/UF: ', left + pad, cy + 2 * rowH + 3, { continued: true });
    doc.font('Helvetica').text(empresa.cidadeUf);
    doc.font('Helvetica-Bold').text('Bairro: ', midX + pad, cy + 2 * rowH + 3, { continued: true });
    doc.font('Helvetica').text(empresa.bairro);

    // Linha 4: CEP | Telefone
    doc.font('Helvetica-Bold').text('CEP: ', left + pad, cy + 3 * rowH + 3, { continued: true });
    doc.font('Helvetica').text(empresa.cep);
    doc.font('Helvetica-Bold').text('Telefone: ', midX + pad, cy + 3 * rowH + 3, { continued: true });
    doc.font('Helvetica').text(empresa.telefone);

    strokeRect(left, empTop, pageWidth, empH);
    y = empTop + empH + 4;

    // ---- COLABORADOR ----
    const tipos = tiposExame.length
      ? tiposExame
      : [
          { Chave: 'admissional', Nome: 'Admissional' },
          { Chave: 'periodico', Nome: 'Periódico' },
          { Chave: 'retorno', Nome: 'Retorno ao Trabalho' },
          { Chave: 'mudanca', Nome: 'Mudança de Função' },
          { Chave: 'demissional', Nome: 'Demissional' }
        ];

    const colabTop = y;
    cy = sectionTitle('COLABORADOR', colabTop, left, pageWidth);
    const colabRows = 3;
    const colabRowH = 16;
    const dadosH = colabRows * colabRowH;
    for (let i = 1; i < colabRows; i++) hLine(left, left + pageWidth, cy + i * colabRowH);
    hLine(left, left + pageWidth, cy + dadosH);
    vLine(midX, cy + colabRowH, cy + dadosH);

    doc.font('Helvetica-Bold').fontSize(8).text('Nome: ', left + pad, cy + 3, { continued: true });
    doc.font('Helvetica').text(colaborador.nome || '', { width: pageWidth - 12 });

    doc.font('Helvetica-Bold').text('RG/CPF: ', left + pad, cy + colabRowH + 3, { continued: true });
    doc.font('Helvetica').text(colaborador.cpf || '');
    doc.font('Helvetica-Bold').text('Data de Nascimento: ', midX + pad, cy + colabRowH + 3, { continued: true });
    doc.font('Helvetica').text(formatDateBR(colaborador.dataNascimento));

    doc.font('Helvetica-Bold').text('Função: ', left + pad, cy + 2 * colabRowH + 3, { continued: true });
    doc.font('Helvetica').text(colaborador.cargoNome || '');
    doc.font('Helvetica-Bold').text('Setor: ', midX + pad, cy + 2 * colabRowH + 3, { continued: true });
    doc.font('Helvetica').text(colaborador.setorNome || '');

    let textY = cy + dadosH + 4;
    doc.font('Helvetica').fontSize(7).text(
      'Em cumprimento ao disposto no Artigo 168 da CLT e na NR-7 do MTE, aprovada pela Portaria Nº 3.214 de 08/06/78, ' +
      'modificada pela Portaria Nº 24 de 29/12/94, pela Portaria Nº 08 de 08/05/96, pela Portaria Nº 19 de 09/04/98, ' +
      'pela Portaria Nº 223 de 06/05/11, pela Portaria Nº 236 de 10/06/11 e pela Portaria Nº 1.892 de 09/12/13, para fins de exame:',
      left + pad, textY, { width: pageWidth - 10, align: 'justify' }
    );
    textY = doc.y + 6;

    const tipoColW = (pageWidth - 8) / tipos.length;
    tipos.forEach((tipo, idx) => {
      const marked = String(colaborador.tipoExame) === String(tipo.Chave);
      const x = left + 4 + idx * tipoColW;
      doc.rect(x, textY, 8, 8).stroke(stroke);
      if (marked) doc.font('Helvetica-Bold').fontSize(8).text('X', x + 1.2, textY - 0.5);
      doc.font('Helvetica').fontSize(7).text(tipo.Nome, x + 11, textY, { width: tipoColW - 14 });
    });
    textY += 14;

    const colabH = textY - colabTop + 4;
    strokeRect(left, colabTop, pageWidth, colabH);
    y = colabTop + colabH + 4;

    // ---- RISCOS ----
    const riscosPorGrupo = {};
    (riscos || []).forEach(r => {
      if (!riscosPorGrupo[r.Grupo]) riscosPorGrupo[r.Grupo] = [];
      riscosPorGrupo[r.Grupo].push(r.Descricao);
    });
    const gruposPresentes = Object.keys(riscosPorGrupo);
    const gruposOrdenados = [
      ...GRUPOS_ORDEM.filter(grupo => gruposPresentes.includes(grupo)),
      ...gruposPresentes
        .filter(grupo => !GRUPOS_ORDEM.includes(grupo))
        .sort((a, b) => a.localeCompare(b, 'pt-BR'))
    ];

    // Estimar altura
    let riscosContentH = 8;
    gruposOrdenados.forEach(grupo => {
      if (riscosPorGrupo[grupo] && riscosPorGrupo[grupo].length) riscosContentH += 14;
    });
    if (!Object.keys(riscosPorGrupo).length) riscosContentH += 14;
    riscosContentH = Math.max(riscosContentH, 40);

    y = ensureSpace(y, 15 + riscosContentH + 8);
    const riscoTop = y;
    cy = sectionTitle('RISCOS OCUPACIONAIS ESPECÍFICOS', riscoTop, left, pageWidth);
    let ry = cy + 5;
    doc.font('Helvetica').fontSize(8);
    gruposOrdenados.forEach(grupo => {
      const desc = riscosPorGrupo[grupo];
      if (!desc || !desc.length) return;
      ry = ensureSpace(ry, 20);
      // se mudou de página, redesenhar é complexo — manter simples
      doc.font('Helvetica-Bold').text(`Risco ${grupo}: `, left + pad, ry, { continued: true, width: pageWidth - 10 });
      doc.font('Helvetica').text(desc.join(' '));
      ry = doc.y + 3;
    });
    if (!Object.keys(riscosPorGrupo).length) {
      doc.font('Helvetica-Oblique').fontSize(8)
        .text('Nenhum risco ocupacional cadastrado para este cargo.', left + pad, ry);
      ry = doc.y + 3;
    }
    const riscoH = Math.max(ry - riscoTop + 4, 15 + 30);
    strokeRect(left, riscoTop, pageWidth, riscoH);
    y = riscoTop + riscoH + 4;

    // ---- EXAMES ----
    const exames = examesComplementares || [];

    const examLines = 3 + exames.length; // obs + avaliacao + blank + exams
    const examEstH = 15 + 12 + 14 + examLines * 13 + 8;
    y = ensureSpace(y, Math.min(examEstH, 200));
    const examTop = y;
    cy = sectionTitle('AVALIAÇÃO CLÍNICA E EXAMES COMPLEMENTARES REALIZADOS', examTop, left, pageWidth);
    let ey = cy + 4;
    doc.font('Helvetica').fontSize(7).text(
      'Obs.: Os resultados dos exames complementares encontram-se em prontuário médico.',
      left + pad, ey, { width: pageWidth - 10 }
    );
    ey = doc.y + 4;
    doc.font('Helvetica').fontSize(8).text(
      `Avaliação clínica com anamnese ocupacional e exame físico e mental: ${dataOuLinhas(dataAvaliacaoClinica)}`,
      left + pad, ey, { width: pageWidth - 10 }
    );
    ey = doc.y + 6;

    exames.forEach(ex => {
      ey = ensureSpace(ey, 16);
      const key = String(ex.ID);
      const dataEx = examesDatas[key] || examesDatas[ex.Nome] || '';
      doc.font('Helvetica').fontSize(8)
        .text(`${ex.Nome}: ${dataOuLinhas(dataEx)}`, left + pad, ey);
      ey = doc.y + 3;
    });

    const examH = ey - examTop + 4;
    strokeRect(left, examTop, pageWidth, examH);
    y = examTop + examH + 4;

    // ---- CONCLUSÃO ----
    y = ensureSpace(y, 40);
    const concTop = y;
    cy = sectionTitle('CONCLUSÃO', concTop, left, pageWidth);
    let cx = left + pad;
    const concY = cy + 6;
    CONCLUSOES.forEach(c => {
      const marked = String(conclusao) === String(c.chave);
      doc.rect(cx, concY, 8, 8).stroke(stroke);
      if (marked) doc.font('Helvetica-Bold').fontSize(8).text('X', cx + 1.2, concY - 0.5);
      doc.font('Helvetica').fontSize(8).text(c.nome, cx + 11, concY);
      cx += 11 + doc.widthOfString(c.nome) + 14;
    });
    const concH = 15 + 22;
    strokeRect(left, concTop, pageWidth, concH);
    y = concTop + concH + 4;

    // ---- MÉDICO ----
    y = ensureSpace(y, 40);
    const medTop = y;
    cy = sectionTitle('MÉDICO COORDENADOR DO PCMSO', medTop, left, pageWidth);
    doc.font('Helvetica').fontSize(8).text(
      `${responsavel.medico} - ${responsavel.crm} - ${responsavel.especialidade} - ${responsavel.rqe}`,
      left + pad, cy + 6, { width: pageWidth - 10 }
    );
    const medH = 15 + 22;
    strokeRect(left, medTop, pageWidth, medH);
    y = medTop + medH + 10;

    // ---- RODAPÉ ----
    y = ensureSpace(y, 90);
    doc.font('Helvetica').fontSize(9).text(formatDataExtenso(dataDocumento, empresa.cidadeUf) + '.', left, y);
    y = doc.y + 8;
    doc.font('Helvetica').fontSize(7).text(
      'Declaro ter recebido cópia deste ASO nesta data. Declaro ter ciência de que a realização do exame não é ' +
      'caracterizado como garantia de contratação. Declaro ter compreendido plenamente o conteúdo deste, inclusive ' +
      'os riscos aos quais estou exposto e os resultados dos procedimentos médicos.',
      left, y, { width: pageWidth, align: 'justify' }
    );
    y = doc.y + 28;

    const sigColW = pageWidth / 2 - 12;
    doc.moveTo(left, y).lineTo(left + sigColW, y).stroke(stroke);
    doc.moveTo(left + pageWidth - sigColW, y).lineTo(left + pageWidth, y).stroke(stroke);
    doc.fontSize(7).text('Assinatura do Profissional', left, y + 4, { width: sigColW, align: 'center' });
    doc.text('Assinatura do Médico Examinador', left + pageWidth - sigColW, y + 4, { width: sigColW, align: 'center' });

    doc.end();
  });
}

function gerarFichaClinicaPdf({
  colaborador,
  config = {},
  perguntasAdmissionais = [],
  dataDocumento = new Date()
}) {
  return new Promise((resolve, reject) => {
    const doc = new PDFDocument({ size: 'A4', margin: 32, bufferPages: true });
    const chunks = [];
    doc.on('data', chunk => chunks.push(chunk));
    doc.on('end', () => resolve(Buffer.concat(chunks)));
    doc.on('error', reject);

    const left = doc.page.margins.left;
    const width = doc.page.width - left - doc.page.margins.right;
    const bottom = doc.page.height - doc.page.margins.bottom;
    const tipo = String(colaborador.tipoExame || '').toLowerCase();
    const admissional = tipo === 'admissional';
    const stroke = '#111827';

    function caixa(x, y, w, h, fill = null) {
      if (fill) {
        doc.rect(x, y, w, h).fillAndStroke(fill, stroke);
        doc.fillColor('#111827');
      }
      else doc.rect(x, y, w, h).stroke(stroke);
    }
    function linha(x1, y1, x2, y2, espessura = 0.8) {
      doc.save().strokeColor(stroke).lineWidth(espessura).moveTo(x1, y1).lineTo(x2, y2).stroke().restore();
    }
    function linhaPreenchimento(x1, y1, x2, espessura = 0.65) {
      doc.save().fillColor(stroke).rect(x1, y1, Math.max(0, x2 - x1), espessura).fill().restore();
    }
    function marcado(chave) { return tipo === chave ? 'X' : ' '; }
    function cabecalho(continuacao = false) {
      let y = doc.page.margins.top;
      caixa(left, y, width, 42, '#f3f4f6');
      const logo = resolveLogo(config);
      if (logo) doc.image(logo, left + 7, y + 7, { fit: [120, 28] });
      doc.fillColor('#111827').font('Helvetica-Bold').fontSize(15)
        .text(`ANAMNESE CLÍNICA${continuacao ? ' - CONTINUAÇÃO' : ''}`, left + 130, y + 12, { width: width - 140, align: 'center' });
      y += 46;
      if (continuacao) return y;
      caixa(left, y, width, 58);
      const half = width / 2;
      linha(left, y + 20, left + width, y + 20);
      linha(left, y + 39, left + width, y + 39);
      linha(left + half, y + 20, left + half, y + 58);
      doc.font('Helvetica-Bold').fontSize(8).text('Nome: ', left + 5, y + 6, { continued: true });
      doc.font('Helvetica').text(colaborador.nome || '');
      doc.font('Helvetica-Bold').text('Função: ', left + 5, y + 26, { continued: true });
      doc.font('Helvetica').text(colaborador.cargoNome || '', { width: half - 55 });
      doc.font('Helvetica-Bold').text('D.N.: ', left + half + 5, y + 26, { continued: true });
      doc.font('Helvetica').text(formatDateBR(colaborador.dataNascimento));
      doc.font('Helvetica-Bold').text('Setor: ', left + 5, y + 45, { continued: true });
      doc.font('Helvetica').text(colaborador.setorNome || '', { width: half - 50 });
      doc.font('Helvetica-Bold').text('CPF: ', left + half + 5, y + 45, { continued: true });
      doc.font('Helvetica').text(colaborador.cpf || '');
      y += 62;
      caixa(left, y, width, 25);
      doc.font('Helvetica').fontSize(7.5).text(
        `[${marcado('admissional')}] Admissional    [${marcado('periodico')}] Periódico    ` +
        `[${marcado('retorno')}] Retorno ao Trabalho    [${marcado('mudanca')}] Mudança de Risco Ocupacional    ` +
        `[${marcado('demissional')}] Demissional`,
        left + 7, y + 8, { width: width - 14, align: 'center' }
      );
      return y + 29;
    }

    function renderHistoricoClinicoOcupacional() {
      doc.font('Helvetica-Bold').fontSize(9).text('HISTÓRICO CLÍNICO / OCUPACIONAL', left, y + 2, { width, align: 'center' });
      y += 24;
      doc.font('Helvetica').fontSize(8);
      function campoSublinhado(rotulo, altura = 24) {
        doc.text(`${rotulo}:`, left, y + 2);
        const inicioLinha = left + doc.widthOfString(`${rotulo}:`) + 4;
        linhaPreenchimento(inicioLinha, y + 12, left + width);
        y += altura;
      }

      campoSublinhado('Queixas');
      campoSublinhado('AP');
      campoSublinhado('Medicamentos');
      campoSublinhado('Antecedentes Psiquiátricos');

      y += 6;
      doc.text('G', left, y + 2);
      linhaPreenchimento(left + 14, y + 12, left + 48);
      doc.text('P', left + 66, y + 2);
      linhaPreenchimento(left + 80, y + 12, left + 114);
      doc.text('A', left + 132, y + 2);
      linhaPreenchimento(left + 146, y + 12, left + 180);
      const dumX = left + 205;
      doc.text('DUM:', dumX, y + 2);
      linhaPreenchimento(dumX + 31, y + 12, dumX + 59);
      doc.text('/', dumX + 63, y + 2);
      linhaPreenchimento(dumX + 72, y + 12, dumX + 100);
      doc.text('/', dumX + 104, y + 2);
      linhaPreenchimento(dumX + 113, y + 12, dumX + 151);
      const macX = left + 365;
      doc.text('MAC:', macX, y + 2);
      linhaPreenchimento(macX + 31, y + 12, left + width);
      y += 34;

      [
        'Cirurgias prévias', 'Fraturas', 'Alergias', 'Tabagismo', 'Etilismo',
        'Atividade Física', 'Histórico Laboral', 'Afastamento INSS',
        'Acidente de Trabalho'
      ].forEach(rotulo => campoSublinhado(rotulo));

      campoSublinhado('Exames Laboratoriais', 30);
      linhaPreenchimento(left, y + 6, left + width);
      y += 30;
      linhaPreenchimento(left, y, left + width, 1.1);
      y += 18;
      campoSublinhado('Exame Físico', 30);
      linhaPreenchimento(left, y + 6, left + width);
      y += 18;

      doc.font('Helvetica').fontSize(8).text('(     ) Destro       (     ) Canhoto', left, y);
      doc.text('SSVV', left + width * 0.67, y, { width: width * 0.33, align: 'center' });
      y += 19;
      const sinais = ['AR', 'ACV', 'Abdômen', 'Osteomuscular', 'Outros'];
      const vitais = ['Peso', 'Altura', 'PA', 'Saturação'];
      const colunaDireita = left + width * 0.59;
      const fimLinhaEsquerda = left + width * 0.45;
      const fimLinhaDireita = left + width;
      sinais.forEach((campo, index) => {
        const linhaY = y + index * 19 + 10;
        doc.text(`${campo}:`, left, y + index * 19);
        const inicioEsquerda = left + doc.widthOfString(`${campo}:`) + 4;
        linhaPreenchimento(inicioEsquerda, linhaY, fimLinhaEsquerda);
        if (vitais[index]) {
          doc.text(`${vitais[index]}:`, colunaDireita, y + index * 19);
          const inicioDireita = colunaDireita + doc.widthOfString(`${vitais[index]}:`) + 4;
          linhaPreenchimento(inicioDireita, linhaY, fimLinhaDireita);
        }
      });
      y += 107;
      linhaPreenchimento(left + width * 0.58, y, left + width, 0.8);
      doc.fontSize(7).text(
        `${config.Medico || 'Médico examinador'} - ${config.CRM || ''}`,
        left + width * 0.58, y + 4, { width: width * 0.42, align: 'center' }
      );
      doc.fontSize(8).text('Campinas, ______ de __________________________ de 2026.', left, y - 6, { width: width * 0.5 });
    }

    let y = cabecalho();
    if (admissional) {
      const colPergunta = width * 0.49;
      const colSim = 34;
      const colNao = 34;
      const colComp = width - colPergunta - colSim - colNao;
      function tituloTabela() {
        caixa(left, y, width, 19, '#e5e7eb');
        linha(left + colPergunta, y, left + colPergunta, y + 19);
        linha(left + colPergunta + colSim, y, left + colPergunta + colSim, y + 19);
        linha(left + colPergunta + colSim + colNao, y, left + colPergunta + colSim + colNao, y + 19);
        doc.font('Helvetica-Bold').fontSize(7).text('PERGUNTA', left + 4, y + 6, { width: colPergunta - 8 });
        doc.text('SIM', left + colPergunta, y + 6, { width: colSim, align: 'center' });
        doc.text('NÃO', left + colPergunta + colSim, y + 6, { width: colNao, align: 'center' });
        doc.text('COMPLEMENTO', left + colPergunta + colSim + colNao + 4, y + 6, { width: colComp - 8 });
        y += 19;
      }
      tituloTabela();
      for (const item of perguntasAdmissionais) {
        doc.font('Helvetica').fontSize(6.3);
        const h = 17;
        if (y + h > bottom - 72) {
          doc.addPage();
          y = cabecalho(true);
          tituloTabela();
        }
        caixa(left, y, width, h);
        linha(left + colPergunta, y, left + colPergunta, y + h);
        linha(left + colPergunta + colSim, y, left + colPergunta + colSim, y + h);
        linha(left + colPergunta + colSim + colNao, y, left + colPergunta + colSim + colNao, y + h);
        doc.text(String(item.Pergunta || ''), left + 4, y + 4.5, { width: colPergunta - 8, lineBreak: false });
        doc.fontSize(8).text('(   )', left + colPergunta, y + 4, { width: colSim, align: 'center' });
        doc.text('(   )', left + colPergunta + colSim, y + 5, { width: colNao, align: 'center' });
        doc.fontSize(6.1).text(item.Complemento || '', left + colPergunta + colSim + colNao + 4, y + 4.5, { width: colComp - 8, lineBreak: false });
        y += h;
      }
      if (y + 67 > bottom) { doc.addPage(); y = cabecalho(true); }
      y += 7;
      doc.font('Helvetica').fontSize(7.5).text(
        'Declaro que as informações acima prestadas são totalmente verdadeiras.',
        left, y, { width, align: 'center' }
      );
      y += 54;
      linhaPreenchimento(left + width * 0.58, y, left + width, 0.8);
      doc.fontSize(7).text('Campinas, ______ de __________________________ de 2026.', left, y - 5, { width: width * 0.52 });
      doc.text('Assinatura do Profissional', left + width * 0.58, y + 4, { width: width * 0.42, align: 'center' });

      // O modelo admissional possui uma segunda folha clínica além do questionário.
      doc.addPage();
      y = cabecalho();
      renderHistoricoClinicoOcupacional();
    } else {
      renderHistoricoClinicoOcupacional();
    }

    doc.end();
  });
}

function nomeArquivoAso(nome, data = new Date()) {
  const slug = String(nome || 'ASO')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `ASO_${slug}_${dayjs(data).format('YYYYMMDD_HHmmss')}.pdf`;
}

function nomeArquivoFichaClinica(nome, tipoExame, data = new Date()) {
  const slug = String(nome || 'Colaborador')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  const tipo = String(tipoExame || 'anamnese')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_').replace(/^_+|_+$/g, '');
  return `Ficha_Clinica_${tipo}_${slug}_${dayjs(data).format('YYYYMMDD_HHmmss')}.pdf`;
}

function parseExamesDatas(raw) {
  if (!raw) return {};
  if (typeof raw === 'object') return raw;
  try {
    const parsed = JSON.parse(String(raw));
    return parsed && typeof parsed === 'object' ? parsed : {};
  } catch (_) {
    return {};
  }
}

module.exports = {
  gerarAsoPdf,
  gerarFichaClinicaPdf,
  nomeArquivoAso,
  nomeArquivoFichaClinica,
  formatDataExtenso,
  formatDateBR,
  parseExamesDatas,
  GRUPOS_ORDEM,
  CONCLUSOES
};
