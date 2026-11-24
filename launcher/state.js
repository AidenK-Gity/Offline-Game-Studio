// Launcher state: game registry, settings, favorites, recents, in-progress runs.
// Everything the launcher persists lives under the "_studio:" key prefix.

import { store } from '../engine/save.js';

const K = {
  settings: '_studio:settings',
  favorites: '_studio:favorites',
  recent: '_studio:recent',
  ideas: '_studio:ideas',
};

export const state = {
  registry: { version: 'dev', builtAt: null, games: [] },
  settings: { sound: true, showPrototypes: true, sort: 'recent' },
  favorites: [],
  recent: [], // [{ id, at }] most recent first
  runs: new Set(), // game ids with a saved in-progress run
  ideas: [], // user-created ideas
  baseIdeas: [], // ideas/ideas.json
};

async function fetchJSON(url, fallback) {
  try {
    const res = await fetch(url, { cache: 'no-cache' });
    if (!res.ok) throw new Error(res.status);
    return await res.json();
  } catch (err) {
    console.warn('[studio] could not load', url, err);
    return fallback;
  }
}

export async function loadState() {
  const [registry, baseIdeas, settings, favorites, recent, ideas] = await Promise.all([
    fetchJSON('games/registry.json', null),
    fetchJSON('ideas/ideas.json', { ideas: [] }),
    store.get(K.settings),
    store.get(K.favorites),
    store.get(K.recent),
    store.get(K.ideas),
  ]);
  if (registry) state.registry = registry;
  state.baseIdeas = baseIdeas.ideas || [];
  Object.assign(state.settings, settings || {});
  state.favorites = favorites || [];
  state.recent = recent || [];
  state.ideas = ideas || [];
  await refreshRuns();
  return !!registry;
}

export async function refreshRuns() {
  const keys = await store.keys();
  state.runs = new Set(keys.filter((k) => !k.startsWith('_studio:') && k.endsWith(':run')).map((k) => k.slice(0, -4)));
}

export const findGame = (id) => state.registry.games.find((g) => g.id === id);

export async function saveSettings(patch) {
  Object.assign(state.settings, patch);
  await store.set(K.settings, state.settings);
}

export async function toggleFavorite(id) {
  const i = state.favorites.indexOf(id);
  if (i >= 0) state.favorites.splice(i, 1);
  else state.favorites.unshift(id);
  await store.set(K.favorites, state.favorites);
  return i < 0;
}

export async function pushRecent(id) {
  state.recent = [{ id, at: Date.now() }, ...state.recent.filter((r) => r.id !== id)].slice(0, 20);
  await store.set(K.recent, state.recent);
}

export async function saveIdeas() {
  await store.set(K.ideas, state.ideas);
}
