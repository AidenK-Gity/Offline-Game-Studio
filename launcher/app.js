// Launcher entry: boot, routing (#home, #ideas, #settings, #play/<id>), service worker.

import { audio } from '../engine/audio.js';
import { mountGame } from '../engine/shell.js';
import { state, loadState, refreshRuns, findGame, pushRecent, saveSettings } from './state.js';
import { renderLibrary } from './library.js';
import { renderIdeas } from './ideas.js';
import { renderSettings } from './settings.js';
import { h } from './dom.js';

const viewEl = document.getElementById('view');
const gameRoot = document.getElementById('game-root');
let currentGame = null;
let routeToken = 0;

async function route() {
  const token = ++routeToken;
  const [view, arg] = (location.hash.slice(1) || 'home').split('/');

  if (currentGame) {
    const g = currentGame;
    currentGame = null;
    await g.destroy();
    document.body.classList.remove('playing');
    await refreshRuns();
  }
  if (token !== routeToken) return;

  if (view === 'play') {
    const meta = findGame(arg);
    if (!meta) {
      location.replace('#home');
      return;
    }
    document.body.classList.add('playing');
    pushRecent(meta.id);
    try {
      const game = await mountGame(meta, gameRoot, { onExit: () => location.replace('#home') });
      if (token !== routeToken) {
        await game.destroy();
        return;
      }
      currentGame = game;
    } catch (err) {
      console.error(err);
      document.body.classList.remove('playing');
      location.replace('#home');
    }
    return;
  }

  for (const a of document.querySelectorAll('#tabs a')) {
    a.classList.toggle('active', a.dataset.tab === view || (view === 'home' && a.dataset.tab === 'home'));
  }
  viewEl.scrollTop = 0;
  if (view === 'ideas') renderIdeas(viewEl);
  else if (view === 'settings') await renderSettings(viewEl);
  else renderLibrary(viewEl);
}

function registerServiceWorker() {
  if (!('serviceWorker' in navigator)) return;
  const local = ['localhost', '127.0.0.1'].includes(location.hostname);
  if (local && !location.search.includes('sw=1')) {
    // Dev mode: no caching so edits show up immediately. Use ?sw=1 to test offline.
    // If an earlier ?sw=1 session left a worker in charge, remove it and its caches, then reload once.
    const stale = !!navigator.serviceWorker.controller;
    Promise.all([
      navigator.serviceWorker.getRegistrations().then((rs) => Promise.all(rs.map((r) => r.unregister()))),
      caches.keys().then((ks) => Promise.all(ks.filter((k) => k.startsWith('ogs-')).map((k) => caches.delete(k)))),
    ]).then(() => { if (stale) location.reload(); });
    return;
  }
  const hadController = !!navigator.serviceWorker.controller;
  navigator.serviceWorker.register('./sw.js').then((reg) => {
    const offerUpdate = (worker) => showBanner('New version ready', 'Update', () => worker.postMessage('skipWaiting'));
    if (reg.waiting && hadController) offerUpdate(reg.waiting);
    reg.addEventListener('updatefound', () => {
      const w = reg.installing;
      w?.addEventListener('statechange', () => {
        if (w.state === 'installed' && navigator.serviceWorker.controller) offerUpdate(w);
      });
    });
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible' && navigator.onLine) reg.update().catch(() => {});
    });
  }).catch((err) => console.warn('[studio] service worker failed', err));

  let reloading = false;
  navigator.serviceWorker.addEventListener('controllerchange', () => {
    if (!hadController || reloading) return;
    reloading = true;
    location.reload();
  });
}

function showBanner(text, action, onClick) {
  const el = document.getElementById('banner');
  el.replaceChildren(h('span', {}, text), h('button', { onclick: onClick }, action));
  el.hidden = false;
}

function preventZoomGestures() {
  for (const t of ['gesturestart', 'gesturechange']) {
    document.addEventListener(t, (e) => e.preventDefault(), { passive: false });
  }
  let lastTouch = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouch < 300 && e.target.closest?.('.game-stage')) e.preventDefault();
    lastTouch = now;
  }, { passive: false });
}

async function main() {
  preventZoomGestures();
  const unlock = () => audio.unlock();
  document.addEventListener('pointerdown', unlock, { capture: true, passive: true });
  document.addEventListener('touchend', unlock, { capture: true, passive: true });

  await loadState();
  audio.muted = !state.settings.sound;
  document.addEventListener('studio:sound', (e) => saveSettings({ sound: e.detail }));

  if (navigator.storage?.persisted) {
    navigator.storage.persisted().then((p) => { if (!p) navigator.storage.persist?.().catch(() => {}); });
  }

  window.addEventListener('hashchange', route);
  await route();
  registerServiceWorker();
}

main();
