// __TITLE__ — starter template. Tap the target before it shrinks away.
// Shows the full game contract: update/draw, input, sound, best score, and save/resume.

export function start(ctx) {
  const { input, audio, save } = ctx;
  let s; // run state — keep it plain JSON so it can be saved
  let best = 0;
  save.get('best').then((b) => { best = b || 0; });

  function newRun() {
    s = { score: 0, lives: 3, target: spawn(), over: false };
  }

  function spawn() {
    return { x: 0.15 + Math.random() * 0.7, y: 0.25 + Math.random() * 0.6, r: 1 };
  }

  input.on('down', ({ x, y }) => {
    if (s.over) return;
    const t = s.target;
    const R = 50 * t.r;
    if (Math.hypot(x - t.x * ctx.width, y - t.y * ctx.height) < R + 10) {
      s.score++;
      audio.sfx('pop');
      s.target = spawn();
    } else {
      audio.sfx('error');
    }
  });

  function update(dt) {
    if (s.over) return;
    s.target.r -= dt * (0.4 + s.score * 0.02);
    if (s.target.r <= 0) {
      s.lives--;
      audio.sfx('hit');
      s.target = spawn();
      if (s.lives <= 0) {
        s.over = true;
        audio.sfx('lose');
        save.best('best', s.score).then((b) => {
          best = b;
          ctx.gameOver({ lines: [`Score: ${s.score}`, `Best: ${b}`], onRetry: newRun });
        });
      }
    }
  }

  function draw(g) {
    g.fillStyle = '#101228';
    g.fillRect(0, 0, ctx.width, ctx.height);
    const t = s.target;
    g.fillStyle = '#7c8cff';
    g.beginPath();
    g.arc(t.x * ctx.width, t.y * ctx.height, Math.max(0, 50 * t.r), 0, Math.PI * 2);
    g.fill();
    g.fillStyle = '#fff';
    g.textAlign = 'center';
    g.font = 'bold 32px system-ui, sans-serif';
    g.fillText(String(s.score), ctx.width / 2, ctx.insets.top + 50);
    g.font = '14px system-ui, sans-serif';
    g.fillText(`${'♥'.repeat(Math.max(0, s.lives))}   best ${best}`, ctx.width / 2, ctx.insets.top + 74);
  }

  // Resume a saved run if there is one.
  if (ctx.resume && !ctx.resume.over) s = ctx.resume;
  else newRun();

  return {
    update,
    draw,
    restart: newRun,
    // Return null when there's nothing worth resuming.
    snapshot: () => (s.over || s.score === 0 ? null : s),
  };
}
