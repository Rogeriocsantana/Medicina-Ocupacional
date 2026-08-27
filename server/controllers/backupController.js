const crypto = require('crypto');
const backupService = require('../services/backupService');

const validacoes = new Map();
const VALIDADE_TOKEN_MS = 10 * 60 * 1000;
let operacaoEmAndamento = false;

function limparTokensExpirados() {
  const agora = Date.now();
  for (const [token, item] of validacoes) {
    if (agora - item.criadoEm > VALIDADE_TOKEN_MS) validacoes.delete(token);
  }
}

module.exports = {
  async status(req, res) {
    try {
      res.json(await backupService.obterStatus());
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao consultar o status do backup.' });
    }
  },

  async salvarConfig(req, res) {
    try {
      res.json(await backupService.salvarConfig(req.body));
    } catch (err) {
      res.status(400).json({ erro: err.message });
    }
  },

  async criar(req, res) {
    if (operacaoEmAndamento) return res.status(409).json({ erro: 'Já existe uma operação de backup em andamento.' });
    operacaoEmAndamento = true;
    try {
      const backup = await backupService.criarBackup();
      const data = backup.criadoEm.toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const nome = `gestao-ocupacional-${data}.medbackup`;
      res.set({
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename="${nome}"`,
        'Content-Length': backup.buffer.length,
        'Cache-Control': 'no-store'
      });
      res.send(backup.buffer);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao criar o backup completo.' });
    } finally {
      operacaoEmAndamento = false;
    }
  },

  async baixarSchema(req, res) {
    try {
      const schema = await backupService.criarSchemaSql();
      const data = new Date().toISOString().slice(0, 10);
      res.set({
        'Content-Type': 'application/sql; charset=utf-8',
        'Content-Disposition': `attachment; filename="medicina-db-schema-${data}.sql"`,
        'Content-Length': Buffer.byteLength(schema),
        'Cache-Control': 'no-store'
      });
      res.send(schema);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao exportar o schema do banco.' });
    }
  },

  async validar(req, res) {
    if (operacaoEmAndamento) return res.status(409).json({ erro: 'Já existe uma operação de backup em andamento.' });
    try {
      limparTokensExpirados();
      const validado = await backupService.validarBackup(req.body);
      const token = crypto.randomUUID();
      validacoes.set(token, { payload: validado.payload, criadoEm: Date.now() });
      res.json({ token, ...validado.resumo, validadeMinutos: 10 });
    } catch (err) {
      console.error(err);
      res.status(400).json({ erro: err.message });
    }
  },

  async restaurar(req, res) {
    if (operacaoEmAndamento) return res.status(409).json({ erro: 'Já existe uma operação de backup em andamento.' });
    limparTokensExpirados();
    const item = validacoes.get(String(req.body.token || ''));
    if (!item) return res.status(400).json({ erro: 'Validação expirada. Selecione e valide o arquivo novamente.' });
    if (req.body.confirmacao !== 'RESTAURAR') {
      return res.status(400).json({ erro: 'Confirmação de restauração inválida.' });
    }
    operacaoEmAndamento = true;
    try {
      await backupService.restaurarBackup(item.payload);
      validacoes.clear();
      res.json({ sucesso: true, mensagem: 'Backup restaurado integralmente.' });
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: `Falha ao restaurar o backup: ${err.message}` });
    } finally {
      operacaoEmAndamento = false;
    }
  }
};
