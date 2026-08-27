const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const db = require('../services/mysqlService');
const { formatCpf, isValidCpf, onlyDigits } = require('../utils/cpf');

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
  if (!Nome || !String(Nome).trim()) return 'Nome é obrigatório.';
  if (!CPF) return 'CPF é obrigatório.';
  if (!isValidCpf(CPF)) return 'CPF inválido.';
  if (!DataNascimento) return 'Data de nascimento é obrigatória.';
  if (!SetorID) return 'Setor é obrigatório.';
  if (!CargoID) return 'Cargo é obrigatório.';
  if (!EmpresaID) return 'Empresa é obrigatória.';
  if (!['ATIVO', 'AFASTADO', 'DESLIGADO'].includes(String(Situacao || '').toUpperCase())) {
    return 'Situação deve ser ATIVO, AFASTADO ou DESLIGADO.';
  }
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
          return nome.includes(busca) ||
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
      const created = await db.insert('Funcionarios', {
        Nome: String(req.body.Nome).trim(),
        CPF: formatCpf(req.body.CPF),
        DataNascimento: req.body.DataNascimento,
        ...dadosControleOcupacional(req.body, perfil?.PeriodicidadeVencimentoMeses || 12),
        Situacao: String(req.body.Situacao).trim().toUpperCase(),
        SetorID: req.body.SetorID,
        CargoID: req.body.CargoID,
        EmpresaID: req.body.EmpresaID
      });
      await db.syncPerfilAtividade(created.SetorID, created.CargoID);
      const [enriched] = await enrichWithNames([created]);
      res.status(201).json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao criar funcionário.' });
    }
  },

  async atualizar(req, res) {
    try {
      const erro = validarPayload(req.body, true);
      if (erro) return res.status(400).json({ erro });

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
      const updated = await db.update('Funcionarios', req.params.id, {
        Nome: String(req.body.Nome).trim(),
        CPF: formatCpf(req.body.CPF),
        DataNascimento: req.body.DataNascimento,
        ...dadosControleOcupacional(req.body, perfil?.PeriodicidadeVencimentoMeses || 12),
        Situacao: String(req.body.Situacao).trim().toUpperCase(),
        SetorID: req.body.SetorID,
        CargoID: req.body.CargoID,
        EmpresaID: req.body.EmpresaID
      });
      await Promise.all([
        db.syncPerfilAtividade(existente.SetorID, existente.CargoID),
        db.syncPerfilAtividade(updated.SetorID, updated.CargoID)
      ]);
      const [enriched] = await enrichWithNames([updated]);
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao atualizar funcionário.' });
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
