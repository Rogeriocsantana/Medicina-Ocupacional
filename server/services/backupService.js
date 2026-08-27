const fs = require('fs');
const path = require('path');
const zlib = require('zlib');
const crypto = require('crypto');
const db = require('./mysqlService');
const { getDataRoot } = require('../paths');

const BACKUP_FORMAT = 'GESTAO_OCUPACIONAL_BACKUP_V1';
const MAX_BACKUP_DESCOMPACTADO = 200 * 1024 * 1024;
const BACKUP_DIR = path.resolve(process.env.BACKUP_DIR || path.join(getDataRoot(), 'backups', 'automaticos'));
const BACKUP_DISPLAY_DIR = String(process.env.BACKUP_DISPLAY_DIR || BACKUP_DIR);
const PREFIXO_PASTA_BACKUP = 'backup-';
const PREFIXO_BACKUP_LEGADO = 'gestao-ocupacional-auto-';
const INTERVALO_VERIFICACAO_MS = 60 * 60 * 1000;
let agendadorIniciado = false;
let backupAutomaticoEmAndamento = false;
const ARQUIVOS_PERSISTENTES = [
  'public/favicon.png',
  'public/apple-touch-icon.png',
  'public/images/logo-completo.png',
  'public/images/logo-icone.jpg'
];

function sha256(value) {
  return crypto.createHash('sha256').update(value).digest('hex');
}

async function obterEstrutura(connection = db.pool) {
  const [tabelas] = await connection.query(
    `SELECT table_name AS nome
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
        AND table_name <> 'schema_migrations'
      ORDER BY table_name`
  );
  const nomes = tabelas.map(item => item.nome);
  const estrutura = {};
  for (const tabela of nomes) {
    const [colunas] = await connection.query(
      `SELECT column_name AS nome, data_type AS tipo
         FROM information_schema.columns
        WHERE table_schema = DATABASE() AND table_name = ?
        ORDER BY ordinal_position`,
      [tabela]
    );
    estrutura[tabela] = colunas.map(coluna => ({
      nome: coluna.nome,
      tipo: String(coluna.tipo).toLowerCase()
    }));
  }
  return estrutura;
}

function coletarArquivos() {
  const root = getDataRoot();
  const arquivos = {};
  for (const relativo of ARQUIVOS_PERSISTENTES) {
    const absoluto = path.join(root, ...relativo.split('/'));
    if (!fs.existsSync(absoluto) || !fs.statSync(absoluto).isFile()) continue;
    const conteudo = fs.readFileSync(absoluto);
    arquivos[relativo] = {
      sha256: sha256(conteudo),
      conteudoBase64: conteudo.toString('base64')
    };
  }
  return arquivos;
}

async function criarBackup() {
  const agora = new Date();
  await db.pool.query('UPDATE config_geral SET ultimo_backup_em = ? WHERE id = 1', [agora]);
  const estrutura = await obterEstrutura();
  const tabelas = {};
  for (const tabela of Object.keys(estrutura)) {
    const [rows] = await db.pool.query(`SELECT * FROM \`${tabela}\` ORDER BY 1`);
    tabelas[tabela] = rows;
  }
  const [versoes] = await db.pool.query('SELECT versao FROM schema_migrations ORDER BY versao');
  const payload = {
    formato: BACKUP_FORMAT,
    criadoEm: agora.toISOString(),
    versoesSchema: versoes.map(item => item.versao),
    estrutura,
    tabelas,
    arquivos: coletarArquivos()
  };
  const payloadJson = JSON.stringify(payload);
  const envelope = JSON.stringify({
    checksum: sha256(payloadJson),
    payload
  });
  return {
    buffer: zlib.gzipSync(Buffer.from(envelope, 'utf8'), { level: 9 }),
    criadoEm: agora,
    totais: Object.fromEntries(Object.entries(tabelas).map(([nome, rows]) => [nome, rows.length]))
  };
}

function nomeArquivoBackup(data = new Date(), prefixo = 'gestao-ocupacional-') {
  return `${prefixo}${data.toISOString().replace(/[:.]/g, '-').slice(0, 19)}.medbackup`;
}

function nomePastaBackup(data = new Date()) {
  return `${PREFIXO_PASTA_BACKUP}${data.toISOString().replace(/[:.]/g, '-').slice(0, 19)}`;
}

function garantirDiretorioBackup() {
  fs.mkdirSync(BACKUP_DIR, { recursive: true });
  fs.accessSync(BACKUP_DIR, fs.constants.R_OK | fs.constants.W_OK);
}

function limparBackupsExpirados(retencaoDias) {
  garantirDiretorioBackup();
  const limite = Date.now() - retencaoDias * 86400000;
  let removidos = 0;
  for (const nome of fs.readdirSync(BACKUP_DIR)) {
    const item = path.join(BACKUP_DIR, nome);
    const stat = fs.lstatSync(item);
    const pastaAutomatica = nome.startsWith(PREFIXO_PASTA_BACKUP) && stat.isDirectory() && !stat.isSymbolicLink();
    const arquivoLegado = nome.startsWith(PREFIXO_BACKUP_LEGADO) && nome.endsWith('.medbackup') && stat.isFile();
    if ((pastaAutomatica || arquivoLegado) && stat.mtimeMs < limite) {
      if (pastaAutomatica) fs.rmSync(item, { recursive: true, force: false });
      else fs.unlinkSync(item);
      removidos += 1;
    }
  }
  return removidos;
}

async function criarBackupAutomatico(retencaoDias) {
  garantirDiretorioBackup();
  const backup = await criarBackup();
  const schema = await criarSchemaSql();
  const nome = nomePastaBackup(backup.criadoEm);
  const destino = path.join(BACKUP_DIR, nome);
  const temporario = path.join(BACKUP_DIR, `.tmp-${nome}-${process.pid}-${Date.now()}`);
  fs.mkdirSync(temporario, { recursive: false });
  try {
    fs.writeFileSync(path.join(temporario, 'gestao-ocupacional.medbackup'), backup.buffer, { flag: 'wx' });
    fs.writeFileSync(path.join(temporario, 'medicina-db-schema.sql'), schema, { encoding: 'utf8', flag: 'wx' });
    fs.renameSync(temporario, destino);
  } catch (err) {
    if (fs.existsSync(temporario)) fs.rmSync(temporario, { recursive: true, force: true });
    throw err;
  }
  await db.pool.query(
    'UPDATE config_geral SET ultimo_backup_automatico_em = ? WHERE id = 1',
    [backup.criadoEm]
  );
  const removidos = limparBackupsExpirados(retencaoDias);
  return { ...backup, nome, destino, removidos };
}

async function executarBackupAutomaticoSeNecessario() {
  if (backupAutomaticoEmAndamento) return null;
  backupAutomaticoEmAndamento = true;
  try {
    const status = await obterStatus();
    if (!status.backupAutomaticoPendente) {
      limparBackupsExpirados(status.retencaoDias);
      return null;
    }
    const resultado = await criarBackupAutomatico(status.retencaoDias);
    console.log(`[BACKUP] Backup automático criado: ${resultado.nome}`);
    return resultado;
  } catch (err) {
    console.error(`[BACKUP] Falha no backup automático: ${err.message}`);
    return null;
  } finally {
    backupAutomaticoEmAndamento = false;
  }
}

function iniciarAgendador() {
  if (agendadorIniciado) return;
  agendadorIniciado = true;
  const inicial = setTimeout(executarBackupAutomaticoSeNecessario, 15000);
  inicial.unref?.();
  const timer = setInterval(executarBackupAutomaticoSeNecessario, INTERVALO_VERIFICACAO_MS);
  timer.unref?.();
}

async function criarSchemaSql() {
  const [tabelas] = await db.pool.query(
    `SELECT table_name AS nome
       FROM information_schema.tables
      WHERE table_schema = DATABASE() AND table_type = 'BASE TABLE'
      ORDER BY table_name`
  );
  const partes = [
    '-- Gestão Ocupacional - schema MySQL 8',
    `-- Exportado em ${new Date().toISOString()}`,
    '-- Importe este arquivo em um banco vazio e depois restaure o arquivo .medbackup.',
    'SET NAMES utf8mb4;',
    'SET FOREIGN_KEY_CHECKS = 0;',
    ''
  ];
  for (const { nome } of tabelas) {
    const identificador = `\`${String(nome).replace(/`/g, '``')}\``;
    const [rows] = await db.pool.query(`SHOW CREATE TABLE ${identificador}`);
    partes.push(`${rows[0]['Create Table']};`, '');
  }
  const [migracoes] = await db.pool.query('SELECT versao, aplicado_em FROM schema_migrations ORDER BY versao');
  if (migracoes.length) {
    const valores = migracoes.map(item => {
      const versao = db.pool.escape(item.versao);
      const aplicado = db.pool.escape(item.aplicado_em);
      return `(${versao}, ${aplicado})`;
    });
    partes.push('INSERT INTO `schema_migrations` (`versao`, `aplicado_em`) VALUES', `${valores.join(',\n')};`, '');
  }
  partes.push('SET FOREIGN_KEY_CHECKS = 1;', '');
  return partes.join('\n');
}

function abrirBackup(buffer) {
  if (!Buffer.isBuffer(buffer) || !buffer.length) throw new Error('Arquivo de backup vazio.');
  let descompactado;
  try {
    descompactado = zlib.gunzipSync(buffer, { maxOutputLength: MAX_BACKUP_DESCOMPACTADO });
  } catch (_) {
    throw new Error('Arquivo de backup inválido ou corrompido.');
  }
  let envelope;
  try { envelope = JSON.parse(descompactado.toString('utf8')); } catch (_) {
    throw new Error('Conteúdo do backup não é válido.');
  }
  if (!envelope?.payload || envelope.payload.formato !== BACKUP_FORMAT) {
    throw new Error('Este arquivo não é um backup compatível da Gestão Ocupacional.');
  }
  const payloadJson = JSON.stringify(envelope.payload);
  if (!envelope.checksum || sha256(payloadJson) !== envelope.checksum) {
    throw new Error('A integridade do backup não pôde ser confirmada.');
  }
  return envelope.payload;
}

async function validarBackup(buffer) {
  const payload = abrirBackup(buffer);
  const atual = await obterEstrutura();
  const tabelasAtuais = Object.keys(atual).sort();
  const tabelasBackup = Object.keys(payload.tabelas || {}).sort();
  if (JSON.stringify(tabelasAtuais) !== JSON.stringify(tabelasBackup)) {
    throw new Error('O backup não possui o mesmo conjunto de tabelas desta versão do sistema.');
  }
  for (const tabela of tabelasAtuais) {
    if (!Array.isArray(payload.tabelas[tabela])) throw new Error(`Tabela inválida no backup: ${tabela}.`);
    const atuais = atual[tabela].map(item => item.nome);
    let salvas = (payload.estrutura?.[tabela] || []).map(item => item.nome);
    if (tabela === 'config_geral') {
      const compatibilidade = {
        backup_retencao_dias: 90,
        ultimo_backup_automatico_em: null
      };
      const faltantes = atuais.filter(nome => !salvas.includes(nome));
      const permitidas = faltantes.every(nome => Object.prototype.hasOwnProperty.call(compatibilidade, nome));
      if (permitidas && faltantes.length) {
        for (const row of payload.tabelas[tabela]) {
          for (const nome of faltantes) row[nome] = compatibilidade[nome];
        }
        payload.estrutura[tabela] = atual[tabela];
        salvas = atuais;
      }
    }
    if (JSON.stringify(atuais) !== JSON.stringify(salvas)) {
      throw new Error(`A estrutura da tabela ${tabela} não corresponde à versão atual.`);
    }
    for (const row of payload.tabelas[tabela]) {
      if (!row || typeof row !== 'object' || Array.isArray(row)) throw new Error(`Registro inválido em ${tabela}.`);
      if (Object.keys(row).some(coluna => !atuais.includes(coluna))) {
        throw new Error(`O backup contém coluna desconhecida em ${tabela}.`);
      }
    }
  }
  for (const [relativo, arquivo] of Object.entries(payload.arquivos || {})) {
    if (!ARQUIVOS_PERSISTENTES.includes(relativo)) throw new Error(`Arquivo não permitido no backup: ${relativo}.`);
    const conteudo = Buffer.from(String(arquivo.conteudoBase64 || ''), 'base64');
    if (sha256(conteudo) !== arquivo.sha256) throw new Error(`Arquivo corrompido no backup: ${relativo}.`);
  }
  return {
    payload,
    resumo: {
      criadoEm: payload.criadoEm,
      tabelas: tabelasBackup.length,
      registros: Object.values(payload.tabelas).reduce((total, rows) => total + rows.length, 0),
      arquivos: Object.keys(payload.arquivos || {}).length,
      totais: Object.fromEntries(Object.entries(payload.tabelas).map(([nome, rows]) => [nome, rows.length]))
    }
  };
}

async function restaurarBackup(payload) {
  const { payload: validado } = await validarBackup(
    zlib.gzipSync(Buffer.from(JSON.stringify({ checksum: sha256(JSON.stringify(payload)), payload }), 'utf8'))
  );
  const estrutura = await obterEstrutura();
  await db.withTransaction(async connection => {
    await connection.query('SET FOREIGN_KEY_CHECKS = 0');
    try {
      for (const tabela of Object.keys(estrutura)) {
        await connection.query(`DELETE FROM \`${tabela}\``);
      }
      for (const tabela of Object.keys(estrutura)) {
        const colunas = estrutura[tabela];
        const nomes = colunas.map(item => item.nome);
        const tipos = Object.fromEntries(colunas.map(item => [item.nome, item.tipo]));
        for (const row of validado.tabelas[tabela]) {
          const presentes = nomes.filter(nome => Object.prototype.hasOwnProperty.call(row, nome));
          if (!presentes.length) continue;
          const valores = presentes.map(nome => {
            const valor = row[nome];
            return tipos[nome] === 'json' && valor !== null && typeof valor !== 'string'
              ? JSON.stringify(valor) : valor;
          });
          await connection.query(
            `INSERT INTO \`${tabela}\` (${presentes.map(nome => `\`${nome}\``).join(', ')}) VALUES (${presentes.map(() => '?').join(', ')})`,
            valores
          );
        }
      }
    } finally {
      await connection.query('SET FOREIGN_KEY_CHECKS = 1');
    }
  });

  const root = getDataRoot();
  for (const [relativo, arquivo] of Object.entries(validado.arquivos || {})) {
    const absoluto = path.join(root, ...relativo.split('/'));
    fs.mkdirSync(path.dirname(absoluto), { recursive: true });
    const temporario = `${absoluto}.restore-${process.pid}-${Date.now()}`;
    fs.writeFileSync(temporario, Buffer.from(arquivo.conteudoBase64, 'base64'));
    fs.renameSync(temporario, absoluto);
  }
}

async function obterStatus() {
  const [rows] = await db.pool.query(
    `SELECT backup_intervalo_dias AS intervalo,
            backup_retencao_dias AS retencao,
            ultimo_backup_automatico_em AS ultimoAutomatico
       FROM config_geral WHERE id = 1`
  );
  const intervaloDias = Math.max(1, Number(rows[0]?.intervalo || 7));
  const retencaoDias = Math.max(1, Number(rows[0]?.retencao || 90));
  const ultimoBackupEm = rows[0]?.ultimoAutomatico || null;
  const ultimo = ultimoBackupEm ? new Date(ultimoBackupEm) : null;
  const proximo = ultimo ? new Date(ultimo.getTime() + intervaloDias * 86400000) : null;
  const agora = new Date();
  let pastaAcessivel = true;
  let erroPasta = null;
  try { garantirDiretorioBackup(); } catch (err) { pastaAcessivel = false; erroPasta = err.message; }
  return {
    intervaloDias,
    retencaoDias,
    diretorio: BACKUP_DISPLAY_DIR,
    pastaAcessivel,
    erroPasta,
    ultimoBackupEm: ultimo ? ultimo.toISOString() : null,
    proximoBackupEm: proximo ? proximo.toISOString() : null,
    backupAutomaticoPendente: !proximo || agora >= proximo
  };
}

async function salvarConfig(config = {}) {
  const dias = Number(config.intervaloDias);
  const retencao = Number(config.retencaoDias);
  if (!Number.isInteger(dias) || dias < 1 || dias > 365) {
    throw new Error('O intervalo deve estar entre 1 e 365 dias.');
  }
  if (!Number.isInteger(retencao) || retencao < 1 || retencao > 3650) {
    throw new Error('A retenção deve estar entre 1 e 3650 dias.');
  }
  await db.pool.query(
    'UPDATE config_geral SET backup_intervalo_dias = ?, backup_retencao_dias = ? WHERE id = 1',
    [dias, retencao]
  );
  limparBackupsExpirados(retencao);
  return obterStatus();
}

module.exports = {
  criarBackup,
  validarBackup,
  restaurarBackup,
  obterStatus,
  salvarConfig,
  criarSchemaSql,
  executarBackupAutomaticoSeNecessario,
  iniciarAgendador
};
