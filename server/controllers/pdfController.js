const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const db = require('../services/mysqlService');
const pdfService = require('../services/pdfService');
const registrosService = require('../services/registrosOcupacionaisService');
const { formatCpf, isValidCpf, onlyDigits } = require('../utils/cpf');

function normalizarTipoDocumento(tipoExame) {
  const tipo = String(tipoExame || '').toLowerCase();
  return tipo === 'demissional' || tipo.startsWith('demissional_') ? 'demissional' : tipoExame;
}

function normalizarTipoRegra(tipoExame) {
  return String(tipoExame || '').toLowerCase() === 'demissional'
    ? 'demissional_colaborador'
    : tipoExame;
}

function tiposParaDocumento(tipos) {
  const saida = [];
  let incluiuDemissional = false;
  for (const tipo of tipos) {
    if (normalizarTipoDocumento(tipo.Chave) === 'demissional') {
      if (!incluiuDemissional) {
        saida.push({ ...tipo, Chave: 'demissional', Nome: 'Demissional' });
        incluiuDemissional = true;
      }
    } else {
      saida.push(tipo);
    }
  }
  return saida;
}

async function montarRiscosDoCargo(cargoId, setorId = null) {
  const [riscoIds, todosRiscos] = await Promise.all([
    setorId ? db.getRiscosByPerfil(setorId, cargoId) : db.getRiscosByCargo(cargoId),
    db.getAll('Riscos')
  ]);
  return todosRiscos.filter(r => riscoIds.includes(String(r.ID)));
}

async function montarExamesDoCargo(cargoId, setorId = null, tipoExame = null) {
  if (!cargoId) return [];
  const [exameIds, todosExames] = await Promise.all([
    setorId
      ? db.getExameRulesByPerfil(setorId, cargoId, tipoExame).then(regras => [...new Set(regras.map(r => String(r.ExameID)))])
      : db.getExamesByCargo(cargoId),
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
    versao: 2,
    dataDocumento: dataDocumento.toISOString(),
    colaborador: ctx.colaborador,
    riscos: ctx.riscos,
    config: ctx.config,
    tiposExame: ctx.tiposExame,
    examesComplementares: ctx.examesComplementares,
    conclusao: ctx.conclusao,
    examesDatas: ctx.examesDatas,
    dataAvaliacaoClinica: ctx.dataAvaliacaoClinica,
    perguntasAdmissionais: ctx.perguntasAdmissionais || []
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
    const perguntasAdmissionais = Array.isArray(snapshot.perguntasAdmissionais)
      ? snapshot.perguntasAdmissionais
      : await listarPerguntasAdmissionais();
    return {
      colaborador: snapshot.colaborador,
      riscos: snapshot.riscos,
      config: snapshot.config,
      tiposExame: snapshot.tiposExame || [],
      examesComplementares: snapshot.examesComplementares || [],
      conclusao: snapshot.conclusao || '',
      examesDatas: snapshot.examesDatas || {},
      dataAvaliacaoClinica: snapshot.dataAvaliacaoClinica || '',
      perguntasAdmissionais,
      dataDocumento: snapshot.dataDocumento
    };
  }

  // Compatibilidade com históricos emitidos antes do snapshot completo.
  const [configBase, tiposExame, examesComplementares, empresa, perguntasAdmissionais] = await Promise.all([
    db.getConfig(),
    db.getTiposExame(),
    db.getExamesComplementares(),
    registro.EmpresaID ? db.getById('Empresas', registro.EmpresaID) : null,
    listarPerguntasAdmissionais()
  ]);
  const config = { ...configBase, ...(empresa || {}) };

  let riscos = parseRiscosSnapshot(registro.RiscosSnapshot);
  if (!riscos.length && registro.CargoID) {
    riscos = await montarRiscosDoCargo(registro.CargoID, registro.SetorID);
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
    ,perguntasAdmissionais
  };
}

/**
 * Monta contexto do PDF com relacionamentos ATUAIS
 * (riscos do cargo, nomes de cargo/setor, config, exames cadastrados).
 */
async function montarContextoPdf(registroLike, extras = {}) {
  const cargoId = registroLike.CargoID || registroLike.cargoId;
  const setorId = registroLike.SetorID || registroLike.setorId;
  const empresaId = registroLike.EmpresaID || registroLike.empresaId;

  const tipoAtual = registroLike.TipoExame || registroLike.tipoExame || 'admissional';
  const tipoRegra = normalizarTipoRegra(tipoAtual);
  const [configBase, tiposExameRaw, examesComplementares, riscos, setor, cargo, empresa, perguntasAdmissionais] = await Promise.all([
    db.getConfig(),
    db.getTiposExame(),
    montarExamesDoCargo(cargoId, setorId, tipoRegra),
    montarRiscosDoCargo(cargoId, setorId),
    setorId ? db.getById('Setores', setorId) : null,
    cargoId ? db.getById('Cargos', cargoId) : null,
    empresaId ? db.getById('Empresas', empresaId) : null,
    listarPerguntasAdmissionais()
  ]);
  const tiposExame = tiposParaDocumento(
    tiposExameRaw.filter(tipo => Number(tipo.SelecionavelASO) !== 0)
  );
  const config = { ...configBase, ...(empresa || {}) };

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
      tipoExame: normalizarTipoDocumento(tipoAtual)
    },
    riscos,
    config,
    tiposExame,
    examesComplementares,
    conclusao,
    examesDatas,
    dataAvaliacaoClinica,
    perguntasAdmissionais,
    setorAtual: setor,
    cargoAtual: cargo,
    empresaAtual: empresa
  };
}

async function listarPerguntasAdmissionais() {
  const [rows] = await db.pool.query(
    'SELECT id AS ID, pergunta AS Pergunta, complemento AS Complemento, ordem AS Ordem FROM perguntas_anamnese_admissional ORDER BY ordem, id'
  );
  return rows;
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

function statusPorVencimento(vencimento) {
  if (!vencimento) return 'SEM VENCIMENTO';
  return dayjs(vencimento).isBefore(dayjs(), 'day') ? 'ATRASADO' : 'NO PRAZO';
}

function parseControleAnterior(raw) {
  if (!raw) return null;
  if (typeof raw === 'object') return raw;
  try { return JSON.parse(String(raw)); } catch (_) { return null; }
}

function serializarHistorico(registro) {
  if (!registro) return null;
  const { __rowNumber, DocumentoSnapshot, ControleFuncionarioAnterior, ...rest } = registro;
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
    nome, cpf, dataNascimento, setorId, cargoId, empresaId, tipoExame,
    conclusao, examesDatas
  } = body;

  if (!nome || !cpf || !dataNascimento || !setorId || !cargoId || !empresaId) {
    return { erro: 'Nome, CPF, Data de Nascimento, Empresa, Setor e Cargo são obrigatórios.' };
  }
  if (!isValidCpf(cpf)) {
    return { erro: 'CPF inválido.' };
  }

  const [setor, cargo, empresa] = await Promise.all([
    db.getById('Setores', setorId),
    db.getById('Cargos', cargoId),
    db.getById('Empresas', empresaId)
  ]);
  if (!setor) return { erro: 'Setor não encontrado.' };
  if (!cargo) return { erro: 'Cargo não encontrado.' };
  if (!empresa) return { erro: 'Empresa não encontrada.' };

  const [riscosAtuais, examesDoCargo] = await Promise.all([
    montarRiscosDoCargo(cargoId, setorId),
    montarExamesDoCargo(cargoId, setorId, tipoExame || 'admissional')
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
      EmpresaID: empresaId,
      Empresa: empresa.RazaoSocial,
      Conclusao: conclusao || '',
      ExamesDatas: JSON.stringify(examesNorm),
      DataAvaliacaoClinica: ''
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
        // Preserva os dados da emissão antiga. A nova emissão sairá sem data,
        // mas o download histórico deve continuar exatamente como foi criado.
        DataAvaliacaoClinica: existente.DataAvaliacaoClinica || '',
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
      const ctx = await montarContextoPdf(validado.dadosColaborador, {
        conclusao: validado.dadosColaborador.Conclusao,
        examesDatas: validado.examesNorm,
        dataAvaliacaoClinica: ''
      });

      const buffer = await pdfService.gerarAsoPdf({ ...ctx, dataDocumento });
      const funcionarios = await db.getAll('Funcionarios');
      const funcionario = funcionarios.find(item =>
        onlyDigits(item.CPF) === onlyDigits(validado.dadosColaborador.CPF)
      );
      const registro = await db.insert('HistoricoPDF', {
        ...validado.dadosColaborador,
        FuncionarioID: funcionario?.ID || null,
        DataGeracao: dayjs(dataDocumento).format('DD/MM/YYYY HH:mm'),
        RiscosSnapshot: serializarRiscosSnapshot(validado.riscosAtuais),
        DocumentoSnapshot: serializarDocumentoSnapshot(ctx, dataDocumento),
        ControleFuncionarioAnterior: null
      });
      const arquivoNome = pdfService.nomeArquivoAso(registro.Nome, dataDocumento);
      res.set('X-Historico-ID', String(registro.ID));
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

  async downloadFichaClinica(req, res) {
    try {
      const registro = await db.getById('HistoricoPDF', req.params.id);
      if (!registro) return res.status(404).json({ erro: 'Registro não encontrado.' });
      const ctx = await montarContextoPdfSalvo(registro);
      const dataDoSnapshot = ctx.dataDocumento ? dayjs(ctx.dataDocumento) : null;
      const dataDocumento = dataDoSnapshot && dataDoSnapshot.isValid() ? dataDoSnapshot.toDate() : new Date();
      const buffer = await pdfService.gerarFichaClinicaPdf({ ...ctx, dataDocumento });
      enviarPdf(res, buffer, pdfService.nomeArquivoFichaClinica(registro.Nome, registro.TipoExame, dataDocumento));
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao gerar ficha clínica.' });
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
        SetorID: funcionarioAtual.SetorID,
        EmpresaID: funcionarioAtual.EmpresaID
      } : registro;

      const dataGeracao = new Date();
      const tipoNovaEmissao = normalizarTipoRegra(registro.TipoExame);
      const ctx = await montarContextoPdf(
        { ...dadosAtuais, TipoExame: tipoNovaEmissao },
        { dataAvaliacaoClinica: '' }
      );
      const buffer = await pdfService.gerarAsoPdf({ ...ctx, dataDocumento: dataGeracao });

      const idsPermitidos = new Set(ctx.examesComplementares.map(exame => String(exame.ID)));
      const examesDatas = Object.fromEntries(
        Object.entries(ctx.examesDatas || {}).filter(([id]) => idsPermitidos.has(String(id)))
      );
      const novoRegistro = await db.insert('HistoricoPDF', {
        FuncionarioID: funcionarioAtual?.ID || null,
        ExameRealizadoID: null,
        Nome: dadosAtuais.Nome,
        CPF: dadosAtuais.CPF,
        DataNascimento: dadosAtuais.DataNascimento,
        DataGeracao: dayjs(dataGeracao).format('DD/MM/YYYY HH:mm'),
        Cargo: ctx.cargoAtual ? ctx.cargoAtual.Nome : registro.Cargo,
        Setor: ctx.setorAtual ? ctx.setorAtual.Nome : registro.Setor,
        ArquivoPDF: '',
        TipoExame: tipoNovaEmissao,
        CargoID: dadosAtuais.CargoID,
        SetorID: dadosAtuais.SetorID,
        EmpresaID: dadosAtuais.EmpresaID,
        Empresa: ctx.empresaAtual ? ctx.empresaAtual.RazaoSocial : registro.Empresa,
        Conclusao: registro.Conclusao || '',
        ExamesDatas: JSON.stringify(examesDatas),
        DataAvaliacaoClinica: '',
        RiscosSnapshot: serializarRiscosSnapshot(ctx.riscos),
        DocumentoSnapshot: serializarDocumentoSnapshot({ ...ctx, examesDatas }, dataGeracao),
        ControleFuncionarioAnterior: null
      });

      const arquivoNome = pdfService.nomeArquivoAso(dadosAtuais.Nome, dataGeracao);
      res.set('X-Historico-ID', String(novoRegistro.ID));
      enviarPdf(res, buffer, arquivoNome);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao regerar PDF.' });
    }
  },

  async excluir(req, res) {
    try {
      const resultado = await db.withTransaction(async connection => {
        const [registros] = await connection.query(
          'SELECT * FROM historico_aso WHERE id = ? FOR UPDATE',
          [req.params.id]
        );
        if (!registros.length) return null;
        const registro = registros[0];
        if (registro.exame_realizado_id && registro.funcionario_id) {
          const [links] = await connection.query('SELECT COUNT(*) total FROM historico_aso WHERE exame_realizado_id=? AND id<>?', [registro.exame_realizado_id, registro.id]);
          if (!Number(links[0].total)) await connection.query('UPDATE exames_realizados SET ativo=0,historico_aso_id=NULL WHERE id=?', [registro.exame_realizado_id]);
        }
        const [maisRecentes] = await connection.query(
          `SELECT id FROM historico_aso
            WHERE cpf = ? AND LOWER(tipo_exame) NOT LIKE 'demissional%'
            ORDER BY id DESC LIMIT 1`,
          [registro.cpf]
        );
        const eraControleMaisRecente = maisRecentes.length && String(maisRecentes[0].id) === String(registro.id);
        await connection.query('DELETE FROM historico_aso WHERE id = ?', [registro.id]);

        const anterior = eraControleMaisRecente ? parseControleAnterior(registro.controle_funcionario_anterior) : null;
        if (anterior) {
          await connection.query(
            `UPDATE funcionarios
                SET data_admissao = ?, ultimo_exame = ?, vencimento = ?, status = ?
              WHERE cpf = ?`,
            [
              anterior.DataAdmissao || null,
              anterior.UltimoExame || null,
              anterior.Vencimento || null,
              statusPorVencimento(anterior.Vencimento),
              registro.cpf
            ]
          );
        }
        if (registro.funcionario_id) await registrosService.recalcularFuncionario(connection, registro.funcionario_id);
        return { restaurado: Boolean(anterior) };
      });
      if (!resultado) return res.status(404).json({ erro: 'Registro não encontrado.' });
      res.json({ sucesso: true, controleRestaurado: resultado.restaurado });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao excluir registro.' });
    }
  }
};
