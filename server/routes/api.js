const express = require('express');
const router = express.Router();

const { makeCrudController } = require('../controllers/crudFactory');
const cargoRiscoController = require('../controllers/cargoRiscoController');
const pdfController = require('../controllers/pdfController');
const dashboardController = require('../controllers/dashboardController');
const configController = require('../controllers/configController');
const funcionariosController = require('../controllers/funcionariosController');

const setoresCtrl = makeCrudController('Setores', ['Nome']);
const cargosCtrl = makeCrudController('Cargos', ['Nome']);
const riscosCtrl = makeCrudController('Riscos', ['Grupo', 'Descricao']);

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

router.get('/cargo-risco/resumo', cargoRiscoController.listarResumo);
router.get('/cargo-risco/:cargoId', cargoRiscoController.obterPorCargo);
router.post('/cargo-risco', cargoRiscoController.salvar);

router.post('/gerar-pdf', pdfController.gerar);

router.get('/historico', pdfController.listarHistorico);
router.get('/historico/:id/download', pdfController.download);
router.post('/historico/:id/regerar', pdfController.regerar);
router.put('/historico/:id', pdfController.salvarEdicao);
router.get('/historico/:id', pdfController.obterHistorico);
router.delete('/historico/:id', pdfController.excluir);

router.get('/dashboard/stats', dashboardController.stats);

router.get('/config', configController.obterConfig);
router.put('/config', configController.salvarConfig);

router.get('/tipos-exame', configController.listarTipos);
router.post('/tipos-exame', configController.tipos.criar);
router.put('/tipos-exame/:id', configController.tipos.atualizar);
router.delete('/tipos-exame/:id', configController.tipos.remover);

router.get('/exames-complementares', configController.listarExames);
router.post('/exames-complementares', configController.exames.criar);
router.put('/exames-complementares/:id', configController.exames.atualizar);
router.delete('/exames-complementares/:id', configController.exames.remover);

module.exports = router;
