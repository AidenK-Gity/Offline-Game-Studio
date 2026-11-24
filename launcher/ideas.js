// Idea board: the roadmap from ideas/ideas.json plus ideas jotted down on the phone.
// Phone ideas are saved locally and can be exported as JSON to paste into ideas/ideas.json.

import { h, toast, shareOrDownload, confirmButton } from './dom.js';
import { GENRES, LENGTHS, STATUSES, genreOf } from './meta.js';
import { state, saveIdeas } from './state.js';

const view = { genre: null, mine: false, formOpen: false };

function ideaCard(idea, mine, rerender) {
  const genre = genreOf(idea.genre);
  const built = state.registry.games.find((g) => g.id === idea.id);
  return h('article', { class: 'idea' },
    h('h3', {}, h('span', {}, genre.icon), idea.title),
    h('div', { class: 'tags' },
      h('span', { class: 'tag' }, genre.label),
      idea.length && h('span', { class: 'tag' }, LENGTHS[idea.length]?.label || idea.length),
      h('span', { class: 'tag' }, built ? 'In the arcade' : STATUSES[idea.status] || 'Idea'),
      mine && h('span', { class: 'tag' }, 'on this phone'),
    ),
    idea.pitch && h('p', {}, idea.pitch),
    (mine || built) && h('div', { class: 'actions' },
      built && h('a', { class: 'btn small primary', href: `#play/${built.id}` }, 'Play'),
      mine && confirmButton('Delete', 'Tap to confirm', async () => {
        state.ideas = state.ideas.filter((i) => i !== idea);
        await saveIdeas();
        rerender();
      }, 'btn small danger'),
    ),
  );
}

function newIdeaForm(rerender) {
  const title = h('input', { name: 'title', placeholder: 'Working title', required: true, maxlength: 60, autocomplete: 'off' });
  const pitch = h('textarea', { name: 'pitch', placeholder: 'The hook in a sentence or two — what makes it fun?', maxlength: 600 });
  const genre = h('select', { name: 'genre', 'aria-label': 'Genre' },
    Object.entries(GENRES).map(([id, g]) => h('option', { value: id }, g.label)));
  const length = h('select', { name: 'length', 'aria-label': 'Length' },
    Object.entries(LENGTHS).map(([id, l]) => h('option', { value: id }, l.label)));
  return h('form', {
    class: 'new-idea',
    async onsubmit(e) {
      e.preventDefault();
      if (!title.value.trim()) return;
      state.ideas.unshift({
        title: title.value.trim(),
        pitch: pitch.value.trim(),
        genre: genre.value,
        length: length.value,
        status: 'idea',
        created: new Date().toISOString().slice(0, 10),
      });
      await saveIdeas();
      view.formOpen = false;
      toast('Idea saved');
      rerender();
    },
  },
  title, pitch, h('div', { class: 'row' }, genre, length),
  h('div', { class: 'row' },
    h('button', { class: 'btn primary', type: 'submit', style: { flex: '1' } }, 'Save idea'),
    h('button', { class: 'btn', type: 'button', onclick() { view.formOpen = false; rerender(); } }, 'Cancel')),
  );
}

export function renderIdeas(root) {
  const rerender = () => renderIdeas(root);
  const mine = state.ideas.map((i) => ({ idea: i, mine: true }));
  const base = state.baseIdeas.map((i) => ({ idea: i, mine: false }));
  const list = [...mine, ...base].filter(({ idea, mine: m }) =>
    (!view.genre || idea.genre === view.genre) && (!view.mine || m));

  const chip = (label, on, onclick) => h('button', { class: 'chip' + (on ? ' on' : ''), onclick }, label);

  root.replaceChildren(
    h('header', { class: 'page-head' },
      h('h1', {}, 'Idea Board'),
      h('span', { class: 'sub' }, `${mine.length + base.length} ideas`)),
    view.formOpen
      ? newIdeaForm(rerender)
      : h('button', { class: 'btn primary', style: { width: '100%' }, onclick() { view.formOpen = true; rerender(); root.querySelector('input')?.focus(); } }, '+ New idea'),
    h('div', { class: 'chips' },
      chip('All', !view.genre && !view.mine, () => { view.genre = null; view.mine = false; rerender(); }),
      chip('📱 Mine', view.mine, () => { view.mine = !view.mine; rerender(); }),
      Object.entries(GENRES).map(([id, g]) =>
        chip(`${g.icon} ${g.label}`, view.genre === id, () => { view.genre = view.genre === id ? null : id; rerender(); })),
    ),
    h('div', { style: { marginTop: '12px' } },
      list.length ? list.map(({ idea, mine: m }) => ideaCard(idea, m, rerender)) : h('div', { class: 'empty' }, 'No ideas here yet.')),
    mine.length > 0 && h('div', { style: { marginTop: '16px', display: 'grid', gap: '8px' } },
      h('button', {
        class: 'btn',
        async onclick() {
          const json = JSON.stringify(state.ideas, null, 2);
          await shareOrDownload(new Blob([json], { type: 'application/json' }), 'my-game-ideas.json');
        },
      }, 'Export my ideas (JSON)'),
      h('p', { class: 'sub', style: { color: 'var(--muted)', fontSize: '13px', margin: 0 } },
        'Paste exported ideas into ideas/ideas.json in the repo to put them on the roadmap.'),
    ),
  );
}
