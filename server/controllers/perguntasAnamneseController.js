const db = require('../services/mysqlService');

function serializar(row) {
  return {
    ID: row.id,
    Pergunta: row.pergunta,
    Complemento: row.complemento || '',
    Ordem: Number(row.ordem)
  };
}

function validar(body) {
  const pergunta = String(body.Pergunta || '').trim();
  const complemento = String(body.Complemento || '').trim();
  const ordem = Number(body.Ordem);
  if (!pergunta) throw new Error('A pergunta é obrigatória.');
  if (!Number.isInteger(ordem) || ordem < 1 || ordem > 999) throw new Error('A ordem deve estar entre 1 e 999.');
  return { pergunta, complemento: complemento || null, ordem };
}

module.exports = {
  async listar(_req, res) {
    try {
      const [rows] = await db.pool.query('SELECT * FROM perguntas_anamnese_admissional ORDER BY ordem, id');
      res.json(rows.map(serializar));
    } catch (error) {
      console.error(error);
      res.status(500).json({ erro: 'Falha ao listar perguntas admissionais.' });
    }
  },

  async criar(req, res) {
    try {
      const dados = validar(req.body);
      const [result] = await db.pool.query(
        'INSERT INTO perguntas_anamnese_admissional (pergunta, complemento, ordem) VALUES (?, ?, ?)',
        [dados.pergunta, dados.complemento, dados.ordem]
      );
      const [rows] = await db.pool.query('SELECT * FROM perguntas_anamnese_admissional WHERE id = ?', [result.insertId]);
      res.status(201).json(serializar(rows[0]));
    } catch (error) {
      res.status(400).json({ erro: error.message || 'Falha ao criar pergunta.' });
    }
  },

  async atualizar(req, res) {
    try {
      const dados = validar(req.body);
      const [result] = await db.pool.query(
        'UPDATE perguntas_anamnese_admissional SET pergunta = ?, complemento = ?, ordem = ? WHERE id = ?',
        [dados.pergunta, dados.complemento, dados.ordem, req.params.id]
      );
      if (!result.affectedRows) return res.status(404).json({ erro: 'Pergunta não encontrada.' });
      const [rows] = await db.pool.query('SELECT * FROM perguntas_anamnese_admissional WHERE id = ?', [req.params.id]);
      res.json(serializar(rows[0]));
    } catch (error) {
      res.status(400).json({ erro: error.message || 'Falha ao atualizar pergunta.' });
    }
  },

  async excluir(req, res) {
    try {
      const [result] = await db.pool.query('DELETE FROM perguntas_anamnese_admissional WHERE id = ?', [req.params.id]);
      if (!result.affectedRows) return res.status(404).json({ erro: 'Pergunta não encontrada.' });
      res.json({ sucesso: true });
    } catch (error) {
      res.status(500).json({ erro: 'Falha ao excluir pergunta.' });
    }
  }
};
