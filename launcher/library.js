// Home screen: shelves (Continue / Favorites / Recent), filters, search, and the game grid.

import { h } from './dom.js';
import { GENRES, LENGTHS, genreOf, playersLabel, isMultiplayer, STATUSES } from './meta.js';
import { state, toggleFavorite, saveSettings } from './state.js';

// Filter state survives re-renders within a session.
const filter = { q: '', genre: null, length: null, multi: false };

function visibleGames() {
  return state.registry.games.filter((g) =>
    state.settings.showPrototypes || !['prototype', 'idea', 'building'].includes(g.status));
}

function matches(g) {
  if (filter.genre && g.genre !== filter.genre) return false;
  if (filter.length && g.length !== filter.length) return false;
  if (filter.multi && !isMultiplayer(g.players)) return false;
  if (filter.q) {
    const hay = [g.title, g.description, g.genre, ...(g.tags || [])].join(' ').toLowerCase();
    if (!filter.q.toLowerCase().split(/\s+/).every((w) => hay.includes(w))) return false;
  }
  return true;
}

function sortGames(list) {
  const recentIdx = new Map(state.recent.map((r, i) => [r.id, i]));
  const by = state.settings.sort;
  return [...list].sort((a, b) => {
    if (by === 'az') return a.title.localeCompare(b.title);
    if (by === 'new') return (b.added || '').localeCompare(a.added || '') || a.title.localeCompare(b.title);
    // recent: played first (most recent), then the rest A–Z
    const ra = recentIdx.has(a.id) ? recentIdx.get(a.id) : Infinity;
    const rb = recentIdx.has(b.id) ? recentIdx.get(b.id) : Infinity;
    return ra - rb || a.title.localeCompare(b.title);
  });
}

function card(g, rerender) {
  const genre = genreOf(g.genre);
  const fav = state.favorites.includes(g.id);
  const hasRun = state.runs.has(g.id);
  const proto = g.status === 'prototype' || g.status === 'building';
  return h('a', {
    class: 'card',
    href: `#play/${g.id}`,
    style: { '--g1': genre.g1, '--g2': genre.g2 },
    'aria-label': `${g.title}${hasRun ? ', run in progress' : ''}`,
  },
  h('div', { class: 'art' }, g.icon || genre.icon),
  hasRun ? h('span', { class: 'badge' }, 'CONTINUE') : proto ? h('span', { class: 'badge proto' }, STATUSES[g.status].toUpperCase()) : null,
  h('button', {
    class: 'fav',
    'aria-label': fav ? 'Remove from favorites' : 'Add to favorites',
    async onclick(e) {
      e.preventDefault();
      e.stopPropagation();
      await toggleFavorite(g.id);
      rerender();
    },
  }, fav ? '★' : '☆'),
  h('div', { class: 'title' }, g.title),
  h('div', { class: 'meta' }, [genre.label, LENGTHS[g.length]?.label, playersLabel(g.players)].filter(Boolean).join(' · ')),
  );
}

function shelf(title, games, rerender) {
  if (!games.length) return null;
  return [h('h2', { class: 'section' }, title), h('div', { class: 'shelf' }, games.map((g) => card(g, rerender)))];
}

function chip(label, on, onclick) {
  return h('button', { class: 'chip' + (on ? ' on' : ''), onclick, 'aria-pressed': String(!!on) }, label);
}

export function renderLibrary(root) {
  const rerender = () => {
    const scroll = root.scrollTop;
    renderLibrary(root);
    root.scrollTop = scroll;
  };

  const all = visibleGames();
  const byId = new Map(all.map((g) => [g.id, g]));
  const body = h('div', {});

  // Results area re-renders on its own so typing never rebuilds the search box.
  function renderBody() {
    const filtering = filter.q || filter.genre || filter.length || filter.multi;
    const list = sortGames(all.filter(matches));
    body.replaceChildren(...[
      !filtering && shelf('Continue', all.filter((g) => state.runs.has(g.id)), rerender),
      !filtering && shelf('Favorites', state.favorites.map((id) => byId.get(id)).filter(Boolean), rerender),
      h('h2', { class: 'section' }, filtering ? `${list.length} found` : 'All games', sortSelect),
      list.length
        ? h('div', { class: 'grid' }, list.map((g) => card(g, rerender)))
        : h('div', { class: 'empty' }, all.length ? 'No games match those filters.' : 'No games yet — run `node scripts/build.mjs`.'),
    ].flat().filter(Boolean));
  }

  let searchTimer = 0;
  const search = h('input', {
    class: 'search',
    type: 'search',
    placeholder: `Search ${all.length} games…`,
    value: filter.q,
    autocomplete: 'off',
    enterkeyhint: 'search',
    oninput(e) {
      filter.q = e.target.value;
      clearTimeout(searchTimer);
      searchTimer = setTimeout(renderBody, 120);
    },
  });

  const genreChips = h('div', { class: 'chips' },
    chip('All', !filter.genre, () => { filter.genre = null; rerender(); }),
    Object.entries(GENRES).map(([id, g]) =>
      chip(`${g.icon} ${g.label}`, filter.genre === id, () => { filter.genre = filter.genre === id ? null : id; rerender(); })),
  );
  const lengthChips = h('div', { class: 'chips' },
    Object.entries(LENGTHS).map(([id, l]) =>
      chip(l.label, filter.length === id, () => { filter.length = filter.length === id ? null : id; rerender(); })),
    chip('👥 2+ players', filter.multi, () => { filter.multi = !filter.multi; rerender(); }),
  );

  const sortSelect = h('select', {
    class: 'mini',
    'aria-label': 'Sort games',
    async onchange(e) { await saveSettings({ sort: e.target.value }); rerender(); },
  },
  h('option', { value: 'recent', selected: state.settings.sort === 'recent' }, 'Recently played'),
  h('option', { value: 'az', selected: state.settings.sort === 'az' }, 'A–Z'),
  h('option', { value: 'new', selected: state.settings.sort === 'new' }, 'Newest'),
  );

  const offline = navigator.serviceWorker?.controller ? 'offline ready ✓' : 'online';

  root.replaceChildren(
    h('header', { class: 'page-head' },
      h('h1', {}, 'Game Studio'),
      h('span', { class: 'sub' }, `${all.length} game${all.length === 1 ? '' : 's'} · ${offline}`)),
    search,
    genreChips,
    lengthChips,
    body,
  );
  renderBody();
}
