const db = require('../services/excelService');

// Cria um controller CRUD genérico para uma planilha simples (Setores, Cargos, Riscos)
function makeCrudController(sheetName, allowedFields) {
  return {
    async listar(req, res) {
      try {
        const rows = await db.getAll(sheetName);
        res.json(rows);
      } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Falha ao ler dados.' });
      }
    },

    async obter(req, res) {
      try {
        const row = await db.getById(sheetName, req.params.id);
        if (!row) return res.status(404).json({ erro: 'Registro não encontrado.' });
        res.json(row);
      } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Falha ao ler dados.' });
      }
    },

    async criar(req, res) {
      try {
        const data = {};
        allowedFields.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
        const missing = allowedFields.filter(f => !data[f] && data[f] !== 0);
        if (missing.length) {
          return res.status(400).json({ erro: `Campos obrigatórios ausentes: ${missing.join(', ')}` });
        }
        const created = await db.insert(sheetName, data);
        res.status(201).json(created);
      } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Falha ao criar registro.' });
      }
    },

    async atualizar(req, res) {
      try {
        const data = {};
        allowedFields.forEach(f => { if (req.body[f] !== undefined) data[f] = req.body[f]; });
        const updated = await db.update(sheetName, req.params.id, data);
        if (!updated) return res.status(404).json({ erro: 'Registro não encontrado.' });
        res.json(updated);
      } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Falha ao atualizar registro.' });
      }
    },

    async remover(req, res) {
      try {
        const usage = await db.getUsage(sheetName, req.params.id);
        if (usage.length) {
          return res.status(409).json({
            erro: `Não é possível excluir: este registro está em uso por ${usage.join(', ')}. Remova os vínculos antes de excluí-lo.`
          });
        }
        const ok = await db.remove(sheetName, req.params.id);
        if (!ok) return res.status(404).json({ erro: 'Registro não encontrado.' });
        res.json({ sucesso: true });
      } catch (err) {
        console.error(err);
        res.status(500).json({ erro: 'Falha ao remover registro. Verifique se não está em uso.' });
      }
    }
  };
}

module.exports = { makeCrudController };
