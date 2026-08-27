const express = require('express');
const router = express.Router();

const { makeCrudController } = require('../controllers/crudFactory');
const cargoRiscoController = require('../controllers/cargoRiscoController');
const cargoExameController = require('../controllers/cargoExameController');
const pdfController = require('../controllers/pdfController');
const dashboardController = require('../controllers/dashboardController');
const configController = require('../controllers/configController');
const funcionariosController = require('../controllers/funcionariosController');
const importacaoFuncionariosController = require('../controllers/importacaoFuncionariosController');
const backupController = require('../controllers/backupController');
const perguntasAnamneseController = require('../controllers/perguntasAnamneseController');

const setoresCtrl = makeCrudController('Setores', ['Nome']);
const cargosCtrl = makeCrudController('Cargos', ['Nome']);
const riscosCtrl = makeCrudController('Riscos', ['Grupo', 'Descricao', 'Agravos']);

router.get('/setores', setoresCtrl.listar);
router.get('/setores/:id', setoresCtrl.obter);
router.post('/setores', setoresCtrl.criar);
router.put('/setores/:id', setoresCtrl.atualizar);
router.delete('/setores/:id', setoresCtrl.remover);

router.get('/cargos', cargosCtrl.listar);
router.get('/cargos/:id', cargosCtrl.obter);
router.post('/cargos', cargosCtrl.criar);
router.put('/cargos/:id', cargosCtrl.atualizar);
router.delete('/cargos/:id', cargosCtrl.remover);

router.get('/riscos', riscosCtrl.listar);
router.get('/riscos/:id', riscosCtrl.obter);
router.post('/riscos', riscosCtrl.criar);
router.put('/riscos/:id', riscosCtrl.atualizar);
router.delete('/riscos/:id', riscosCtrl.remover);

router.get('/funcionarios', funcionariosController.listar);
router.get('/funcionarios/:id', funcionariosController.obter);
router.post('/funcionarios', funcionariosController.criar);
router.put('/funcionarios/:id', funcionariosController.atualizar);
router.delete('/funcionarios/:id', funcionariosController.remover);

router.get('/importacoes/funcionarios', importacaoFuncionariosController.listar);
router.post(
  '/importacoes/funcionarios',
  express.raw({ type: ['application/vnd.openxmlformats-officedocument.spreadsheetml.sheet', 'application/octet-stream'], limit: '25mb' }),
  importacaoFuncionariosController.analisar
);
router.get('/importacoes/funcionarios/:id', importacaoFuncionariosController.obter);
router.put('/importacoes/funcionarios/:id/empresas', importacaoFuncionariosController.mapearEmpresa);
router.put('/importacoes/funcionarios/:id/itens/:itemId', importacaoFuncionariosController.definirAcao);
router.post('/importacoes/funcionarios/:id/efetivar', importacaoFuncionariosController.efetivar);

router.get('/empresas', configController.empresas.listar);
router.get('/empresas/:id', configController.empresas.obter);
router.post('/empresas', configController.empresas.criar);
router.put('/empresas/:id', configController.empresas.atualizar);
router.delete('/empresas/:id', configController.empresas.remover);

router.get('/cargo-risco/resumo', cargoRiscoController.listarResumo);
router.get('/cargo-risco/:cargoId', cargoRiscoController.obterPorCargo);
router.post('/cargo-risco', cargoRiscoController.salvar);

router.get('/cargo-exame/resumo', cargoExameController.listarResumo);
router.get('/cargo-exame/:cargoId', cargoExameController.obterPorCargo);
router.post('/cargo-exame', cargoExameController.salvar);
router.get('/perfil-vencimento/:cargoId', cargoExameController.obterVencimento);
router.post('/perfil-vencimento', cargoExameController.salvarVencimento);

router.post('/gerar-pdf', pdfController.gerar);
router.get('/perguntas-anamnese', perguntasAnamneseController.listar);
router.post('/perguntas-anamnese', perguntasAnamneseController.criar);
router.put('/perguntas-anamnese/:id', perguntasAnamneseController.atualizar);
router.delete('/perguntas-anamnese/:id', perguntasAnamneseController.excluir);

router.get('/historico', pdfController.listarHistorico);
router.get('/historico/:id/download', pdfController.download);
router.get('/historico/:id/ficha-clinica', pdfController.downloadFichaClinica);
router.post('/historico/:id/regerar', pdfController.regerar);
router.put('/historico/:id', pdfController.salvarEdicao);
router.get('/historico/:id', pdfController.obterHistorico);
router.delete('/historico/:id', pdfController.excluir);

router.get('/dashboard/stats', dashboardController.stats);

router.get('/config', configController.obterConfig);
router.put('/config', configController.salvarConfig);

router.get('/backup/status', backupController.status);
router.put('/backup/config', backupController.salvarConfig);
router.post('/backup/criar', backupController.criar);
router.get('/backup/schema', backupController.baixarSchema);
router.post(
  '/backup/validar',
  express.raw({ type: ['application/octet-stream', 'application/x-medbackup'], limit: '100mb' }),
  backupController.validar
);
router.post('/backup/restaurar', backupController.restaurar);

router.get('/tipos-exame', configController.listarTipos);
router.post('/tipos-exame', configController.tipos.criar);
router.put('/tipos-exame/:id', configController.tipos.atualizar);
router.delete('/tipos-exame/:id', configController.tipos.remover);

router.get('/exames-complementares', configController.listarExames);
router.post('/exames-complementares', configController.exames.criar);
router.put('/exames-complementares/:id', configController.exames.atualizar);
router.delete('/exames-complementares/:id', configController.exames.remover);

router.get('/grupos-risco', configController.listarGrupos);
router.post('/grupos-risco', configController.grupos.criar);
router.put('/grupos-risco/:id', configController.grupos.atualizar);
router.delete('/grupos-risco/:id', configController.grupos.remover);

module.exports = router;
