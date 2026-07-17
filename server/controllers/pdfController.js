const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const db = require('../services/excelService');
const pdfService = require('../services/pdfService');
const { formatCpf, isValidCpf, onlyDigits } = require('../utils/cpf');

async function montarRiscosDoCargo(cargoId) {
  const [riscoIds, todosRiscos] = await Promise.all([
    db.getRiscosByCargo(cargoId),
    db.getAll('Riscos')
  ]);
  return todosRiscos.filter(r => riscoIds.includes(String(r.ID)));
}

async function montarExamesDoCargo(cargoId) {
  if (!cargoId) return [];
  const [exameIds, todosExames] = await Promise.all([
    db.getExamesByCargo(cargoId),
    db.getExamesComplementares()
  ]);
  return todosExames.filter(exame => exameIds.includes(String(exame.ID)));
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

function serializarDocumentoSnapshot(ctx, dataDocumento) {
  return JSON.stringify({
    versao: 1,
    dataDocumento: dataDocumento.toISOString(),
    colaborador: ctx.colaborador,
    riscos: ctx.riscos,
    config: ctx.config,
    tiposExame: ctx.tiposExame,
    examesComplementares: ctx.examesComplementares,
    conclusao: ctx.conclusao,
    examesDatas: ctx.examesDatas,
    dataAvaliacaoClinica: ctx.dataAvaliacaoClinica
  });
}

function parseDocumentoSnapshot(raw) {
  if (!raw) return null;
  try {
    const snapshot = JSON.parse(String(raw));
    if (!snapshot || !snapshot.colaborador || !Array.isArray(snapshot.riscos) || !snapshot.config) return null;
    return snapshot;
  } catch (_) {
    return null;
  }
}

/**
 * Monta contexto do PDF com dados SALVOS no histórico (download "como foi criado").
 */
async function montarContextoPdfSalvo(registro) {
  const snapshot = parseDocumentoSnapshot(registro.DocumentoSnapshot);
  if (snapshot) {
    return {
      colaborador: snapshot.colaborador,
      riscos: snapshot.riscos,
      config: snapshot.config,
      tiposExame: snapshot.tiposExame || [],
      examesComplementares: snapshot.examesComplementares || [],
      conclusao: snapshot.conclusao || '',
      examesDatas: snapshot.examesDatas || {},
      dataAvaliacaoClinica: snapshot.dataAvaliacaoClinica || '',
      dataDocumento: snapshot.dataDocumento
    };
  }

  // Compatibilidade com históricos emitidos antes do snapshot completo.
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
    montarExamesDoCargo(cargoId),
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
  const { __rowNumber, DocumentoSnapshot, ...rest } = registro;
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

  const [riscosAtuais, examesDoCargo] = await Promise.all([
    montarRiscosDoCargo(cargoId),
    montarExamesDoCargo(cargoId)
  ]);
  const idsPermitidos = new Set(examesDoCargo.map(exame => String(exame.ID)));
  const examesNorm = Object.fromEntries(
    Object.entries(normalizarExamesDatas(examesDatas)).filter(([id]) => idsPermitidos.has(String(id)))
  );

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
        mensagem: 'Dados salvos. Baixar mantém a última versão emitida; use Atualizar para emitir uma nova versão.',
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
      await db.update('HistoricoPDF', registro.ID, {
        DocumentoSnapshot: serializarDocumentoSnapshot(ctx, dataDocumento)
      });
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
      res.json(filtrado.sort((a, b) => {
        const dataA = dayjs(a.DataGeracao, 'DD/MM/YYYY HH:mm', true).valueOf() || 0;
        const dataB = dayjs(b.DataGeracao, 'DD/MM/YYYY HH:mm', true).valueOf() || 0;
        return dataB - dataA || Number(b.ID) - Number(a.ID);
      }).map(serializarHistorico));
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler histórico.' });
    }
  },

  // Download: última versão efetivamente emitida (mantida mesmo após uma edição).
  async download(req, res) {
    try {
      const registro = await db.getById('HistoricoPDF', req.params.id);
      if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });

      const ctx = await montarContextoPdfSalvo(registro);
      const dataDoSnapshot = ctx.dataDocumento ? dayjs(ctx.dataDocumento) : null;
      const dataDoc = dataDoSnapshot && dataDoSnapshot.isValid()
        ? dataDoSnapshot.toDate()
        : dayjs(registro.DataGeracao, 'DD/MM/YYYY HH:mm').isValid()
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

  // Atualizar cria uma nova emissão e mantém o histórico anterior intacto.
  async regerar(req, res) {
    try {
      const registro = await db.getById('HistoricoPDF', req.params.id);
      if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });

      // A nova emissão deve refletir o cadastro atual do funcionário. Isso inclui
      // setor e cargo, que determinam os relacionamentos de riscos e exames.
      const funcionarios = await db.getAll('Funcionarios');
      const funcionarioAtual = funcionarios.find(funcionario =>
        onlyDigits(funcionario.CPF) === onlyDigits(registro.CPF)
      );
      const dadosAtuais = funcionarioAtual ? {
        ...registro,
        Nome: funcionarioAtual.Nome,
        CPF: funcionarioAtual.CPF,
        DataNascimento: funcionarioAtual.DataNascimento,
        CargoID: funcionarioAtual.CargoID,
        SetorID: funcionarioAtual.SetorID
      } : registro;

      const dataGeracao = new Date();
      const ctx = await montarContextoPdf(dadosAtuais);
      const buffer = await pdfService.gerarAsoPdf({ ...ctx, dataDocumento: dataGeracao });

      const idsPermitidos = new Set(ctx.examesComplementares.map(exame => String(exame.ID)));
      const examesDatas = Object.fromEntries(
        Object.entries(ctx.examesDatas || {}).filter(([id]) => idsPermitidos.has(String(id)))
      );
      await db.insert('HistoricoPDF', {
        Nome: dadosAtuais.Nome,
        CPF: dadosAtuais.CPF,
        DataNascimento: dadosAtuais.DataNascimento,
        DataGeracao: dayjs(dataGeracao).format('DD/MM/YYYY HH:mm'),
        Cargo: ctx.cargoAtual ? ctx.cargoAtual.Nome : registro.Cargo,
        Setor: ctx.setorAtual ? ctx.setorAtual.Nome : registro.Setor,
        ArquivoPDF: '',
        TipoExame: registro.TipoExame,
        CargoID: dadosAtuais.CargoID,
        SetorID: dadosAtuais.SetorID,
        Conclusao: registro.Conclusao || '',
        ExamesDatas: JSON.stringify(examesDatas),
        DataAvaliacaoClinica: registro.DataAvaliacaoClinica || '',
        RiscosSnapshot: serializarRiscosSnapshot(ctx.riscos),
        DocumentoSnapshot: serializarDocumentoSnapshot({ ...ctx, examesDatas }, dataGeracao)
      });

      const arquivoNome = pdfService.nomeArquivoAso(dadosAtuais.Nome, dataGeracao);
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
