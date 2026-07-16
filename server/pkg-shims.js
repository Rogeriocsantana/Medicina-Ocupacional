// Módulos que o pkg às vezes omite (require dinâmico em dependências transitivas).
// Importar aqui força a inclusão no snapshot do .exe.
try { require('es-get-iterator'); } catch (_) {}
try { require('deep-equal'); } catch (_) {}
try { require('object-is'); } catch (_) {}
try { require('is-arguments'); } catch (_) {}
try { require('is-date-object'); } catch (_) {}
try { require('is-regex'); } catch (_) {}
try { require('object-keys'); } catch (_) {}
try { require('call-bind'); } catch (_) {}
try { require('which-boxed-primitive'); } catch (_) {}
try { require('which-collection'); } catch (_) {}
try { require('which-typed-array'); } catch (_) {}
try { require('regexp.prototype.flags'); } catch (_) {}
