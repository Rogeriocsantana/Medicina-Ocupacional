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

function formatDataExtenso(date = new Date(), cidade = 'Campinas') {
  const d = dayjs(date);
  const cidadeBase = String(cidade || 'Campinas').split('/')[0].trim() || 'Campinas';
  return `${cidadeBase}, ${d.date()} de ${MESES_PT[d.month()]} de ${d.year()}`;
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

    const logoPath = resolveLogoPath();
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

    // Estimar altura
    let riscosContentH = 8;
    GRUPOS_ORDEM.forEach(grupo => {
      if (riscosPorGrupo[grupo] && riscosPorGrupo[grupo].length) riscosContentH += 14;
    });
    if (!Object.keys(riscosPorGrupo).length) riscosContentH += 14;
    riscosContentH = Math.max(riscosContentH, 40);

    y = ensureSpace(y, 15 + riscosContentH + 8);
    const riscoTop = y;
    cy = sectionTitle('RISCOS OCUPACIONAIS ESPECÍFICOS', riscoTop, left, pageWidth);
    let ry = cy + 5;
    doc.font('Helvetica').fontSize(8);
    GRUPOS_ORDEM.forEach(grupo => {
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
    const exames = examesComplementares.length
      ? examesComplementares
      : [
          { ID: 'h', Nome: 'Hemograma completo' },
          { ID: 's', Nome: 'Sorologia B e C' },
          { ID: 'v', Nome: 'VDRL' },
          { ID: 'p', Nome: 'Protoparasitológico' },
          { ID: 'c', Nome: 'Coprocultura' },
          { ID: 'm', Nome: 'Micológico de unha' }
        ];

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

function nomeArquivoAso(nome, data = new Date()) {
  const slug = String(nome || 'ASO')
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '_')
    .replace(/^_+|_+$/g, '');
  return `ASO_${slug}_${dayjs(data).format('YYYYMMDD_HHmmss')}.pdf`;
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
  nomeArquivoAso,
  formatDataExtenso,
  formatDateBR,
  parseExamesDatas,
  GRUPOS_ORDEM,
  CONCLUSOES
};
