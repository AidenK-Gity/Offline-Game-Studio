# Offline Game Studio

An arcade of small, original games that installs on an iPhone (or any phone) and runs with **no internet**.
It is plain HTML/JS with zero dependencies. The service worker caches every file on first visit, and saves live on the device.

## Run it locally

```sh
node scripts/serve.mjs          # builds, then serves http://localhost:8080
```

- On `localhost` the service worker is **off**, so code edits show on reload.
- Add `?sw=1` to test offline mode (e.g. `http://localhost:8080/?sw=1`), then stop the server and reload.
- Use Chrome DevTools device mode (iPhone) to check touch and layout.

## Put it on your iPhone

iOS needs HTTPS for offline web apps, so the repo deploys to GitHub Pages:

1. In GitHub, go to **Settings → Pages → Source: GitHub Actions** (one time).
2. Push to `main`. The workflow in `.github/workflows/pages.yml` builds and deploys the site.
3. On the iPhone, open `https://<user>.github.io/Offline-Game-Studio/` in **Safari**.
4. Tap **Share → Add to Home Screen**.
5. Launch it from the icon. It now works in airplane mode.

Updates: push again. The next time the app opens with a connection, it shows an **Update** banner.

## How it's organized

```
index.html, styles.css, manifest.webmanifest
launcher/      home screen, idea board, settings
engine/        shared game toolkit (loop, input, saves, sound, rng, dialogs, shell)
games/<id>/    one folder per game: game.json + main.js
ideas/         ideas.json — the roadmap shown in the Ideas tab
scripts/       build, dev server, new-game scaffold, icon generator
```

The build generates `games/registry.json` and `sw.js`. Both are gitignored.

### game.json

```json
{
  "title": "Orbit Hop",
  "icon": "🪐",
  "genre": "arcade",          // arcade | puzzle | roguelite | party | roguelike
  "length": "quick",          // quick (<2 min) | session (5–15) | long (multi-sitting)
  "players": "1",             // "1", "2", "2-4" …
  "status": "playable",       // prototype | building | playable | polished
  "tags": ["one-tap"],
  "description": "…",
  "added": "2026-11-24"
}
```

The launcher builds its filters (genre, length, 2+ players, search), its **Continue** and **Favorites** shelves, and its sort order from these fields.
To add a new genre, edit `launcher/meta.js` and the `GENRES` list in `scripts/build.mjs`.

## Making a game

```sh
node scripts/new-game.mjs pipe-bloom --title "Pipe Bloom" --genre puzzle --length session --icon 🌸
```

`games/<id>/main.js` exports `start(ctx)` and returns the game:

```js
export function start(ctx) {
  // ctx.width / ctx.height   CSS pixels; ctx.insets = iPhone safe-area {top, bottom, …}
  // ctx.input.on('down'|'up'|'move'|'tap'|'swipe'|'key', fn)
  // ctx.audio.sfx('jump'|'land'|'coin'|'perfect'|'hit'|'lose'|'win'|'pop'|'click'|'error')
  // ctx.save.get/set/clear(key), ctx.save.best(key, value), ctx.save.checkpoint()
  // ctx.rng.createRng(seed), ctx.rng.dailySeed('my-game'), ctx.rng.todayKey()
  // ctx.ui.show({title, lines, buttons}), ctx.ui.toast(text), ctx.gameOver({lines, onRetry})
  // ctx.resume — the saved run from last time (or null)
  return {
    update(dt) {},          // fixed 120 Hz steps
    draw(g) {},             // g = CanvasRenderingContext2D in CSS pixels
    snapshot() {},          // return run state (plain JSON) to save it, or null if nothing to resume
    restart() {},           // optional: new run without reloading the module
    resize(w, h) {},        // optional
    destroy() {},           // optional
  };
}
```

**Saving is automatic.** The shell calls `snapshot()` in these cases:
- when the game is paused,
- when the app goes to the background (iOS can kill backgrounded apps without warning),
- when the player exits,
- every 5 seconds.

Turn-based games should also call `ctx.save.checkpoint()` after every turn.
Keep the run state as plain JSON, and store the RNG state (`rng.state`) in it, so a resumed run continues exactly where it left off.

Back up saves from **Settings → Back up saves**. iOS can clear web storage, so keep a backup file in iCloud Drive or Files.

## Roadmap

See the Ideas tab or `ideas/ideas.json`. Next up: Pipe Bloom, Dice Delve, Hex Claim, then the long roguelikes Deep Delve and Drift Fleet.
