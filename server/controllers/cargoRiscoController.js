const db = require('../services/excelService');

module.exports = {
  async obterPorCargo(req, res) {
    try {
      const riscoIds = await db.getRiscosByCargo(req.params.cargoId);
      res.json({ cargoId: req.params.cargoId, riscoIds });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler relacionamento.' });
    }
  },

  async salvar(req, res) {
    try {
      const { cargoId, riscoIds } = req.body;
      if (!cargoId || !Array.isArray(riscoIds)) {
        return res.status(400).json({ erro: 'cargoId e riscoIds (array) são obrigatórios.' });
      }
      await db.setRiscosForCargo(cargoId, riscoIds);
      res.json({ sucesso: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao salvar relacionamento.' });
    }
  },

  // Lista todos os cargos já com a contagem de riscos associados (usado na tela de relacionamento)
  async listarResumo(req, res) {
    try {
      const [cargos, todosVinculos] = await Promise.all([
        db.getAll('Cargos'),
        db.getAll('Cargo_Risco')
      ]);
      const resumo = cargos.map(c => ({
        ID: c.ID,
        Nome: c.Nome,
        totalRiscos: todosVinculos.filter(v => String(v.CargoID) === String(c.ID)).length
      }));
      res.json(resumo);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler resumo.' });
    }
  }
};
