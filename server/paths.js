const path = require('path');

/**
 * Raiz gravável do app.
 * - Em desenvolvimento: pasta do projeto
 * - No .exe (pkg): pasta onde está o executável (dados/ fica ao lado do .exe)
 */
function getDataRoot() {
  if (process.pkg) {
    return path.dirname(process.execPath);
  }
  return path.join(__dirname, '..');
}

/**
 * Raiz de recursos embutidos (views, public).
 * No pkg ficam no filesystem virtual (snapshot).
 */
function getResourceRoot() {
  return path.join(__dirname, '..');
}

function isPackaged() {
  return Boolean(process.pkg);
}

module.exports = {
  getDataRoot,
  getResourceRoot,
  isPackaged
};
