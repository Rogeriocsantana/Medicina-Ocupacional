const db = require('../services/mysqlService');

module.exports = {
  async obterPorCargo(req, res) {
    try {
      const setorId = req.query.setorId;
      const riscoIds = setorId
        ? await db.getRiscosByPerfil(setorId, req.params.cargoId)
        : await db.getRiscosByCargo(req.params.cargoId);
      res.json({ setorId: setorId || null, cargoId: req.params.cargoId, riscoIds });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler relacionamento.' });
    }
  },

  async salvar(req, res) {
    try {
      const { setorId, cargoId, riscoIds } = req.body;
      if (!setorId || !cargoId || !Array.isArray(riscoIds)) {
        return res.status(400).json({ erro: 'setorId, cargoId e riscoIds (array) são obrigatórios.' });
      }
      await db.setRiscosForPerfil(setorId, cargoId, riscoIds);
      res.json({ sucesso: true });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao salvar relacionamento.' });
    }
  },

  // Lista todos os cargos já com a contagem de riscos associados (usado na tela de relacionamento)
  async listarResumo(req, res) {
    try {
      res.json(await db.getPerfisResumo());
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler resumo.' });
    }
  }
};
