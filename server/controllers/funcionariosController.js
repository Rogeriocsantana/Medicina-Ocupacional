const dayjs = require('dayjs');
const customParseFormat = require('dayjs/plugin/customParseFormat');
dayjs.extend(customParseFormat);
const db = require('../services/excelService');
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

function serializarFuncionario(row) {
  if (!row) return null;
  const { __rowNumber, ...rest } = row;
  return {
    ...rest,
    DataNascimento: toInputDate(rest.DataNascimento)
  };
}

async function enrichWithNames(rows) {
  const [setores, cargos] = await Promise.all([
    db.getAll('Setores'),
    db.getAll('Cargos')
  ]);
  const setorMap = Object.fromEntries(setores.map(s => [String(s.ID), s.Nome]));
  const cargoMap = Object.fromEntries(cargos.map(c => [String(c.ID), c.Nome]));
  return rows.map(r => {
    const base = serializarFuncionario(r);
    return {
      ...base,
      SetorNome: setorMap[String(r.SetorID)] || '',
      CargoNome: cargoMap[String(r.CargoID)] || ''
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
  const { Nome, CPF, DataNascimento, SetorID, CargoID } = body;
  if (!Nome || !String(Nome).trim()) return 'Nome é obrigatório.';
  if (!CPF) return 'CPF é obrigatório.';
  if (!isValidCpf(CPF)) return 'CPF inválido.';
  if (!DataNascimento) return 'Data de nascimento é obrigatória.';
  if (!SetorID) return 'Setor é obrigatório.';
  if (!CargoID) return 'Cargo é obrigatório.';
  return null;
}

module.exports = {
  async listar(req, res) {
    try {
      let rows = await db.getAll('Funcionarios');
      const busca = (req.query.busca || '').toLowerCase().trim();
      if (busca) {
        const buscaCpf = onlyDigits(busca);
        rows = rows.filter(r => {
          const nome = String(r.Nome || '').toLowerCase();
          const cpf = onlyDigits(r.CPF);
          return nome.includes(busca) ||
            (buscaCpf && cpf.includes(buscaCpf)) ||
            formatCpf(r.CPF).toLowerCase().includes(busca);
        });
      }
      const enriched = await enrichWithNames(rows);
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

      const [setor, cargo] = await Promise.all([
        db.getById('Setores', req.body.SetorID),
        db.getById('Cargos', req.body.CargoID)
      ]);
      if (!setor) return res.status(400).json({ erro: 'Setor não encontrado.' });
      if (!cargo) return res.status(400).json({ erro: 'Cargo não encontrado.' });

      const created = await db.insert('Funcionarios', {
        Nome: String(req.body.Nome).trim(),
        CPF: formatCpf(req.body.CPF),
        DataNascimento: req.body.DataNascimento,
        SetorID: req.body.SetorID,
        CargoID: req.body.CargoID
      });
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

      const [setor, cargo] = await Promise.all([
        db.getById('Setores', req.body.SetorID),
        db.getById('Cargos', req.body.CargoID)
      ]);
      if (!setor) return res.status(400).json({ erro: 'Setor não encontrado.' });
      if (!cargo) return res.status(400).json({ erro: 'Cargo não encontrado.' });

      const updated = await db.update('Funcionarios', req.params.id, {
        Nome: String(req.body.Nome).trim(),
        CPF: formatCpf(req.body.CPF),
        DataNascimento: req.body.DataNascimento,
        SetorID: req.body.SetorID,
        CargoID: req.body.CargoID
      });
      const [enriched] = await enrichWithNames([updated]);
      res.json(enriched);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao atualizar funcionário.' });
    }
  },

  async remover(req, res) {
    try {
      const ok = await db.remove('Funcionarios', req.params.id);
      if (!ok) return res.status(404).json({ erro: 'Funcionário não encontrado.' });
      res.json({ sucesso: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao remover funcionário.' });
    }
  }
};
