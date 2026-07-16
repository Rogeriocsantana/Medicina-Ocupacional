const db = require('../services/excelService');
const { makeCrudController } = require('./crudFactory');

const tiposCtrl = makeCrudController('TiposExame', ['Chave', 'Nome', 'Ordem']);
const examesCtrl = makeCrudController('ExamesComplementares', ['Nome', 'Ordem']);

module.exports = {
  async obterConfig(req, res) {
    try {
      const config = await db.getConfig();
      res.json(config);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao ler configurações.' });
    }
  },

  async salvarConfig(req, res) {
    try {
      const campos = [
        'RazaoSocial', 'CNPJ', 'Endereco', 'Bairro', 'CidadeUf', 'Cep', 'Telefone',
        'HospitalNome', 'Medico', 'CRM', 'Especialidade', 'RQE'
      ];
      const data = {};
      campos.forEach(c => {
        if (req.body[c] !== undefined) data[c] = String(req.body[c]).trim();
      });
      if (!data.RazaoSocial || !data.CNPJ || !data.Medico) {
        return res.status(400).json({ erro: 'Razão Social, CNPJ e Médico são obrigatórios.' });
      }
      const saved = await db.saveConfig(data);
      res.json(saved);
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao salvar configurações.' });
    }
  },

  async listarTipos(req, res) {
    try {
      res.json(await db.getTiposExame());
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao listar tipos de exame.' });
    }
  },

  async listarExames(req, res) {
    try {
      res.json(await db.getExamesComplementares());
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao listar exames.' });
    }
  },

  tipos: tiposCtrl,
  exames: examesCtrl
};
