const service = require('../services/condicoesPresencaService');

function error(res, err) { console.error(err); res.status(err.status || 500).json({ erro: err.status ? err.message : 'Falha ao salvar registro.' }); }

module.exports = {
  async listarCondicoes(req, res) { try { res.json(await service.conditions(req.query)); } catch (err) { error(res, err); } },
  async salvarCondicao(req, res) { try { const id = await service.saveCondition(req.params.id, req.body); res.status(req.params.id ? 200 : 201).json({ id }); } catch (err) { error(res, err); } },
  async encerrarCondicao(req, res) { try { await service.endCondition(req.params.id, req.body.data_fim, Boolean(req.body.corrigir)); res.json({ sucesso: true }); } catch (err) { error(res, err); } },
  async excluirCondicao(req, res) { try { await service.removeCondition(req.params.id); res.json({ sucesso: true }); } catch (err) { error(res, err); } },
  async listarPresencas(req, res) { try { res.json(await service.presenceList(req.query)); } catch (err) { error(res, err); } },
  async salvarPresenca(req, res) { try { const id = await service.savePresence(req.params.id, req.body); res.status(req.params.id ? 200 : 201).json({ id }); } catch (err) { error(res, err); } },
  async excluirPresenca(req, res) { try { const ok = await service.removePresence(req.params.id); if (!ok) return res.status(404).json({ erro: 'Presença não encontrada.' }); res.json({ sucesso: true }); } catch (err) { error(res, err); } }
};
