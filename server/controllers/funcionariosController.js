const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const db = require('../services/mysqlService');
const { formatCpf, isValidCpf, onlyDigits } = require('../utils/cpf');
const registrosService = require('../services/registrosOcupacionaisService');
const condicoesService = require('./../services/condicoesPresencaService');

function toInputDate(value) {
  if (!value) return '';
  const s = String(value).trim();
  if (/^\d{4}-\d{2}-\d{2}/.test(s)) return s.slice(0, 10);
  const d1 = dayjs(s, 'DD/MM/YYYY', true);
  if (d1.isValid()) return d1.format('YYYY-MM-DD');
  const d2 = dayjs(s);
  return d2.isValid() ? d2.format('YYYY-MM-DD') : '';
}

function serializarFuncionario(row, periodicidadeMeses = 12) {
  if (!row) return null;
  const { __rowNumber, ...rest } = row;
  const ultimoExame = toInputDate(rest.UltimoExame);
  const meses = Number(periodicidadeMeses) || 12;
  const vencimento = ultimoExame ? dayjs(ultimoExame).add(meses, 'month').format('YYYY-MM-DD') : toInputDate(rest.Vencimento);
  const hoje = dayjs().startOf('day');
  const dataVencimento = vencimento ? dayjs(vencimento) : null;
  const atrasado = Boolean(dataVencimento && dataVencimento.isBefore(hoje, 'day'));
  return {
    ...rest,
    DataNascimento: toInputDate(rest.DataNascimento),
    DataAdmissao: toInputDate(rest.DataAdmissao),
    DataDesligamento: toInputDate(rest.DataDesligamento),
    UltimoExame: ultimoExame,
    Vencimento: vencimento,
    Status: vencimento ? (atrasado ? 'ATRASADO' : 'NO PRAZO') : 'SEM VENCIMENTO',
    AtrasoDias: atrasado ? hoje.diff(dataVencimento, 'day') : 0,
    PeriodicidadeVencimentoMeses: meses,
    AtrasoRelevante: atrasado && String(rest.Situacao || '').toUpperCase() === 'ATIVO' && !String(rest.Condicao || '').trim()
  };
}

function dadosControleOcupacional(body, periodicidadeMeses = 12) {
  const dataAdmissao = toInputDate(body.DataAdmissao) || null;
  const ultimoExame = toInputDate(body.UltimoExame) || null;
  const vencimentoInformado = toInputDate(body.Vencimento) || null;
  const vencimento = ultimoExame
    ? dayjs(ultimoExame).add(Number(periodicidadeMeses) || 12, 'month').format('YYYY-MM-DD')
    : vencimentoInformado;
  const status = vencimento
    ? (dayjs(vencimento).isBefore(dayjs(), 'day') ? 'ATRASADO' : 'NO PRAZO')
    : 'SEM VENCIMENTO';
  return {
    DataAdmissao: dataAdmissao,
    UltimoExame: ultimoExame,
    Vencimento: vencimento,
    ObservacaoCondicao: String(body.ObservacaoCondicao || '').trim() || null,
    Condicao: String(body.Condicao || '').trim().toUpperCase() || null,
    Status: status
  };
}

async function enrichWithNames(rows) {
  const [setores, cargos, empresas, perfis] = await Promise.all([
    db.getAll('Setores'),
    db.getAll('Cargos'),
    db.getAll('Empresas'),
    db.getPerfisResumo()
  ]);
  const setorMap = Object.fromEntries(setores.map(s => [String(s.ID), s.Nome]));
  const cargoMap = Object.fromEntries(cargos.map(c => [String(c.ID), c.Nome]));
  const empresaMap = Object.fromEntries(empresas.map(e => [String(e.ID), e.RazaoSocial]));
  const perfilMap = Object.fromEntries(perfis.map(p => [`${p.SetorID}:${p.CargoID}`, Number(p.PeriodicidadeVencimentoMeses || 12)]));
  return rows.map(r => {
    const base = serializarFuncionario(r, perfilMap[`${r.SetorID}:${r.CargoID}`] || 12);
    return {
      ...base,
      SetorNome: setorMap[String(r.SetorID)] || '',
      CargoNome: cargoMap[String(r.CargoID)] || '',
      EmpresaNome: empresaMap[String(r.EmpresaID)] || ''
    };
  });
}

async function cpfEmUso(cpf, ignoreId = null) {
  const rows = await db.getAll('Funcionarios');
  const digits = onlyDigits(cpf);
  return rows.some(r =>
    onlyDigits(r.CPF) === digits && String(r.ID) !== String(ignoreId || '')
  );
}

function validarPayload(body, isUpdate = false) {
  const { Nome, CPF, DataNascimento, SetorID, CargoID, EmpresaID, Situacao } = body;
  if (body.CodigoFuncionario && !/^\d{1,30}$/.test(String(body.CodigoFuncionario).trim())) return 'Código do funcionário deve conter até 30 dígitos.';
  if (!Nome || !String(Nome).trim()) return 'Nome é obrigatório.';
  if (!CPF) return 'CPF é obrigatório.';
  if (!isValidCpf(CPF)) return 'CPF inválido.';
  if (!DataNascimento) return 'Data de nascimento é obrigatória.';
  if (!SetorID) return 'Setor é obrigatório.';
  if (!CargoID) return 'Cargo é obrigatório.';
  if (!EmpresaID) return 'Empresa é obrigatória.';
  if (!['ATIVO', 'DESLIGADO'].includes(String(Situacao || '').toUpperCase())) {
    return 'Situação deve ser ATIVO ou DESLIGADO.';
  }
  if (String(Situacao).toUpperCase() === 'DESLIGADO' && !condicoesService.date(body.DataDesligamento)) return 'Informe a data de desligamento.';
  return null;
}

module.exports = {
  async listar(req, res) {
    try {
      const rows = await db.getAll('Funcionarios');
      let enriched = await enrichWithNames(rows);
      const busca = (req.query.busca || '').toLowerCase().trim();
      if (busca) {
        const buscaCpf = onlyDigits(busca);
        enriched = enriched.filter(r => {
          const nome = String(r.Nome || '').toLowerCase();
          const cpf = onlyDigits(r.CPF);
          return nome.includes(busca) || String(r.CodigoFuncionario || '').includes(busca) ||
            (buscaCpf && cpf.includes(buscaCpf)) ||
            formatCpf(r.CPF).toLowerCase().includes(busca) ||
            String(r.SetorNome || '').toLowerCase().includes(busca) ||
            String(r.CargoNome || '').toLowerCase().includes(busca);
        });
      }
      const status = String(req.query.status || '').toLowerCase().trim();
      const situacao = String(req.query.situacao || '').toLowerCase().trim();
      const condicao = String(req.query.condicao || '').toLowerCase().trim();
      const diasAVencer = Number.parseInt(req.query.diasAVencer, 10);
      const empresa = String(req.query.empresa || '').trim();
      const setor = String(req.query.setor || '').trim();
      if (status) {
        enriched = enriched.filter(r => status === 'atrasado'
          ? r.AtrasoRelevante
          : String(r.Status || '').toLowerCase().trim() === status);
      }
      if (situacao) {
        enriched = enriched.filter(r => String(r.Situacao || '').toLowerCase().trim() === situacao);
      }
      if (condicao) {
        enriched = enriched.filter(r => String(r.Condicao || '').toLowerCase().trim() === condicao);
      }
      if (Number.isInteger(diasAVencer) && diasAVencer > 0) {
        const hoje = dayjs().startOf('day');
        const limite = hoje.add(Math.min(diasAVencer, 60), 'day');
        enriched = enriched.filter(r => {
          const vencimento = r.Vencimento ? dayjs(r.Vencimento).startOf('day') : null;
          const elegivel = String(r.Situacao || '').toUpperCase() === 'ATIVO' && !String(r.Condicao || '').trim();
          return elegivel && vencimento?.isValid() && !vencimento.isBefore(hoje, 'day') && !vencimento.isAfter(limite, 'day');
        });
      }
      if (req.query.semCodigo === '1') enriched = enriched.filter(r => !r.CodigoFuncionario && r.Situacao === 'ATIVO' && !/NUTRI/i.test(r.EmpresaNome));
      if (empresa) enriched = enriched.filter(r => String(r.EmpresaID) === empresa);
      if (setor) enriched = enriched.filter(r => String(r.SetorID) === setor);
      enriched.sort((a, b) => String(a.Nome).localeCompare(String(b.Nome), 'pt-BR'));
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler funcionários.' });
    }
  },

  async obter(req, res) {
    try {
      const row = await db.getById('Funcionarios', req.params.id);
      if (!row) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
      const [enriched] = await enrichWithNames([row]);
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler funcionário.' });
    }
  },

  async criar(req, res) {
    try {
      const erro = validarPayload(req.body);
      if (erro) return res.status(400).json({ erro });
      if (req.body.Condicao && !condicoesService.date(req.body.CondicaoInicio)) return res.status(400).json({ erro: 'Informe a data de início da condição.' });

      if (await cpfEmUso(req.body.CPF)) {
        return res.status(400).json({ erro: 'Já existe um funcionário com este CPF.' });
      }

      const [setor, cargo, empresa] = await Promise.all([
        db.getById('Setores', req.body.SetorID),
        db.getById('Cargos', req.body.CargoID),
        db.getById('Empresas', req.body.EmpresaID)
      ]);
      if (!setor) return res.status(400).json({ erro: 'Setor não encontrado.' });
      if (!cargo) return res.status(400).json({ erro: 'Cargo não encontrado.' });
      if (!empresa) return res.status(400).json({ erro: 'Empresa não encontrada.' });

      const perfil = await db.getPerfilBySetorCargo(req.body.SetorID, req.body.CargoID);
      const controle = dadosControleOcupacional({ ...req.body, Condicao: '' }, perfil?.PeriodicidadeVencimentoMeses || 12);
      const createdId = await condicoesService.transaction(async connection => {
        const [result] = await connection.query(`INSERT INTO funcionarios
          (codigo_funcionario,nome,cpf,data_nascimento,data_admissao,data_desligamento,ultimo_exame,vencimento,status,situacao,setor_id,cargo_id,empresa_id)
          VALUES (?,?,?,?,?,?,?,?,?,?,?,?,?)`, [String(req.body.CodigoFuncionario || '').trim() || null,
          String(req.body.Nome).trim(), onlyDigits(req.body.CPF), req.body.DataNascimento,
          controle.DataAdmissao, String(req.body.Situacao).toUpperCase() === 'DESLIGADO' ? req.body.DataDesligamento : null,
          controle.UltimoExame, controle.Vencimento, controle.Status, String(req.body.Situacao).trim().toUpperCase(),
          req.body.SetorID, req.body.CargoID, req.body.EmpresaID
        ]);
        if (req.body.Condicao) await condicoesService.setCondition(connection, result.insertId, req.body.Condicao, req.body.CondicaoInicio, req.body.ObservacaoCondicao || null);
        return result.insertId;
      });
      const created = await db.getById('Funcionarios', createdId);
      await db.syncPerfilAtividade(created.SetorID, created.CargoID);
      const [enriched] = await enrichWithNames([await db.getById('Funcionarios', created.ID)]);
      res.status(201).json(enriched);
    } catch (err) {
      console.error(err);
      res.status(err.code === 'ER_DUP_ENTRY' ? 409 : err.status || 500).json({ erro: err.code === 'ER_DUP_ENTRY' ? 'CPF ou código já cadastrado nesta empresa.' : err.status ? err.message : 'Falha ao criar funcionário.' });
    }
  },

  async atualizar(req, res) {
    try {
      const erro = validarPayload(req.body, true);
      if (erro) return res.status(400).json({ erro });
      if (req.body.Condicao && String(req.body.Condicao).toUpperCase() !== String((await db.getById('Funcionarios', req.params.id))?.Condicao || '').toUpperCase() && !condicoesService.date(req.body.CondicaoInicio)) return res.status(400).json({ erro: 'Informe a data de início da nova condição.' });

      const existente = await db.getById('Funcionarios', req.params.id);
      if (!existente) return res.status(404).json({ erro: 'Funcionário não encontrado.' });

      if (await cpfEmUso(req.body.CPF, req.params.id)) {
        return res.status(400).json({ erro: 'Já existe outro funcionário com este CPF.' });
      }

      const [setor, cargo, empresa] = await Promise.all([
        db.getById('Setores', req.body.SetorID),
        db.getById('Cargos', req.body.CargoID),
        db.getById('Empresas', req.body.EmpresaID)
      ]);
      if (!setor) return res.status(400).json({ erro: 'Setor não encontrado.' });
      if (!cargo) return res.status(400).json({ erro: 'Cargo não encontrado.' });
      if (!empresa) return res.status(400).json({ erro: 'Empresa não encontrada.' });

      const perfil = await db.getPerfilBySetorCargo(req.body.SetorID, req.body.CargoID);
      const controle = dadosControleOcupacional(req.body, perfil?.PeriodicidadeVencimentoMeses || 12);
      await condicoesService.transaction(async connection => {
        await connection.query(`UPDATE funcionarios SET codigo_funcionario=?,nome=?,cpf=?,data_nascimento=?,data_admissao=?,data_desligamento=?,ultimo_exame=?,vencimento=?,status=?,situacao=?,setor_id=?,cargo_id=?,empresa_id=? WHERE id=?`, [Object.hasOwn(req.body, 'CodigoFuncionario') ? String(req.body.CodigoFuncionario || '').trim() || null : existente.CodigoFuncionario || null, String(req.body.Nome).trim(), onlyDigits(req.body.CPF), req.body.DataNascimento, controle.DataAdmissao, String(req.body.Situacao).toUpperCase() === 'DESLIGADO' ? req.body.DataDesligamento : null, controle.UltimoExame, controle.Vencimento, controle.Status, String(req.body.Situacao).trim().toUpperCase(), req.body.SetorID, req.body.CargoID, req.body.EmpresaID, req.params.id]);
        await condicoesService.setCondition(connection, req.params.id, req.body.Condicao, req.body.CondicaoInicio, req.body.ObservacaoCondicao || null, Boolean(req.body.CorrigirCondicao), req.body.CondicaoFim);
      });
      const updated = await db.getById('Funcionarios', req.params.id);
      await Promise.all([
        db.syncPerfilAtividade(existente.SetorID, existente.CargoID),
        db.syncPerfilAtividade(updated.SetorID, updated.CargoID)
      ]);
      if (toInputDate(existente.UltimoExame) !== toInputDate(req.body.UltimoExame)) {
        await registrosService.sincronizarEdicaoFuncionario(updated.ID, req.body.UltimoExame);
      }
      const [enriched] = await enrichWithNames([updated]);
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(err.code === 'ER_DUP_ENTRY' ? 409 : err.status || 500).json({ erro: err.code === 'ER_DUP_ENTRY' ? 'CPF ou código já cadastrado nesta empresa.' : err.status ? err.message : 'Falha ao atualizar funcionário.' });
    }
  },

  async remover(req, res) {
    try {
      const existente = await db.getById('Funcionarios', req.params.id);
      if (!existente) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
      const ok = await db.remove('Funcionarios', req.params.id);
      if (!ok) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
      await db.syncPerfilAtividade(existente.SetorID, existente.CargoID);
      res.json({ sucesso: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao remover funcionário.' });
    }
  }
};
