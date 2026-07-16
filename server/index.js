require('./pkg-shims');

const path = require('path');
const express = require('express');
const { exec } = require('child_process');
const db = require('./services/excelService');
const { getResourceRoot, getDataRoot, isPackaged } = require('./paths');

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

async function start() {
  await db.ensureDb();

  const app = express();
  const resourceRoot = getResourceRoot();
  const dataRoot = getDataRoot();

  app.use(express.json());
  app.use(express.urlencoded({ extended: true }));

  app.set('view engine', 'ejs');
  app.set('views', path.join(resourceRoot, 'views'));
  app.set('etag', false);

  app.use('/public', express.static(path.join(dataRoot, 'public')));
  app.use('/public', express.static(path.join(resourceRoot, 'public')));

  app.use('/api', (req, res, next) => {
    res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
    next();
  });
  app.use('/api', require('./routes/api'));

  if (!isPackaged() && process.env.NODE_ENV !== 'production') {
    app.get('/api/debug/dump', async (req, res) => {
      try {
        const sheets = Object.keys(db.SCHEMAS);
        const dump = {};
        for (const s of sheets) dump[s] = await db.getAll(s);
        res.json({ caminhoDoArquivo: db.DB_PATH, dados: dump });
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
    '/funcionarios': 'funcionarios',
    '/relacionamento': 'relacionamento',
    '/gerar-pdf': 'gerar-pdf',
    '/historico': 'historico',
    '/configuracoes': 'configuracoes'
  };
  Object.entries(pages).forEach(([route, view]) => {
    app.get(route, (req, res) => {
      res.set('Cache-Control', 'no-store, no-cache, must-revalidate');
      res.render(view, { active: view });
    });
  });

  app.listen(PORT, HOST, () => {
    const url = `http://${HOST}:${PORT}`;
    console.log('==============================================');
    console.log(' Sistema ASO / PCMSO - Clinica Pierro');
    console.log(` Rodando em: ${url}`);
    console.log(` Banco de dados: ${db.DB_PATH}`);
    if (isPackaged()) console.log(' Modo: executavel (.exe) - Node embutido');
    console.log('==============================================');
    console.log('');
    console.log(' Deixe esta janela ABERTA enquanto usar o sistema.');
    console.log(' Para encerrar, feche esta janela.');
    console.log('');

    openBrowser(url);
  });
}

start().catch(err => {
  console.error('');
  console.error('[ERRO] Falha ao iniciar o sistema:');
  console.error(err && err.stack ? err.stack : err);
  console.error('');
  console.error('Dica: se o antivirius bloqueou, libere o .exe e tente de novo.');
  waitEnterAndExit(1);
});
