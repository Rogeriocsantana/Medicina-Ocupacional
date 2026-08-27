const db = require('../services/mysqlService');

module.exports = {
  async obterPorCargo(req, res) {
    try {
      const setorId = req.query.setorId;
      if (!setorId) {
        const exameIds = await db.getExamesByCargo(req.params.cargoId);
        return res.json({ setorId: null, cargoId: req.params.cargoId, exameIds, regras: [] });
      }
      const regras = await db.getExameRulesByPerfil(setorId, req.params.cargoId, req.query.tipo || null);
      const exameIds = [...new Set(regras.map(regra => String(regra.ExameID)))];
      res.json({ setorId, cargoId: req.params.cargoId, exameIds, regras });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler os exames do cargo.' });
    }
  },

  async salvar(req, res) {
    try {
      const { setorId, cargoId, regras } = req.body;
      if (!setorId || !cargoId || !Array.isArray(regras)) {
        return res.status(400).json({ erro: 'setorId, cargoId e regras (array) são obrigatórios.' });
      }
      const [setor, cargo, exames, tipos] = await Promise.all([
        db.getById('Setores', setorId),
        db.getById('Cargos', cargoId),
        db.getAll('ExamesComplementares'),
        db.getTiposExame()
      ]);
      if (!setor) return res.status(400).json({ erro: 'Setor não encontrado.' });
      if (!cargo) return res.status(400).json({ erro: 'Cargo não encontrado.' });
      const examesValidos = new Set(exames.map(ex => String(ex.ID)));
      const tiposValidos = new Set(tipos.map(tipo => String(tipo.ID)));
      const normalizadas = regras.map(regra => ({
        exameId: Number(regra.exameId),
        tipoExameId: Number(regra.tipoExameId),
        periodicidadeMeses: regra.periodicidadeMeses === '' || regra.periodicidadeMeses == null
          ? null : Number(regra.periodicidadeMeses)
      }));
      if (normalizadas.some(regra => !examesValidos.has(String(regra.exameId)) || !tiposValidos.has(String(regra.tipoExameId)))) {
        return res.status(400).json({ erro: 'Há exame ou tipo de exame inválido nas regras.' });
      }
      if (normalizadas.some(regra => regra.periodicidadeMeses !== null && (!Number.isInteger(regra.periodicidadeMeses) || regra.periodicidadeMeses < 1 || regra.periodicidadeMeses > 120))) {
        return res.status(400).json({ erro: 'Periodicidade deve estar entre 1 e 120 meses.' });
      }
      const chaves = normalizadas.map(regra => `${regra.exameId}:${regra.tipoExameId}`);
      if (new Set(chaves).size !== chaves.length) {
        return res.status(400).json({ erro: 'Não repita o mesmo exame para o mesmo tipo.' });
      }
      await db.setExameRulesForPerfil(setorId, cargoId, normalizadas);
      res.json({ sucesso: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao salvar os exames do cargo.' });
    }
  },

  async listarResumo(req, res) {
    try {
      res.json(await db.getPerfisResumo());
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao listar os cargos.' });
    }
  },

  async obterVencimento(req, res) {
    try {
      const perfil = await db.getPerfilBySetorCargo(req.query.setorId, req.params.cargoId);
      res.json({ periodicidadeMeses: Number(perfil?.PeriodicidadeVencimentoMeses || 12) });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler a periodicidade do perfil.' });
    }
  },

  async salvarVencimento(req, res) {
    try {
      const { setorId, cargoId, periodicidadeMeses } = req.body;
      if (!setorId || !cargoId) return res.status(400).json({ erro: 'Setor e cargo são obrigatórios.' });
      const perfil = await db.setVencimentoForPerfil(setorId, cargoId, periodicidadeMeses);
      res.json({ sucesso: true, periodicidadeMeses: Number(perfil.PeriodicidadeVencimentoMeses) });
    } catch (err) {
      console.error(err);
      res.status(400).json({ erro: err.message || 'Falha ao salvar a periodicidade do perfil.' });
    }
  }
};
