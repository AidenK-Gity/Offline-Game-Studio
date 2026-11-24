// Tiny DOM helpers.

/** h('div', { class: 'x', onclick: fn }, child, 'text', [more]) */
export function h(tag, attrs = {}, ...children) {
  const el = document.createElement(tag);
  for (const [k, v] of Object.entries(attrs || {})) {
    if (v == null || v === false) continue;
    if (k.startsWith('on') && typeof v === 'function') el.addEventListener(k.slice(2), v);
    else if (k === 'style' && typeof v === 'object') {
      for (const [p, val] of Object.entries(v)) {
        if (p.startsWith('--')) el.style.setProperty(p, val);
        else el.style[p] = val;
      }
    }
    else if (k in el && typeof v !== 'string') el[k] = v;
    else el.setAttribute(k, v === true ? '' : v);
  }
  for (const c of children.flat(Infinity)) {
    if (c == null || c === false) continue;
    el.append(c instanceof Node ? c : document.createTextNode(String(c)));
  }
  return el;
}

/** App-level toast (outside games). */
export function toast(text, ms = 2000) {
  const t = h('div', { class: 'toast' }, text);
  document.getElementById('app').append(t);
  setTimeout(() => t.classList.add('out'), ms);
  setTimeout(() => t.remove(), ms + 400);
}

/** iOS-friendly file export: share sheet if available, otherwise a download. */
export async function shareOrDownload(blob, name) {
  try {
    const file = new File([blob], name, { type: blob.type });
    if (navigator.canShare?.({ files: [file] })) {
      await navigator.share({ files: [file], title: name });
      return true;
    }
  } catch (err) {
    if (err?.name === 'AbortError') return false;
  }
  const url = URL.createObjectURL(blob);
  const a = h('a', { href: url, download: name });
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 10000);
  return true;
}

/** Ask the user to pick a file; resolves to its text (or null). */
export function pickTextFile(accept = '.json,application/json') {
  return new Promise((resolve) => {
    const input = h('input', { type: 'file', accept, style: { display: 'none' } });
    input.addEventListener('change', async () => {
      const f = input.files?.[0];
      input.remove();
      resolve(f ? await f.text() : null);
    });
    document.body.append(input);
    input.click();
  });
}

/** A button that needs a second tap within 3s to fire. */
export function confirmButton(label, confirmLabel, onConfirm, cls = 'btn danger') {
  let armed = false;
  let timer = 0;
  const btn = h('button', {
    class: cls,
    onclick() {
      if (!armed) {
        armed = true;
        btn.textContent = confirmLabel;
        timer = setTimeout(() => { armed = false; btn.textContent = label; }, 3000);
        return;
      }
      clearTimeout(timer);
      armed = false;
      btn.textContent = label;
      onConfirm();
    },
  }, label);
  return btn;
}
