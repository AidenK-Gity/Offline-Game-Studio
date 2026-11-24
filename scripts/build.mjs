#!/usr/bin/env node
// Build step (no dependencies):
//   1. Scans games/*/game.json -> validates -> writes games/registry.json
//   2. Generates PNG app icons if missing (or with --icons)
//   3. Lists every app file and writes sw.js with a content-hash version, so the
//      phone downloads updates once and then runs fully offline.

import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { fileURLToPath } from 'node:url';
import { writeIcons } from './icons.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const GENRES = ['arcade', 'puzzle', 'sports', 'roguelite', 'party', 'roguelike'];
const LENGTHS = ['quick', 'session', 'long'];
const STATUSES = ['idea', 'building', 'prototype', 'playable', 'polished'];

// Files the app needs at runtime. Everything else (scripts, docs, dotfiles) is skipped.
const CACHE_EXT = new Set(['.html', '.css', '.js', '.json', '.webmanifest', '.png', '.svg', '.jpg', '.jpeg', '.webp', '.gif', '.mp3', '.ogg', '.wav', '.m4a', '.woff2', '.txt']);
const SKIP_DIRS = new Set(['.git', '.github', '.claude', 'node_modules', 'scripts', 'docs', 'templates']);
const SKIP_FILES = new Set(['sw.js', 'package.json', 'package-lock.json']);

const rel = (p) => path.relative(ROOT, p).split(path.sep).join('/');

function walk(dir, out = []) {
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (entry.name.startsWith('.') && entry.name !== '.well-known') continue;
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) {
      if (!SKIP_DIRS.has(entry.name)) walk(full, out);
    } else if (CACHE_EXT.has(path.extname(entry.name).toLowerCase()) && !SKIP_FILES.has(entry.name)) {
      out.push(full);
    }
  }
  return out;
}

function loadGames() {
  const dir = path.join(ROOT, 'games');
  const games = [];
  const problems = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    if (!entry.isDirectory() || entry.name.startsWith('_')) continue;
    const metaPath = path.join(dir, entry.name, 'game.json');
    const mainPath = path.join(dir, entry.name, 'main.js');
    if (!fs.existsSync(metaPath)) { problems.push(`${entry.name}: missing game.json`); continue; }
    if (!fs.existsSync(mainPath)) { problems.push(`${entry.name}: missing main.js`); continue; }
    let meta;
    try {
      meta = JSON.parse(fs.readFileSync(metaPath, 'utf8'));
    } catch (err) {
      problems.push(`${entry.name}: game.json is not valid JSON (${err.message})`);
      continue;
    }
    meta.id = entry.name; // folder name is the source of truth
    const warn = (msg) => problems.push(`${entry.name}: ${msg}`);
    if (!meta.title) warn('missing "title"');
    if (!GENRES.includes(meta.genre)) warn(`"genre" should be one of ${GENRES.join(', ')}`);
    if (!LENGTHS.includes(meta.length)) warn(`"length" should be one of ${LENGTHS.join(', ')}`);
    if (meta.status && !STATUSES.includes(meta.status)) warn(`"status" should be one of ${STATUSES.join(', ')}`);
    meta.title ||= entry.name;
    meta.players ||= '1';
    meta.status ||= 'playable';
    meta.tags ||= [];
    games.push(meta);
  }
  games.sort((a, b) => a.title.localeCompare(b.title));
  return { games, problems };
}

export function build({ icons = false, quiet = false } = {}) {
  const log = quiet ? () => {} : console.log;

  writeIcons(path.join(ROOT, 'icons'), { force: icons });

  const { games, problems } = loadGames();
  for (const p of problems) console.warn('  ⚠', p);

  // Hash every cached file (except the registry, which embeds the hash).
  const registryPath = path.join(ROOT, 'games', 'registry.json');
  const files = walk(ROOT).filter((f) => f !== registryPath).sort();
  const hash = crypto.createHash('sha256');
  hash.update(JSON.stringify(games));
  for (const f of files) {
    hash.update(rel(f));
    hash.update(fs.readFileSync(f));
  }
  const version = hash.digest('hex').slice(0, 12);

  const registry = { version, builtAt: new Date().toISOString(), games };
  fs.writeFileSync(registryPath, JSON.stringify(registry, null, 2) + '\n');

  const assets = ['./', ...[...files, registryPath].map((f) => './' + rel(f)).sort()];
  const sw = fs.readFileSync(path.join(ROOT, 'scripts', 'sw.template.js'), 'utf8')
    .replace('__VERSION__', version)
    .replace('__ASSETS__', JSON.stringify(assets, null, 2));
  fs.writeFileSync(path.join(ROOT, 'sw.js'), sw);

  log(`Built v${version}: ${games.length} game(s), ${assets.length} cached files.`);
  return { version, games, problems };
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { problems } = build({ icons: process.argv.includes('--icons') });
  if (problems.length && process.argv.includes('--strict')) process.exit(1);
}
