const db = require('../services/excelService');

module.exports = {
  async stats(req, res) {
    try {
      const [setores, cargos, riscos, historico] = await Promise.all([
        db.getAll('Setores'),
        db.getAll('Cargos'),
        db.getAll('Riscos'),
        db.getAll('HistoricoPDF')
      ]);

      const hoje = new Date();
      const inicioMes = new Date(hoje.getFullYear(), hoje.getMonth(), 1);
      const geradosNoMes = historico.filter(h => {
        // DataGeracao no formato DD/MM/YYYY HH:mm
        const [datePart] = String(h.DataGeracao).split(' ');
        const [d, m, y] = (datePart || '').split('/').map(Number);
        if (!d || !m || !y) return false;
        const dataReg = new Date(y, m - 1, d);
        return dataReg >= inicioMes;
      });

      res.json({
        totalSetores: setores.length,
        totalCargos: cargos.length,
        totalRiscos: riscos.length,
        totalHistorico: historico.length,
        geradosNoMes: geradosNoMes.length,
        ultimosGerados: historico
          .sort((a, b) => Number(b.ID) - Number(a.ID))
          .slice(0, 5)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao carregar estatísticas.' });
    }
  }
};
