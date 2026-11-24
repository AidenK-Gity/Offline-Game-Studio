// DOM overlays drawn on top of a game's canvas: menus, dialogs, toasts.

export function createUI(layer) {
  let current = null;

  function hide() {
    current?.remove();
    current = null;
  }

  /**
   * show({ title, body, lines, buttons: [{ label, primary, onClick, keepOpen }] })
   * `body` is plain text; `lines` is an array of plain-text lines.
   */
  function show({ title = '', body = '', lines = [], buttons = [] } = {}) {
    hide();
    const ov = document.createElement('div');
    ov.className = 'overlay';
    const panel = document.createElement('div');
    panel.className = 'panel';
    if (title) {
      const h = document.createElement('h2');
      h.textContent = title;
      panel.append(h);
    }
    for (const text of [body, ...lines].filter(Boolean)) {
      const p = document.createElement('p');
      p.textContent = text;
      panel.append(p);
    }
    const row = document.createElement('div');
    row.className = 'panel-buttons';
    for (const b of buttons) {
      const btn = document.createElement('button');
      btn.className = 'btn' + (b.primary ? ' primary' : '');
      btn.textContent = b.label;
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        if (!b.keepOpen) hide();
        b.onClick?.();
      });
      row.append(btn);
    }
    panel.append(row);
    ov.append(panel);
    ov.addEventListener('pointerdown', (e) => e.stopPropagation());
    layer.append(ov);
    current = ov;
    return hide;
  }

  function toast(text, ms = 1800) {
    const t = document.createElement('div');
    t.className = 'toast';
    t.textContent = text;
    layer.append(t);
    setTimeout(() => t.classList.add('out'), ms);
    setTimeout(() => t.remove(), ms + 400);
  }

  return {
    show,
    hide,
    toast,
    get isOpen() {
      return !!current;
    },
  };
}
