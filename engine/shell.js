// Mounts a game into the page and hands it the `ctx` API.
//
// A game module (games/<id>/main.js) exports:
//   export function start(ctx) -> { update(dt), draw(g), snapshot?(), restart?(), resize?(w, h), destroy?() }
//
// Saving: if the game implements snapshot(), the shell stores its return value as the
// game's "run" on pause, on app backgrounding, on exit and every few seconds.
// Return null from snapshot() when there is no run worth resuming (e.g. game over).
// On the next launch the saved run is passed in as ctx.resume.

import { createLoop } from './loop.js';
import { createInput } from './input.js';
import { gameSave } from './save.js';
import { audio } from './audio.js';
import { createUI } from './ui.js';
import * as rng from './rng.js';

const AUTOSAVE_MS = 5000;

function readInsets() {
  const probe = document.createElement('div');
  probe.style.cssText =
    'position:fixed;visibility:hidden;padding:env(safe-area-inset-top) env(safe-area-inset-right) env(safe-area-inset-bottom) env(safe-area-inset-left)';
  document.body.append(probe);
  const cs = getComputedStyle(probe);
  const insets = {
    top: parseFloat(cs.paddingTop) || 0,
    right: parseFloat(cs.paddingRight) || 0,
    bottom: parseFloat(cs.paddingBottom) || 0,
    left: parseFloat(cs.paddingLeft) || 0,
  };
  probe.remove();
  return insets;
}

export async function mountGame(meta, root, { onExit } = {}) {
  root.replaceChildren();

  const stage = document.createElement('div');
  stage.className = 'game-stage';
  const canvas = document.createElement('canvas');
  canvas.className = 'game-canvas';
  const layer = document.createElement('div');
  layer.className = 'game-layer';
  const pauseBtn = document.createElement('button');
  pauseBtn.className = 'pause-btn';
  pauseBtn.setAttribute('aria-label', 'Pause');
  stage.append(canvas, layer, pauseBtn);
  root.append(stage);

  const g = canvas.getContext('2d');
  const input = createInput(canvas);
  const ui = createUI(layer);
  const save = gameSave(meta.id);

  let instance = null;
  let paused = false;
  let destroyed = false;
  let autosaveTimer = 0;
  const cleanups = [];

  const ctx = {
    meta,
    canvas,
    g,
    width: 0,
    height: 0,
    dpr: 1,
    insets: readInsets(),
    input,
    audio,
    ui,
    rng,
    save: {
      ...save,
      /** Save the run right now (call after each turn in turn-based games). */
      checkpoint: () => persist(),
    },
    resume: null,
    exit: () => exit(),
    /** Standard game-over dialog. */
    gameOver({ title = 'Game over', lines = [], onRetry } = {}) {
      ui.show({
        title,
        lines,
        buttons: [
          { label: 'Play again', primary: true, onClick: () => (onRetry ? onRetry() : restart()) },
          { label: 'Exit', onClick: exit },
        ],
      });
    },
    get paused() {
      return paused;
    },
  };

  function resize() {
    const r = stage.getBoundingClientRect();
    const dpr = Math.min(window.devicePixelRatio || 1, 3);
    ctx.width = Math.max(1, Math.round(r.width));
    ctx.height = Math.max(1, Math.round(r.height));
    ctx.dpr = dpr;
    ctx.insets = readInsets();
    canvas.width = Math.round(ctx.width * dpr);
    canvas.height = Math.round(ctx.height * dpr);
    instance?.resize?.(ctx.width, ctx.height);
    if (instance && !loop.running) drawFrame();
  }

  function drawFrame() {
    g.setTransform(ctx.dpr, 0, 0, ctx.dpr, 0, 0);
    instance?.draw?.(g);
  }

  const loop = createLoop(
    (dt) => instance?.update?.(dt),
    drawFrame,
  );

  async function persist() {
    if (!instance?.snapshot) return;
    try {
      const snap = instance.snapshot();
      if (snap == null) await save.clear('run');
      else await save.set('run', snap);
    } catch (err) {
      console.warn(`[${meta.id}] save failed`, err);
    }
  }

  function pause() {
    if (paused || destroyed) return;
    paused = true;
    loop.stop();
    input.enabled = false;
    persist();
    showPauseMenu();
  }

  function showPauseMenu() {
    ui.show({
      title: 'Paused',
      body: meta.title,
      buttons: [
        { label: 'Resume', primary: true, onClick: resume },
        { label: 'Restart', onClick: () => { resume(); restart(); } },
        {
          label: 'Sound: ' + (audio.muted ? 'off' : 'on'),
          onClick() {
            audio.muted = !audio.muted;
            document.dispatchEvent(new CustomEvent('studio:sound', { detail: !audio.muted }));
            showPauseMenu();
          },
        },
        { label: 'Exit', onClick: exit },
      ],
    });
  }

  function resume() {
    if (!paused || destroyed) return;
    paused = false;
    ui.hide();
    input.enabled = true;
    loop.start();
  }

  async function restart() {
    await save.clear('run');
    if (instance?.restart) {
      instance.restart();
    } else {
      instance?.destroy?.();
      ctx.resume = null;
      instance = await mod.start(ctx);
    }
  }

  async function exit() {
    await destroy();
    onExit?.();
  }

  async function destroy() {
    if (destroyed) return;
    destroyed = true;
    clearInterval(autosaveTimer);
    loop.stop();
    await persist();
    instance?.destroy?.();
    input.destroy();
    cleanups.forEach((fn) => fn());
    root.replaceChildren();
  }

  const onVisibility = () => {
    if (document.visibilityState === 'hidden') pause();
  };
  const onPageHide = () => persist();
  document.addEventListener('visibilitychange', onVisibility);
  window.addEventListener('pagehide', onPageHide);
  cleanups.push(() => document.removeEventListener('visibilitychange', onVisibility));
  cleanups.push(() => window.removeEventListener('pagehide', onPageHide));

  const ro = new ResizeObserver(resize);
  ro.observe(stage);
  cleanups.push(() => ro.disconnect());

  pauseBtn.addEventListener('click', () => (paused ? resume() : pause()));

  // Load the game module and any saved run.
  const mod = await import(`../games/${meta.id}/main.js`);
  ctx.resume = (await save.get('run')) ?? null;
  resize();
  instance = await mod.start(ctx);
  if (destroyed) {
    instance?.destroy?.();
    return { destroy };
  }
  resize();
  loop.start();
  autosaveTimer = setInterval(() => {
    if (!paused) persist();
  }, AUTOSAVE_MS);

  return { destroy, pause, resume };
}
