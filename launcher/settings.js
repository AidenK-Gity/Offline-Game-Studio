// Settings: sound, library options, save backup/restore, storage status, install help.

import { h, toast, shareOrDownload, pickTextFile, confirmButton } from './dom.js';
import { store } from '../engine/save.js';
import { audio } from '../engine/audio.js';
import { state, saveSettings, loadState } from './state.js';

const SAVE_FORMAT = 'offline-game-studio-saves';

function toggle(checked, onchange, label) {
  return h('label', { class: 'switch' },
    h('input', { type: 'checkbox', checked, onchange: (e) => onchange(e.target.checked), 'aria-label': label }),
    h('span', {}));
}

function item(label, hint, control) {
  return h('div', { class: 'item' },
    h('div', {}, h('div', { class: 'label' }, label), hint && h('div', { class: 'hint' }, hint)),
    control);
}

async function exportSaves() {
  const data = await store.entries();
  const payload = { format: SAVE_FORMAT, version: 1, exportedAt: new Date().toISOString(), data };
  const stamp = new Date().toISOString().slice(0, 10);
  await shareOrDownload(new Blob([JSON.stringify(payload)], { type: 'application/json' }), `game-saves-${stamp}.json`);
}

async function importSaves(rerender) {
  const text = await pickTextFile();
  if (!text) return;
  try {
    const payload = JSON.parse(text);
    if (payload.format !== SAVE_FORMAT || typeof payload.data !== 'object') throw new Error('Not a save file');
    await store.setMany(payload.data);
    await loadState();
    audio.muted = !state.settings.sound;
    toast(`Restored ${Object.keys(payload.data).length} save entries`);
    rerender();
  } catch (err) {
    toast('Import failed: ' + err.message, 3000);
  }
}

export async function renderSettings(root) {
  const rerender = () => renderSettings(root);
  const keys = await store.keys();
  const gameKeys = keys.filter((k) => !k.startsWith('_studio:'));
  const gamesWithSaves = new Set(gameKeys.map((k) => k.split(':')[0])).size;

  let persisted = null;
  let usage = '';
  try {
    persisted = await navigator.storage?.persisted?.();
    const est = await navigator.storage?.estimate?.();
    if (est?.usage != null) usage = `${(est.usage / 1024).toFixed(0)} KB used`;
  } catch { /* not supported */ }

  const standalone = matchMedia('(display-mode: standalone)').matches || navigator.standalone;
  const offline = !!navigator.serviceWorker?.controller;
  const reg = state.registry;

  root.replaceChildren(
    h('header', { class: 'page-head' }, h('h1', {}, 'Settings')),

    h('div', { class: 'group' },
      item('Sound', 'Synth sound effects (the iPhone silent switch mutes them too)',
        toggle(state.settings.sound, async (v) => { audio.muted = !v; await saveSettings({ sound: v }); if (v) audio.sfx('coin'); }, 'Sound')),
      item('Show prototypes', 'Include unfinished games in the library',
        toggle(state.settings.showPrototypes, (v) => saveSettings({ showPrototypes: v }), 'Show prototypes')),
    ),

    h('h2', { class: 'section' }, 'Saves'),
    h('div', { class: 'group' },
      item('Back up saves', `${gamesWithSaves} game${gamesWithSaves === 1 ? '' : 's'} with save data · ${usage || 'size unknown'}`,
        h('button', { class: 'btn small', onclick: exportSaves }, 'Export')),
      item('Restore saves', 'Import a backup file (merges over current saves)',
        h('button', { class: 'btn small', onclick: () => importSaves(rerender) }, 'Import')),
      item('Storage protection',
        persisted ? 'Saves are protected from automatic cleanup' : 'Browser may clear saves if storage runs low — add to Home Screen and back up occasionally',
        persisted
          ? h('span', { class: 'hint' }, '✓')
          : h('button', {
            class: 'btn small',
            async onclick() {
              const ok = await navigator.storage?.persist?.();
              toast(ok ? 'Storage protected' : 'Not granted — keep backups');
              rerender();
            },
          }, 'Protect')),
    ),

    h('h2', { class: 'section' }, 'Offline & install'),
    h('div', { class: 'group' },
      item('Offline ready', offline ? 'Every game is cached on this device' : 'Not cached yet — open from the hosted link once', h('span', {}, offline ? '✅' : '⏳')),
      item('Installed', standalone ? 'Running from the Home Screen' : 'Running in the browser', h('span', {}, standalone ? '✅' : '—')),
      !standalone && h('div', { class: 'help' },
        'Install on iPhone:',
        h('ol', {},
          h('li', {}, 'Open this page in Safari.'),
          h('li', {}, 'Tap the Share button.'),
          h('li', {}, 'Choose “Add to Home Screen”.'),
          h('li', {}, 'Launch it from the new icon — it now works in airplane mode.'))),
    ),

    h('h2', { class: 'section' }, 'About'),
    h('div', { class: 'group' },
      item('Version', reg.builtAt ? `Built ${new Date(reg.builtAt).toLocaleString()}` : 'Development build', h('code', {}, String(reg.version).slice(0, 8))),
      item('Games', null, h('span', {}, String(reg.games.length))),
    ),

    h('h2', { class: 'section' }, 'Danger zone'),
    h('div', { class: 'group' },
      item('Erase everything', 'Deletes all saves, favorites and phone ideas',
        confirmButton('Erase', 'Tap again', async () => {
          await store.clearAll();
          await loadState();
          toast('All data erased');
          rerender();
        }, 'btn small danger')),
    ),
  );
}
