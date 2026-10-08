const db = require('../services/mysqlService');
const { makeCrudController } = require('./crudFactory');

const tiposCtrl = makeCrudController('TiposExame', ['Chave', 'Nome', 'Ordem', 'SelecionavelASO']);
const examesCtrl = makeCrudController('ExamesComplementares', ['Nome', 'Ordem']);
const gruposCtrl = makeCrudController('GruposRisco', ['Nome', 'Cor', 'Ordem']);
const empresasCtrl = makeCrudController(
  'Empresas',
  ['RazaoSocial', 'CNPJ', 'Endereco', 'Bairro', 'CidadeUf', 'Cep', 'Telefone', 'LogoData'],
  ['RazaoSocial', 'CNPJ']
);

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
        'HospitalNome', 'Medico', 'CRM', 'Especialidade', 'RQE', 'IconeMedico'
      ];
      const data = {};
      campos.forEach(c => {
        if (req.body[c] !== undefined) data[c] = String(req.body[c]).trim();
      });
      if (!data.Medico) {
        return res.status(400).json({ erro: 'Médico é obrigatório.' });
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

  async listarGrupos(req, res) {
    try {
      res.json(await db.getGruposRisco());
    } catch (err) {
      console.error(err);
      res.status(500).json({ erro: 'Falha ao listar grupos de risco.' });
    }
  },

  tipos: tiposCtrl,
  exames: examesCtrl,
  grupos: gruposCtrl,
  empresas: empresasCtrl
};
