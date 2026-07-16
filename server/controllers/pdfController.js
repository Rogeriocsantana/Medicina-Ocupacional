const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const db = require('../services/excelService');
const pdfService = require('../services/pdfService');
const { formatCpf, isValidCpf } = require('../utils/cpf');

async function montarRiscosDoCargo(cargoId) {
  const [riscoIds, todosRiscos] = await Promise.all([
    db.getRiscosByCargo(cargoId),
    db.getAll('Riscos')
  ]);
  return todosRiscos.filter(r => riscoIds.includes(String(r.ID)));
}

function serializarRiscosSnapshot(riscos) {
  return JSON.stringify(
    (riscos || []).map(r => ({ ID: r.ID, Grupo: r.Grupo, Descricao: r.Descricao }))
  );
}

function parseRiscosSnapshot(raw) {
  if (!raw) return [];
  try {
    const parsed = JSON.parse(String(raw));
    return Array.isArray(parsed) ? parsed : [];
  } catch (_) {
    return [];
  }
}

/**
 * Monta contexto do PDF com dados SALVOS no histórico (download "como foi criado").
 */
async function montarContextoPdfSalvo(registro) {
  const [config, tiposExame, examesComplementares] = await Promise.all([
    db.getConfig(),
    db.getTiposExame(),
    db.getExamesComplementares()
  ]);

  let riscos = parseRiscosSnapshot(registro.RiscosSnapshot);
  if (!riscos.length && registro.CargoID) {
    riscos = await montarRiscosDoCargo(registro.CargoID);
  }

  return {
    colaborador: {
      nome: registro.Nome,
      cpf: registro.CPF,
      dataNascimento: registro.DataNascimento,
      setorNome: registro.Setor || '',
      cargoNome: registro.Cargo || '',
      tipoExame: registro.TipoExame || 'admissional'
    },
    riscos,
    config,
    tiposExame,
    examesComplementares,
    conclusao: registro.Conclusao || '',
    examesDatas: pdfService.parseExamesDatas(registro.ExamesDatas),
    dataAvaliacaoClinica: registro.DataAvaliacaoClinica || ''
  };
}

/**
 * Monta contexto do PDF com relacionamentos ATUAIS
 * (riscos do cargo, nomes de cargo/setor, config, exames cadastrados).
 */
async function montarContextoPdf(registroLike, extras = {}) {
  const cargoId = registroLike.CargoID || registroLike.cargoId;
  const setorId = registroLike.SetorID || registroLike.setorId;

  const [config, tiposExame, examesComplementares, riscos, setor, cargo] = await Promise.all([
    db.getConfig(),
    db.getTiposExame(),
    db.getExamesComplementares(),
    montarRiscosDoCargo(cargoId),
    setorId ? db.getById('Setores', setorId) : null,
    cargoId ? db.getById('Cargos', cargoId) : null
  ]);

  const examesDatas = extras.examesDatas !== undefined
    ? extras.examesDatas
    : pdfService.parseExamesDatas(registroLike.ExamesDatas || registroLike.examesDatas);

  const conclusao = extras.conclusao !== undefined
    ? extras.conclusao
    : (registroLike.Conclusao || registroLike.conclusao || '');

  const dataAvaliacaoClinica = extras.dataAvaliacaoClinica !== undefined
    ? extras.dataAvaliacaoClinica
    : (registroLike.DataAvaliacaoClinica || registroLike.dataAvaliacaoClinica || '');

  return {
    colaborador: {
      nome: registroLike.Nome || registroLike.nome,
      cpf: registroLike.CPF || registroLike.cpf,
      dataNascimento: registroLike.DataNascimento || registroLike.dataNascimento,
      setorNome: (setor && setor.Nome) || registroLike.Setor || registroLike.setorNome || '',
      cargoNome: (cargo && cargo.Nome) || registroLike.Cargo || registroLike.cargoNome || '',
      tipoExame: registroLike.TipoExame || registroLike.tipoExame || 'admissional'
    },
    riscos,
    config,
    tiposExame,
    examesComplementares,
    conclusao,
    examesDatas,
    dataAvaliacaoClinica,
    setorAtual: setor,
    cargoAtual: cargo
  };
}

function enviarPdf(res, buffer, arquivoNome) {
  res.set({
    'Content-Type': 'application/pdf',
    'Content-Disposition': `attachment; filename="${arquivoNome}"`,
    'Content-Length': buffer.length,
    'Cache-Control': 'no-store'
  });
  res.send(buffer);
}

function normalizarExamesDatas(raw) {
  if (!raw || typeof raw !== 'object') return {};
  const out = {};
  Object.entries(raw).forEach(([k, v]) => {
    if (v) out[String(k)] = String(v);
  });
  return out;
}

function toInputDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d1 = dayjs(s, 'DD/MM/YYYY', true);
  if (d1.isValid()) return d1.format('YYYY-MM-DD');
  const d2 = dayjs(s);
  return d2.isValid() ? d2.format('YYYY-MM-DD') : '';
}

function serializarHistorico(registro) {
  if (!registro) return null;
  const { __rowNumber, ...rest } = registro;
  const examesRaw = pdfService.parseExamesDatas(rest.ExamesDatas);
  const examesDatas = {};
  Object.entries(examesRaw).forEach(([k, v]) => {
    examesDatas[k] = toInputDate(v) || String(v);
  });
  return {
    ...rest,
    DataNascimento: toInputDate(rest.DataNascimento),
    DataAvaliacaoClinica: toInputDate(rest.DataAvaliacaoClinica),
    ExamesDatas: examesDatas,
    Conclusao: rest.Conclusao || ''
  };
}

async function validarFormularioAso(body) {
  const {
    nome, cpf, dataNascimento, setorId, cargoId, tipoExame,
    conclusao, examesDatas, dataAvaliacaoClinica
  } = body;

  if (!nome || !cpf || !dataNascimento || !setorId || !cargoId) {
    return { erro: 'Nome, CPF, Data de Nascimento, Setor e Cargo são obrigatórios.' };
  }
  if (!isValidCpf(cpf)) {
    return { erro: 'CPF inválido.' };
  }

  const [setor, cargo] = await Promise.all([
    db.getById('Setores', setorId),
    db.getById('Cargos', cargoId)
  ]);
  if (!setor) return { erro: 'Setor não encontrado.' };
  if (!cargo) return { erro: 'Cargo não encontrado.' };

  const examesNorm = normalizarExamesDatas(examesDatas);
  const riscosAtuais = await montarRiscosDoCargo(cargoId);

  return {
    dadosColaborador: {
      Nome: String(nome).trim(),
      CPF: formatCpf(cpf),
      DataNascimento: dataNascimento,
      Cargo: cargo.Nome,
      Setor: setor.Nome,
      ArquivoPDF: '',
      TipoExame: tipoExame || 'admissional',
      CargoID: cargoId,
      SetorID: setorId,
      Conclusao: conclusao || '',
      ExamesDatas: JSON.stringify(examesNorm),
      DataAvaliacaoClinica: dataAvaliacaoClinica || ''
    },
    examesNorm,
    riscosAtuais
  };
}

module.exports = {
  async obterHistorico(req, res) {
    try {
      const registro = await db.getById('HistoricoPDF', req.params.id);
      if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });
      res.json(serializarHistorico(registro));
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler registro.' });
    }
  },

  async salvarEdicao(req, res) {
    try {
      const validado = await validarFormularioAso(req.body);
      if (validado.erro) return res.status(400).json({ erro: validado.erro });

      const existente = await db.getById('HistoricoPDF', req.params.id);
      if (!existente) return res.status(404).json({ erro: 'Registro do histórico não encontrado.' });

      const registro = await db.update('HistoricoPDF', req.params.id, {
        ...validado.dadosColaborador,
        RiscosSnapshot: existente.RiscosSnapshot || serializarRiscosSnapshot(validado.riscosAtuais)
      });
      if (!registro) return res.status(404).json({ erro: 'Falha ao atualizar o histórico.' });

      res.json({
        sucesso: true,
        mensagem: 'Dados salvos. Use Baixar (data antiga) ou Atualizar (data nova) no histórico para gerar o PDF.',
        registro: serializarHistorico(registro)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao salvar alterações.' });
    }
  },

  async gerar(req, res) {
    try {
      const validado = await validarFormularioAso(req.body);
      if (validado.erro) return res.status(400).json({ erro: validado.erro });

      const dataDocumento = new Date();
      const registro = await db.insert('HistoricoPDF', {
        ...validado.dadosColaborador,
        DataGeracao: dayjs(dataDocumento).format('DD/MM/YYYY HH:mm'),
        RiscosSnapshot: serializarRiscosSnapshot(validado.riscosAtuais)
      });

      const ctx = await montarContextoPdf(registro, {
        conclusao: registro.Conclusao,
        examesDatas: validado.examesNorm,
        dataAvaliacaoClinica: registro.DataAvaliacaoClinica
      });

      const buffer = await pdfService.gerarAsoPdf({ ...ctx, dataDocumento });
      const arquivoNome = pdfService.nomeArquivoAso(registro.Nome, dataDocumento);
      enviarPdf(res, buffer, arquivoNome);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao gerar PDF.' });
    }
  },

  async listarHistorico(req, res) {
    try {
      const rows = await db.getAll('HistoricoPDF');
      const busca = (req.query.busca || '').toLowerCase().trim();
      const filtrado = busca
        ? rows.filter(r =>
            String(r.Nome).toLowerCase().includes(busca) ||
            String(r.CPF).toLowerCase().includes(busca) ||
            String(r.Cargo).toLowerCase().includes(busca) ||
            String(r.Setor).toLowerCase().includes(busca))
        : rows;
      res.json(filtrado.sort((a, b) => Number(b.ID) - Number(a.ID)));
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler histórico.' });
    }
  },

  // Download: PDF como foi salvo (snapshot de riscos, cargo/setor e data originais)
  async download(req, res) {
    try {
      const registro = await db.getById('HistoricoPDF', req.params.id);
      if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });

      const ctx = await montarContextoPdfSalvo(registro);
      const dataDoc = dayjs(registro.DataGeracao, 'DD/MM/YYYY HH:mm').isValid()
        ? dayjs(registro.DataGeracao, 'DD/MM/YYYY HH:mm').toDate()
        : new Date();

      const buffer = await pdfService.gerarAsoPdf({ ...ctx, dataDocumento: dataDoc });
      const arquivoNome = pdfService.nomeArquivoAso(registro.Nome, dataDoc);
      enviarPdf(res, buffer, arquivoNome);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao gerar PDF para download.' });
    }
  },

  // Regerar: atualiza data, nomes e snapshot de riscos com relacionamentos atuais
  async regerar(req, res) {
    try {
      const registro = await db.getById('HistoricoPDF', req.params.id);
      if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });

      const dataGeracao = new Date();
      const ctx = await montarContextoPdf(registro);

      await db.update('HistoricoPDF', req.params.id, {
        DataGeracao: dayjs(dataGeracao).format('DD/MM/YYYY HH:mm'),
        Cargo: ctx.cargoAtual ? ctx.cargoAtual.Nome : registro.Cargo,
        Setor: ctx.setorAtual ? ctx.setorAtual.Nome : registro.Setor,
        RiscosSnapshot: serializarRiscosSnapshot(ctx.riscos),
        ArquivoPDF: ''
      });

      const buffer = await pdfService.gerarAsoPdf({ ...ctx, dataDocumento: dataGeracao });
      const arquivoNome = pdfService.nomeArquivoAso(registro.Nome, dataGeracao);
      enviarPdf(res, buffer, arquivoNome);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao regerar PDF.' });
    }
  },

  async excluir(req, res) {
    try {
      const registro = await db.getById('HistoricoPDF', req.params.id);
      if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });
      await db.remove('HistoricoPDF', req.params.id);
      res.json({ sucesso: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao excluir registro.' });
    }
  }
};
