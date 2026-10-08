const service = require('../services/importacaoFuncionariosService');

function errorResponse(res, error, fallback) {
  console.error(error);
  const message = error && error.message ? error.message : fallback;
  res.status(400).json({ erro: message });
}

module.exports = {
  async baixarModelo(req, res) {
    try {
      const buffer = await service.generateTemplate();
      res.set({
        'Content-Type': 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
        'Content-Disposition': 'attachment; filename="modelo-importacao-funcionarios.xlsx"',
        'Content-Length': buffer.length,
        'Cache-Control': 'no-store'
      });
      res.send(Buffer.from(buffer));
    } catch (error) {
      errorResponse(res, error, 'Falha ao gerar o modelo de importação.');
    }
  },

  async listar(req, res) {
    try {
      res.json(await service.listBatches());
    } catch (error) {
      errorResponse(res, error, 'Falha ao listar importações.');
    }
  },

  async analisar(req, res) {
    try {
      if (!Buffer.isBuffer(req.body) || !req.body.length) {
        return res.status(400).json({ erro: 'Selecione um arquivo XLSX.' });
      }
      const fileName = decodeURIComponent(String(req.get('X-File-Name') || 'planilha.xlsx'));
      const id = await service.analyzeWorkbook(req.body, fileName);
      res.status(201).json(await service.getBatch(id));
    } catch (error) {
      errorResponse(res, error, 'Falha ao analisar a planilha.');
    }
  },

  async obter(req, res) {
    try {
      const result = await service.getBatch(req.params.id, { estado: req.query.estado });
      if (!result) return res.status(404).json({ erro: 'Importação não encontrada.' });
      res.json(result);
    } catch (error) {
      errorResponse(res, error, 'Falha ao ler a importação.');
    }
  },

  async mapearEmpresa(req, res) {
    try {
      await service.mapCompany(req.params.id, req.body.codigo, req.body.empresaId);
      res.json(await service.getBatch(req.params.id));
    } catch (error) {
      errorResponse(res, error, 'Falha ao mapear a empresa.');
    }
  },

  async definirAcao(req, res) {
    try {
      await service.setItemAction(req.params.id, req.params.itemId, req.body.acao);
      res.json(await service.getBatch(req.params.id));
    } catch (error) {
      errorResponse(res, error, 'Falha ao atualizar a linha.');
    }
  },

  async efetivar(req, res) {
    try {
      const resultado = await service.applyBatch(req.params.id, req.body.camposAtualizacao);
      res.json({ sucesso: true, ...resultado, importados: resultado.processados, dados: await service.getBatch(req.params.id) });
    } catch (error) {
      errorResponse(res, error, 'Falha ao efetivar a importação.');
    }
  }
};
