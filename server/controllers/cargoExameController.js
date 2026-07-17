const db = require('../services/excelService');

module.exports = {
  async obterPorCargo(req, res) {
    try {
      const exameIds = await db.getExamesByCargo(req.params.cargoId);
      res.json({ cargoId: req.params.cargoId, exameIds });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler os exames do cargo.' });
    }
  },

  async salvar(req, res) {
    try {
      const { cargoId, exameIds } = req.body;
      if (!cargoId || !Array.isArray(exameIds)) {
        return res.status(400).json({ erro: 'cargoId e exameIds (array) são obrigatórios.' });
      }
      const [cargo, exames] = await Promise.all([
        db.getById('Cargos', cargoId),
        db.getAll('ExamesComplementares')
      ]);
      if (!cargo) return res.status(400).json({ erro: 'Cargo não encontrado.' });
      const validIds = new Set(exames.map(ex => String(ex.ID)));
      if (exameIds.some(id => !validIds.has(String(id)))) {
        return res.status(400).json({ erro: 'Há exame complementar inválido no vínculo.' });
      }
      await db.setExamesForCargo(cargoId, exameIds);
      res.json({ sucesso: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao salvar os exames do cargo.' });
    }
  },

  async listarResumo(req, res) {
    try {
      const [cargos, vinculos] = await Promise.all([db.getAll('Cargos'), db.getAll('Cargo_Exame')]);
      res.json(cargos.map(cargo => ({
        ID: cargo.ID,
        Nome: cargo.Nome,
        totalExames: vinculos.filter(v => String(v.CargoID) === String(cargo.ID)).length
      })));
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao listar os cargos.' });
    }
  }
};
