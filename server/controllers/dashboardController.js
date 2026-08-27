const db = require('../services/mysqlService');
const dayjs = require('dayjs');

module.exports = {
  async stats(req, res) {
    try {
      const [setores, cargos, riscos, funcionarios, historico, perfis] = await Promise.all([
        db.getAll('Setores'),
        db.getAll('Cargos'),
        db.getAll('Riscos'),
        db.getAll('Funcionarios'),
        db.getAll('HistoricoPDF'),
        db.getPerfisResumo()
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

      const periodicidades = Object.fromEntries(perfis.map(p => [`${p.SetorID}:${p.CargoID}`, Number(p.PeriodicidadeVencimentoMeses || 12)]));
      const elegiveis = funcionarios.filter(f =>
        String(f.Situacao || '').toUpperCase() === 'ATIVO' && !String(f.Condicao || '').trim()
      ).map(f => {
        const meses = periodicidades[`${f.SetorID}:${f.CargoID}`] || 12;
        const vencimento = f.UltimoExame ? dayjs(f.UltimoExame).add(meses, 'month') : (f.Vencimento ? dayjs(f.Vencimento) : null);
        return { ...f, StatusCalculado: vencimento?.isValid() && vencimento.isBefore(dayjs(), 'day') ? 'ATRASADO' : (vencimento ? 'NO PRAZO' : 'SEM VENCIMENTO') };
      });
      res.json({
        totalSetores: setores.length,
        totalCargos: cargos.length,
        totalRiscos: riscos.length,
        totalFuncionarios: funcionarios.length,
        totalHistorico: historico.length,
        geradosNoMes: geradosNoMes.length,
        funcionariosAtivos: funcionarios.filter(f => String(f.Situacao || '').toUpperCase() === 'ATIVO').length,
        funcionariosAfastados: funcionarios.filter(f => String(f.Situacao || '').toUpperCase() === 'AFASTADO').length,
        examesAtrasados: elegiveis.filter(f => f.StatusCalculado === 'ATRASADO').length,
        examesNoPrazo: elegiveis.filter(f => f.StatusCalculado === 'NO PRAZO').length,
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
