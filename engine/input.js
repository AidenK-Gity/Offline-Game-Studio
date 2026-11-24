// Touch-first input. Events (all coordinates in CSS pixels relative to the element):
//   down  {x, y, id}          finger/mouse pressed (fires instantly — use for arcade games)
//   move  {x, y, dx, dy, id}  dx/dy are relative to where the press started
//   up    {x, y, id}
//   tap   {x, y}              short press without much movement
//   swipe {dir, dx, dy}       dir: 'left' | 'right' | 'up' | 'down'
//   key   {key}               keyboard (desktop testing). Space/Enter also fire `down`.

export function createInput(el) {
  const handlers = {};
  const pointers = new Map();
  let enabled = true;

  const emit = (type, e) => {
    if (!enabled) return;
    for (const fn of handlers[type] || []) fn(e);
  };

  const pos = (e) => {
    const r = el.getBoundingClientRect();
    return { x: e.clientX - r.left, y: e.clientY - r.top };
  };

  function onDown(e) {
    e.preventDefault();
    try { el.setPointerCapture(e.pointerId); } catch { /* ignore */ }
    const p = pos(e);
    pointers.set(e.pointerId, { sx: p.x, sy: p.y, x: p.x, y: p.y, t: performance.now() });
    emit('down', { ...p, id: e.pointerId });
  }

  function onMove(e) {
    const ptr = pointers.get(e.pointerId);
    if (!ptr) return;
    const p = pos(e);
    ptr.x = p.x;
    ptr.y = p.y;
    emit('move', { ...p, dx: p.x - ptr.sx, dy: p.y - ptr.sy, id: e.pointerId });
  }

  function onUp(e) {
    const ptr = pointers.get(e.pointerId);
    if (!ptr) return;
    pointers.delete(e.pointerId);
    const p = pos(e);
    const dx = p.x - ptr.sx;
    const dy = p.y - ptr.sy;
    const dist = Math.hypot(dx, dy);
    const dt = performance.now() - ptr.t;
    emit('up', { ...p, id: e.pointerId });
    if (dist < 14 && dt < 400) emit('tap', p);
    else if (dist > 30 && dt < 600) {
      const dir = Math.abs(dx) > Math.abs(dy) ? (dx > 0 ? 'right' : 'left') : (dy > 0 ? 'down' : 'up');
      emit('swipe', { dir, dx, dy });
    }
  }

  function onCancel(e) {
    pointers.delete(e.pointerId);
  }

  const ARROWS = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
  function onKey(e) {
    if (e.repeat) return;
    emit('key', { key: e.key });
    if (e.key === ' ' || e.key === 'Enter') {
      e.preventDefault();
      const r = el.getBoundingClientRect();
      emit('down', { x: r.width / 2, y: r.height / 2, id: -1 });
      emit('tap', { x: r.width / 2, y: r.height / 2 });
    } else if (ARROWS[e.key]) {
      e.preventDefault();
      emit('swipe', { dir: ARROWS[e.key], dx: 0, dy: 0 });
    }
  }

  const noMenu = (e) => e.preventDefault();

  el.addEventListener('pointerdown', onDown);
  el.addEventListener('pointermove', onMove);
  el.addEventListener('pointerup', onUp);
  el.addEventListener('pointercancel', onCancel);
  el.addEventListener('contextmenu', noMenu);
  window.addEventListener('keydown', onKey);

  return {
    on(type, fn) {
      (handlers[type] ||= []).push(fn);
      return () => {
        handlers[type] = handlers[type].filter((f) => f !== fn);
      };
    },
    get enabled() {
      return enabled;
    },
    set enabled(v) {
      enabled = v;
      if (!v) pointers.clear();
    },
    /** Live map of pressed pointers: id -> {sx, sy, x, y, t} */
    pointers,
    destroy() {
      el.removeEventListener('pointerdown', onDown);
      el.removeEventListener('pointermove', onMove);
      el.removeEventListener('pointerup', onUp);
      el.removeEventListener('pointercancel', onCancel);
      el.removeEventListener('contextmenu', noMenu);
      window.removeEventListener('keydown', onKey);
      for (const k of Object.keys(handlers)) delete handlers[k];
    },
  };
}
