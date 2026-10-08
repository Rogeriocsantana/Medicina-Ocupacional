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
        const dias = vencimento?.isValid() ? vencimento.startOf('day').diff(dayjs().startOf('day'), 'day') : null;
        return { ...f, DiasVencimento: dias, StatusCalculado: dias != null && dias < 0 ? 'ATRASADO' : (vencimento ? 'NO PRAZO' : 'SEM VENCIMENTO') };
      });
      const hojeMes = dayjs();
      const meses = Array.from({ length: 8 }, (_, indice) => hojeMes.subtract(7 - indice, 'month'));
      const asosPorMes = meses.map(mes => ({
        chave: mes.format('YYYY-MM'),
        mes: mes.format('MMM').replace('.', ''),
        total: historico.filter(h => {
          const [data] = String(h.DataGeracao || '').split(' ');
          const [d, m, y] = data.split('/').map(Number);
          return d && m && y && `${y}-${String(m).padStart(2, '0')}` === mes.format('YYYY-MM');
        }).length
      }));
      const faixasVencimento = [
        { faixa: 'Até 7 dias', total: elegiveis.filter(f => f.DiasVencimento >= 0 && f.DiasVencimento <= 7).length },
        { faixa: '8 a 15 dias', total: elegiveis.filter(f => f.DiasVencimento >= 8 && f.DiasVencimento <= 15).length },
        { faixa: '16 a 30 dias', total: elegiveis.filter(f => f.DiasVencimento >= 16 && f.DiasVencimento <= 30).length },
        { faixa: '31 a 60 dias', total: elegiveis.filter(f => f.DiasVencimento >= 31 && f.DiasVencimento <= 60).length }
      ];
      res.json({
        totalSetores: setores.length,
        totalCargos: cargos.length,
        totalRiscos: riscos.length,
        totalFuncionarios: funcionarios.length,
        totalHistorico: historico.length,
        geradosNoMes: geradosNoMes.length,
        funcionariosAtivos: funcionarios.filter(f => String(f.Situacao || '').toUpperCase() === 'ATIVO').length,
        funcionariosAfastados: funcionarios.filter(f => String(f.Situacao || '').toUpperCase() === 'ATIVO' && String(f.Condicao || '').toUpperCase() === 'AFASTADO').length,
        examesAtrasados: elegiveis.filter(f => f.StatusCalculado === 'ATRASADO').length,
        examesNoPrazo: elegiveis.filter(f => f.StatusCalculado === 'NO PRAZO').length,
        vencer30: elegiveis.filter(f => f.DiasVencimento >= 0 && f.DiasVencimento <= 30).length,
        asosPorMes,
        faixasVencimento,
        ultimosGerados: historico
          .sort((a, b) => Number(b.ID) - Number(a.ID))
          .slice(0, 5)
      });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao carregar estatísticas.' });
    }
  },

  async indicadores(req, res) {
    try {
      const params = [];
      const filters = ['1=1'];
      if (req.query.empresa) { filters.push('f.empresa_id=?'); params.push(req.query.empresa); }
      if (req.query.setor) { filters.push('f.setor_id=?'); params.push(req.query.setor); }
      if (req.query.situacao) { filters.push('f.situacao=?'); params.push(req.query.situacao); }
      const employeeWhere = filters.join(' AND ');
      const period = column => {
        const clauses = [];
        const values = [...params];
        if (req.query.inicio) { clauses.push(`${column}>=?`); values.push(req.query.inicio); }
        if (req.query.fim) { clauses.push(`${column}<=?`); values.push(req.query.fim); }
        return { sql: clauses.length ? ` AND ${clauses.join(' AND ')}` : '', params: values };
      };
      const examPeriod = period('r.data_exame');
      const catPeriod = period('r.data_acidente');
      const referralPeriod = period('r.data_encaminhamento');
      const certificatePeriod = period('r.data_inicio');
      const [summary, companies, sectors, cargos, conditions, exams, examTypes, cats, catAgents, referrals, specialties, attention, recentExams, recentCats, recentReferrals] = await Promise.all([
        db.pool.query(`SELECT COUNT(*) total,SUM(f.situacao='ATIVO') ativos,SUM(f.situacao='ATIVO' AND f.condicao='AFASTADO') afastados,SUM(f.situacao='DESLIGADO') desligados,
          SUM(f.situacao='ATIVO' AND COALESCE(f.condicao,'')='' AND f.vencimento<CURRENT_DATE) atrasados,
          SUM(f.situacao='ATIVO' AND COALESCE(f.condicao,'')='' AND f.vencimento BETWEEN CURRENT_DATE AND DATE_ADD(CURRENT_DATE,INTERVAL 30 DAY)) vencer30,
          SUM(f.situacao='ATIVO' AND COALESCE(f.condicao,'')='' AND f.vencimento BETWEEN DATE_ADD(CURRENT_DATE,INTERVAL 31 DAY) AND DATE_ADD(CURRENT_DATE,INTERVAL 60 DAY)) vencer60
          FROM funcionarios f WHERE ${employeeWhere}`, params),
        db.pool.query(`SELECT e.razao_social nome,COUNT(*) total FROM funcionarios f JOIN empresas e ON e.id=f.empresa_id WHERE f.situacao='ATIVO' AND ${employeeWhere} GROUP BY e.id,e.razao_social ORDER BY total DESC`, params),
        db.pool.query(`SELECT s.nome,COUNT(*) total FROM funcionarios f JOIN setores s ON s.id=f.setor_id WHERE f.situacao='ATIVO' AND ${employeeWhere} GROUP BY s.id,s.nome ORDER BY total DESC LIMIT 8`, params),
        db.pool.query(`SELECT c.nome,COUNT(*) total FROM funcionarios f JOIN cargos c ON c.id=f.cargo_id WHERE f.situacao='ATIVO' AND ${employeeWhere} GROUP BY c.id,c.nome ORDER BY total DESC LIMIT 8`, params),
        db.pool.query(`SELECT COALESCE(NULLIF(f.condicao,''),'SEM CONDIÇÃO') nome,COUNT(*) total FROM funcionarios f WHERE f.situacao='ATIVO' AND ${employeeWhere} GROUP BY f.condicao ORDER BY total DESC`, params),
        db.pool.query(`SELECT DATE_FORMAT(r.data_exame,'%Y-%m') mes,COUNT(*) total FROM exames_realizados r JOIN funcionarios f ON f.id=r.funcionario_id WHERE r.ativo=1 AND ${employeeWhere}${examPeriod.sql} GROUP BY mes ORDER BY mes`, examPeriod.params),
        db.pool.query(`SELECT r.tipo_exame nome,COUNT(*) total FROM exames_realizados r JOIN funcionarios f ON f.id=r.funcionario_id WHERE r.ativo=1 AND ${employeeWhere}${examPeriod.sql} GROUP BY r.tipo_exame ORDER BY total DESC`, examPeriod.params),
        db.pool.query(`SELECT DATE_FORMAT(r.data_acidente,'%Y-%m') mes,COUNT(*) total FROM acidentes_trabalho r JOIN funcionarios f ON f.id=r.funcionario_id WHERE ${employeeWhere}${catPeriod.sql} GROUP BY mes ORDER BY mes`, catPeriod.params),
        db.pool.query(`SELECT COALESCE(NULLIF(r.agente_causador,''),'NÃO INFORMADO') nome,COUNT(*) total FROM acidentes_trabalho r JOIN funcionarios f ON f.id=r.funcionario_id WHERE ${employeeWhere}${catPeriod.sql} GROUP BY r.agente_causador ORDER BY total DESC`, catPeriod.params),
        db.pool.query(`SELECT DATE_FORMAT(r.data_encaminhamento,'%Y-%m') mes,COUNT(*) total FROM encaminhamentos_ocupacionais r JOIN funcionarios f ON f.id=r.funcionario_id WHERE ${employeeWhere}${referralPeriod.sql} GROUP BY mes ORDER BY mes`, referralPeriod.params),
        db.pool.query(`SELECT r.especialidade nome,COUNT(*) total FROM encaminhamentos_ocupacionais r JOIN funcionarios f ON f.id=r.funcionario_id WHERE ${employeeWhere}${referralPeriod.sql} GROUP BY r.especialidade ORDER BY total DESC`, referralPeriod.params),
        db.pool.query(`SELECT f.nome,f.cpf,f.ultimo_exame,f.vencimento,e.razao_social empresa,s.nome setor,
          CASE WHEN f.vencimento<CURRENT_DATE THEN 'ATRASADO' ELSE CONCAT('EM ',DATEDIFF(f.vencimento,CURRENT_DATE),' DIAS') END situacao
          FROM funcionarios f JOIN empresas e ON e.id=f.empresa_id JOIN setores s ON s.id=f.setor_id WHERE f.situacao='ATIVO' AND COALESCE(f.condicao,'')='' AND f.vencimento<=DATE_ADD(CURRENT_DATE,INTERVAL 60 DAY) AND ${employeeWhere} ORDER BY f.vencimento LIMIT 30`, params),
        db.pool.query(`SELECT r.data_exame data,r.tipo_exame detalhe,r.origem,r.historico_aso_id,
          CASE WHEN r.historico_aso_id IS NULL THEN 'SEM PDF' ELSE 'ASO VINCULADO' END situacao,
          f.nome,f.cpf,e.razao_social empresa,s.nome setor FROM exames_realizados r JOIN funcionarios f ON f.id=r.funcionario_id JOIN empresas e ON e.id=f.empresa_id JOIN setores s ON s.id=f.setor_id WHERE r.ativo=1 AND ${employeeWhere}${examPeriod.sql} ORDER BY r.data_exame DESC,r.id DESC LIMIT 30`, examPeriod.params),
        db.pool.query(`SELECT r.data_acidente data,r.descricao detalhe,r.cat_emitida situacao,f.nome,f.cpf,e.razao_social empresa,s.nome setor FROM acidentes_trabalho r JOIN funcionarios f ON f.id=r.funcionario_id JOIN empresas e ON e.id=f.empresa_id JOIN setores s ON s.id=f.setor_id WHERE ${employeeWhere}${catPeriod.sql} ORDER BY r.data_acidente DESC,r.id DESC LIMIT 30`, catPeriod.params),
        db.pool.query(`SELECT r.data_encaminhamento data,CONCAT(r.especialidade,' · ',r.motivo) detalhe,r.situacao,f.nome,f.cpf,e.razao_social empresa,s.nome setor FROM encaminhamentos_ocupacionais r JOIN funcionarios f ON f.id=r.funcionario_id JOIN empresas e ON e.id=f.empresa_id JOIN setores s ON s.id=f.setor_id WHERE ${employeeWhere}${referralPeriod.sql} ORDER BY r.data_encaminhamento DESC,r.id DESC LIMIT 30`, referralPeriod.params)
      ]);
      const [certificates, certificateCids, recentCertificates, certificateSummary] = await Promise.all([
        db.pool.query(`SELECT DATE_FORMAT(r.data_inicio,'%Y-%m') mes,COUNT(*) total FROM atestados_medicos r JOIN funcionarios f ON f.id=r.funcionario_id WHERE ${employeeWhere}${certificatePeriod.sql} GROUP BY mes ORDER BY mes`, certificatePeriod.params),
        db.pool.query(`SELECT COALESCE(NULLIF(r.cid,''),'Sem CID') nome,COUNT(*) total FROM atestados_medicos r JOIN funcionarios f ON f.id=r.funcionario_id WHERE ${employeeWhere}${certificatePeriod.sql} GROUP BY COALESCE(NULLIF(r.cid,''),'Sem CID') ORDER BY total DESC LIMIT 10`, certificatePeriod.params),
        db.pool.query(`SELECT r.data_inicio data,CONCAT(IF(r.tipo='HORAS',CONCAT(r.quantidade,' hora(s)'),CONCAT(r.quantidade,' dia(s)')),IF(r.cid IS NULL,'',CONCAT(' · CID ',r.cid))) detalhe,IF(r.afastamento_inss=1,'INSS','REGISTRADO') situacao,f.nome,f.cpf,e.razao_social empresa,s.nome setor FROM atestados_medicos r JOIN funcionarios f ON f.id=r.funcionario_id JOIN empresas e ON e.id=f.empresa_id JOIN setores s ON s.id=f.setor_id WHERE ${employeeWhere}${certificatePeriod.sql} ORDER BY r.data_inicio DESC,r.id DESC LIMIT 30`, certificatePeriod.params),
        db.pool.query(`SELECT COUNT(*) total,COALESCE(SUM(IF(r.tipo='DIAS',r.quantidade,r.quantidade/8)),0) dias,COALESCE(AVG(IF(r.tipo='DIAS',r.quantidade,r.quantidade/8)),0) media,COALESCE(SUM(r.afastamento_inss=1),0) inss FROM atestados_medicos r JOIN funcionarios f ON f.id=r.funcionario_id WHERE ${employeeWhere}${certificatePeriod.sql}`, certificatePeriod.params)
      ]);
      res.json({ resumo: summary[0][0], empresas: companies[0], setores: sectors[0], cargos: cargos[0], condicoes: conditions[0], examesMes: exams[0], tiposExame: examTypes[0], acidentesMes: cats[0], agentes: catAgents[0], encaminhamentosMes: referrals[0], especialidades: specialties[0], atencao: attention[0], examesRecentes: recentExams[0], acidentesRecentes: recentCats[0], encaminhamentosRecentes: recentReferrals[0], atestadosMes: certificates[0], cidsAtestados: certificateCids[0], atestadosRecentes: recentCertificates[0], resumoAtestados: certificateSummary[0][0] });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao carregar indicadores.' });
    }
  }
};
