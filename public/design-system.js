(function () {
  'use strict';

  const STORAGE_KEY = 'medicinaVisualPreferencesV1';
  const defaults = Object.freeze({
    sidebarWide: 208,
    sidebarCompact: 196,
    sidebarCollapsed: 76,
    pageTitle: 24,
    pageSubtitle: 14,
    spinnerSeconds: 2,
    loadingSeconds: 3,
    spinnerWidth: 1.25,
    track: '#2454b4',
    drop: '#38c8bb',
    glow: '#59ddd1',
    spin1: '#f4b400',
    spin2: '#4285f4',
    spin3: '#db4437',
    spin4: '#0f9d58'
  });
  const ranges = {
    sidebarWide: [190, 260], sidebarCompact: [160, 220], sidebarCollapsed: [60, 100],
    pageTitle: [22, 38], pageSubtitle: [11, 18], spinnerSeconds: [.6, 4],
    loadingSeconds: [.6, 4], spinnerWidth: [1, 5]
  };
  const colors = ['track', 'drop', 'glow', 'spin1', 'spin2', 'spin3', 'spin4'];
  const cssNames = {
    sidebarWide: '--mo-sidebar-wide', sidebarCompact: '--mo-sidebar-compact',
    sidebarCollapsed: '--mo-sidebar-collapsed', pageTitle: '--mo-page-title',
    pageSubtitle: '--mo-page-subtitle', spinnerSeconds: '--mo-spinner-duration',
    loadingSeconds: '--mo-loading-duration', spinnerWidth: '--mo-spinner-width',
    track: '--mo-track', drop: '--mo-drop', glow: '--mo-glow',
    spin1: '--mo-spin-1', spin2: '--mo-spin-2', spin3: '--mo-spin-3', spin4: '--mo-spin-4'
  };

  function readPreferences() {
    let saved = {};
    try { saved = JSON.parse(localStorage.getItem(STORAGE_KEY) || '{}') || {}; } catch (_) {}
    // Upgrade the former defaults without changing custom typography choices.
    if (!saved.recruitmentTypographyV1) {
      if (saved.pageTitle === 26) saved.pageTitle = 24;
      if (saved.pageSubtitle === 12) saved.pageSubtitle = 14;
      saved.recruitmentTypographyV1 = true;
      try { localStorage.setItem(STORAGE_KEY, JSON.stringify(saved)); } catch (_) {}
    }
    const next = { ...defaults };
    for (const [key, [min, max]] of Object.entries(ranges)) {
      const value = Number(saved[key]);
      if (Number.isFinite(value) && value >= min && value <= max) next[key] = value;
    }
    for (const key of colors) {
      if (typeof saved[key] === 'string' && /^#[0-9a-f]{6}$/i.test(saved[key])) next[key] = saved[key];
    }
    return next;
  }

  let preferences = readPreferences();
  function applyPreferences() {
    const style = document.documentElement.style;
    for (const [key, cssName] of Object.entries(cssNames)) {
      const value = preferences[key];
      style.setProperty(cssName, ranges[key] ? `${value}${key.endsWith('Seconds') ? 's' : key === 'spinnerWidth' ? '' : 'px'}` : value);
    }
  }
  applyPreferences();

  function savePreferences() {
    try { localStorage.setItem(STORAGE_KEY, JSON.stringify({ ...preferences, recruitmentTypographyV1: true })); return true; }
    catch (_) { return false; }
  }

  function syncInputs() {
    document.querySelectorAll('[data-mo-setting]').forEach(input => {
      const key = input.dataset.moSetting;
      if (key in preferences) input.value = preferences[key];
    });
  }

  function showInitialLoader() {
    const loader = document.getElementById('mo-initial-loader');
    if (!loader) return;
    loader.classList.remove('is-done');
    window.setTimeout(() => loader.classList.add('is-done'), 5000);
  }
  function hideInitialLoader() {
    document.getElementById('mo-initial-loader')?.classList.add('is-done');
  }

  function bindSettings() {
    const section = document.getElementById('painel-aparencia');
    if (!section) return;
    syncInputs();
    section.addEventListener('input', event => {
      const input = event.target.closest('[data-mo-setting]');
      if (!input) return;
      const key = input.dataset.moSetting;
      if (!(key in defaults)) return;
      if (ranges[key]) {
        const [min, max] = ranges[key];
        const number = Number(input.value);
        if (!Number.isFinite(number) || number < min || number > max) return;
        preferences[key] = number;
      } else if (colors.includes(key) && /^#[0-9a-f]{6}$/i.test(input.value)) {
        preferences[key] = input.value;
      } else return;
      applyPreferences();
      section.querySelectorAll(`[data-mo-setting="${key}"]`).forEach(peer => { if (peer !== input) peer.value = preferences[key]; });
    });
    section.querySelector('#mo-save-appearance')?.addEventListener('click', () => {
      if (savePreferences()) window.toast?.('Preferências visuais salvas neste navegador.');
      else window.toast?.('Não foi possível salvar as preferências neste navegador.', 'erro');
    });
    section.querySelector('#mo-reset-appearance')?.addEventListener('click', () => {
      preferences = { ...defaults };
      applyPreferences();
      syncInputs();
      if (savePreferences()) window.toast?.('Aparência restaurada para o padrão.');
      else window.toast?.('Padrão restaurado nesta sessão; não foi possível salvar.', 'erro');
    });
    section.querySelector('#mo-test-collapse')?.addEventListener('click', () => window.alternarMenuLateral?.());
    section.querySelector('#mo-test-loading')?.addEventListener('click', () => {
      showInitialLoader();
      window.setTimeout(hideInitialLoader, 1800);
    });
    section.querySelector('#mo-test-success')?.addEventListener('click', () => window.toast?.('Operação concluída com sucesso.'));
    section.querySelector('#mo-test-error')?.addEventListener('click', () => window.toast?.('Não foi possível concluir a operação.', 'erro'));
  }

  document.addEventListener('DOMContentLoaded', () => {
    bindSettings();
    document.addEventListener('click', event => {
      const link = event.target.closest('a[href]');
      if (!link || event.defaultPrevented || event.button !== 0 || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey || link.target === '_blank' || link.hasAttribute('download')) return;
      try {
        const target = new URL(link.href, window.location.href);
        if (target.origin !== window.location.origin || target.pathname === window.location.pathname && target.search === window.location.search) return;
        document.getElementById('mo-navigation-progress')?.classList.add('is-active');
      } catch (_) {}
    }, true);
  });
  window.addEventListener('load', hideInitialLoader, { once:true });
  window.addEventListener('pageshow', hideInitialLoader);
  window.setTimeout(hideInitialLoader, 5000);
})();
