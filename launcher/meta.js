// Organization vocabulary shared by the library and the idea board.
// Add a genre here and it shows up as a filter chip everywhere.

export const GENRES = {
  arcade: { label: 'Arcade', icon: '⚡', g1: '#ff6b6b', g2: '#7a1f3d' },
  puzzle: { label: 'Puzzle', icon: '🧩', g1: '#4dabf7', g2: '#1c3d7a' },
  roguelite: { label: 'Roguelite', icon: '🎲', g1: '#b197fc', g2: '#3f2a7a' },
  sports: { label: 'Sports', icon: '🏆', g1: '#ff922b', g2: '#7a3a0c' },
  party: { label: 'Pass & Play', icon: '👥', g1: '#ffd43b', g2: '#7a5a12' },
  roguelike: { label: 'Roguelike', icon: '🗺️', g1: '#69db7c', g2: '#1d5a3a' },
};

export const LENGTHS = {
  quick: { label: 'Quick', hint: 'under 2 min' },
  session: { label: 'Session', hint: '5–15 min' },
  long: { label: 'Long', hint: 'multi-sitting, saves' },
};

export const STATUSES = {
  idea: 'Idea',
  planned: 'Planned',
  building: 'Building',
  prototype: 'Prototype',
  playable: 'Playable',
  polished: 'Polished',
};

export const genreOf = (id) => GENRES[id] || { label: id || 'Other', icon: '🎮', g1: '#666', g2: '#222' };

export function playersLabel(p) {
  if (!p || p === '1') return '1P';
  return `${p}P`;
}

export function isMultiplayer(p) {
  return p && p !== '1';
}
