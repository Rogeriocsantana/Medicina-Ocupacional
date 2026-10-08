process.env.TZ = process.env.TZ || 'America/Sao_Paulo';

require('./pkg-shims');

const path = require('path');
const express = require('express');
const { exec } = require('child_process');
const db = require('./services/mysqlService');
const backupService = require('./services/backupService');
const { runMigrations } = require('./services/migrationService');
const { getResourceRoot, getDataRoot, isPackaged } = require('./paths');
const { BASE_PATH, baseUrl } = require('./config');

const PORT = process.env.PORT || 3737;
const HOST = process.env.HOST || '127.0.0.1';

function openBrowser(url) {
  // Evita o pacote "open" (quebra com frequência no .exe gerado pelo pkg)
  try {
    if (process.platform === 'win32') {
      exec(`cmd /c start "" "${url}"`);
    } else if (process.platform === 'darwin') {
      exec(`open "${url}"`);
    } else {
      exec(`xdg-open "${url}"`);
    }
  } catch (err) {
    console.warn('Nao foi possivel abrir o navegador automaticamente:', err.message);
    console.warn('Abra manualmente:', url);
  }
}

function waitEnterAndExit(code = 1) {
  console.log('');
  console.log('Pressione Enter para fechar...');
  try {
    process.stdin.resume();
    process.stdin.setEncoding('utf8');
    process.stdin.once('data', () => process.exit(code));
  } catch (_) {
    setTimeout(() => process.exit(code), 15000);
  }
}

function createApplication() {
  const app = express();
  const application = express.Router();
  const resourceRoot = getResourceRoot();
  const dataRoot = getDataRoot();

  app.set('trust proxy', true);
  application.use(express.json({ limit: '25mb' }));
  application.use(express.urlencoded({ extended: true, limit: '25mb' }));

  app.set('view engine', 'ejs');
  app.set('views', path.join(resourceRoot, 'views'));
  app.set('etag', false);

  app.locals.basePath = BASE_PATH;
  app.locals.baseUrl = baseUrl;

  application.use('/public', express.static(path.join(dataRoot, 'public')));
  application.use('/public', express.static(path.join(resourceRoot, 'public')));

  application.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });
  application.use('/api', require('./routes/api'));

  if (!isPackaged() && process.env.ENABLE_DEBUG_DUMP === 'true') {
    application.get('/api/debug/dump', async (req, res) => {
      try {
        const sheets = Object.keys(db.SCHEMAS);
        const dump = {};
        for (const s of sheets) dump[s] = await db.getAll(s);
        res.json({ banco: db.DB_DESCRIPTION, dados: dump });
      } catch (err) {
        res.status(500).json({ erro: err.message });
      }
    });
  }

  const pages = {
    '/': 'dashboard',
    '/setores': 'setores',
    '/cargos': 'cargos',
    '/riscos': 'riscos',
    '/exames-complementares': 'exames-complementares',
    '/funcionarios': 'funcionarios',
    '/importar-funcionarios': 'importar-funcionarios',
    '/relacionamento': 'relacionamento',
    '/gerar-pdf': 'gerar-pdf',
    '/historico': 'historico',
    '/registros-ocupacionais': 'registros-ocupacionais',
    '/indicadores': 'indicadores',
    '/relatorios': 'relatorios',
    '/perguntas-anamnese': 'perguntas-anamnese',
    '/configuracoes': 'configuracoes'
  };
  Object.entries(pages).forEach(([route, view]) => {
    application.get(route, (req, res) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.render(view, { active: view });
    });
  });

  if (BASE_PATH) {
    app.use((req, res, next) => {
      const pathname = String(req.originalUrl || '').split('?')[0];
      if (pathname === BASE_PATH) return res.redirect(308, `${BASE_PATH}/`);
      next();
    });
  }
  app.use(BASE_PATH || '/', application);

  return app;
}

async function start() {
  if (process.env.RUN_DB_MIGRATIONS === 'true') {
    const migrations = await runMigrations(db.pool);
    if (migrations.length) console.log(`Migrações aplicadas: ${migrations.join(', ')}`);
  }
  await db.ensureDb();
  backupService.iniciarAgendador();
  const app = createApplication();

  app.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}${baseUrl()}`;
    console.log('==============================================');
    console.log(' Sistema ASO / PCMSO - Clinica Pierro');
    console.log(` Rodando em: ${url}`);
    console.log(` Caminho base: ${BASE_PATH || '(raiz)'}`);
    console.log(` Banco de dados: ${db.DB_DESCRIPTION}`);
    if (isPackaged()) console.log(' Modo: executavel (.exe) - Node embutido');
    console.log('==============================================');
    console.log('');
    console.log(' Deixe esta janela ABERTA enquanto usar o sistema.');
    console.log(' Para encerrar, feche esta janela.');
    console.log('');

    openBrowser(url);
  });
}

if (require.main === module) {
  start().catch(err => {
    console.error('');
    console.error('[ERRO] Falha ao iniciar o sistema:');
    console.error(err && err.stack ? err.stack : err);
    console.error('');
    console.error('Dica: se o antivirius bloqueou, libere o .exe e tente de novo.');
    waitEnterAndExit(1);
  });
}

module.exports = {
  createApplication,
  start
};
