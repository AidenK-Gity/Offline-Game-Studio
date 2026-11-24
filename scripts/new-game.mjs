#!/usr/bin/env node
// Scaffold a new game folder from the template.
//   node scripts/new-game.mjs <id> [--title "Name"] [--genre arcade] [--length quick] [--players 1] [--icon 🎮]

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const args = process.argv.slice(2);
const id = args[0];
const opt = (name, fallback) => {
  const i = args.indexOf(`--${name}`);
  return i >= 0 && args[i + 1] ? args[i + 1] : fallback;
};

if (!id || !/^[a-z0-9][a-z0-9-]*$/.test(id)) {
  console.error('Usage: node scripts/new-game.mjs <id> [--title "Name"] [--genre arcade|puzzle|roguelite|party|roguelike] [--length quick|session|long] [--players 1|2|2-4] [--icon 🎮]');
  console.error('  <id> must be lowercase letters, digits and dashes, e.g. "pipe-bloom".');
  process.exit(1);
}

const dir = path.join(ROOT, 'games', id);
if (fs.existsSync(dir)) {
  console.error(`games/${id} already exists.`);
  process.exit(1);
}

const title = opt('title', id.split('-').map((w) => w[0].toUpperCase() + w.slice(1)).join(' '));
const meta = {
  id,
  title,
  icon: opt('icon', '🎮'),
  genre: opt('genre', 'arcade'),
  length: opt('length', 'quick'),
  players: opt('players', '1'),
  status: 'prototype',
  tags: [],
  saves: 'resume',
  description: 'TODO: one or two sentences about the hook.',
  added: new Date().toISOString().slice(0, 10),
};

const template = fs.readFileSync(path.join(ROOT, 'scripts', 'templates', 'main.js'), 'utf8').replaceAll('__TITLE__', title);
fs.mkdirSync(dir, { recursive: true });
fs.writeFileSync(path.join(dir, 'game.json'), JSON.stringify(meta, null, 2) + '\n');
fs.writeFileSync(path.join(dir, 'main.js'), template);

console.log(`Created games/${id}/ (status: prototype).`);
console.log('Edit game.json and main.js, then run: node scripts/serve.mjs');
