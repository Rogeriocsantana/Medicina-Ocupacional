const service = require('../services/registrosOcupacionaisService');
const especiais = require('../services/registrosEspeciaisImportService');
const importService = tipo => ['condicoes', 'presencas'].includes(tipo) ? especiais : service;

function handle(res, err, fallback) {
  console.error(err);
  res.status(err.status || 500).json({ erro: err.message || fallback });
}

module.exports = {
  async listar(req, res) { try { res.json(await service.list(req.params.tipo, req.query)); } catch (err) { handle(res, err, 'Falha ao listar registros.'); } },
  async criar(req, res) { try { const id = await service.save(req.params.tipo, null, req.body); res.status(201).json({ sucesso: true, id }); } catch (err) { handle(res, err, 'Falha ao criar registro.'); } },
  async atualizar(req, res) { try { await service.save(req.params.tipo, req.params.id, req.body); res.json({ sucesso: true }); } catch (err) { handle(res, err, 'Falha ao atualizar registro.'); } },
  async excluir(req, res) { try { const ok = await service.remove(req.params.tipo, req.params.id); if (!ok) return res.status(404).json({ erro: 'Registro não encontrado.' }); res.json({ sucesso: true }); } catch (err) { handle(res, err, 'Falha ao excluir registro.'); } },
  async modelo(req, res) {
    try {
      const buffer = await importService(req.params.tipo).template(req.params.tipo);
      res.set({ 'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'Content-Disposition': `attachment; filename="modelo-${req.params.tipo}.xlsx"`, 'Cache-Control': 'no-store' });
      res.send(Buffer.from(buffer));
    } catch (err) { handle(res, err, 'Falha ao gerar modelo.'); }
  },
  async analisar(req, res) { try { if (!req.body?.length) return res.status(400).json({ erro: 'Envie uma planilha XLSX.' }); res.json({ itens: await importService(req.params.tipo).analyze(req.params.tipo, req.body) }); } catch (err) { handle(res, err, 'Falha ao analisar planilha.'); } },
  async importar(req, res) { try { res.json({ sucesso: true, importados: await importService(req.params.tipo).importRows(req.params.tipo, req.body.itens) }); } catch (err) { handle(res, err, 'Falha ao importar registros.'); } }
};
