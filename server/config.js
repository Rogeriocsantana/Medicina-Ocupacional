const fs = require('fs');
const path = require('path');

function loadLocalEnv() {
  const envPath = path.resolve(process.cwd(), '.env');
  if (!fs.existsSync(envPath)) return;

  for (const rawLine of fs.readFileSync(envPath, 'utf8').split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith('#')) continue;

    const separator = line.indexOf('=');
    if (separator < 1) continue;

    const key = line.slice(0, separator).trim();
    let value = line.slice(separator + 1).trim();
    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    }

    if (process.env[key] === undefined) process.env[key] = value;
  }
}

loadLocalEnv();

function normalizeBasePath(value) {
  const raw = String(value || '').trim();
  if (!raw || raw === '/') return '';
  return `/${raw.replace(/^\/+|\/+$/g, '')}`;
}

const BASE_PATH = normalizeBasePath(process.env.BASE_PATH);

function baseUrl(relativePath = '') {
  const path = String(relativePath || '').replace(/^\/+/, '');
  if (!path) return BASE_PATH ? `${BASE_PATH}/` : '/';
  return `${BASE_PATH}/${path}`;
}

module.exports = {
  BASE_PATH,
  baseUrl,
  normalizeBasePath,
  loadLocalEnv
};
