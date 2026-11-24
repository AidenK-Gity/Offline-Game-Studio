// Orbit Hop — one-tap arcade.
// You ride the surface of a spinning planet. Tap to launch straight out along your
// current angle. Hit another planet to land on it. Each planet's orbit decays: when the
// ring runs out you are flung off automatically. Perfect (dead-center) landings build a
// combo; skipping over planets scores every planet you skipped.

const W = 360; // virtual world width — everything scales to the screen width
const PR = 7; // player radius
const SPEED = 560; // launch speed (units/s)

export function start(ctx) {
  const { audio, save, input } = ctx;

  let rand; // seeded rng — its state lives in the run so a resumed run continues identically
  let s; // run state (plain JSON — this is what gets saved)
  let best = 0;
  let scale = 1;
  let viewH = 640;
  let particles = [];
  let trail = [];
  let shake = 0;
  let popups = [];
  let overShown = false;

  save.get('best').then((b) => { best = b || 0; });

  const bgStars = Array.from({ length: 90 }, (_, i) => {
    const h = (n) => ((Math.sin(i * 127.1 + n * 311.7) * 43758.5453) % 1 + 1) % 1;
    return { x: h(1), y: h(2), z: 0.05 + h(3) * 0.35, s: 0.5 + h(4) * 1.4 };
  });

  let offX = 0; // centers the play column on wide screens (tablets, desktop)
  function resize() {
    scale = Math.min(ctx.width / W, ctx.height / 560);
    offX = (ctx.width - W * scale) / 2;
    viewH = ctx.height / scale;
  }

  // ---------- run setup ----------

  function newRun() {
    rand = ctx.rng.createRng();
    s = {
      v: 1,
      rngState: 0,
      t: 0,
      score: 0,
      combo: 0,
      ready: false, // fuse doesn't tick until the first launch
      over: false,
      fuse: 5,
      fuseMax: 5,
      planets: [{ x0: W / 2, x: W / 2, y: 0, r: 50, spin: 1.3, amp: 0, w: 1, ph: 0, hue: 200, ring: true }],
      stars: [],
      player: { mode: 'orbit', p: 0, a: -Math.PI / 2, x: 0, y: 0, vx: 0, vy: 0, from: 0 },
      camY: 0,
    };
    s.camY = -viewH * 0.68;
    while (s.planets.length < 8) addPlanet();
    particles = [];
    trail = [];
    popups = [];
    overShown = false;
  }

  function restore(saved) {
    if (!saved || saved.v !== 1 || saved.over) return false;
    s = saved;
    rand = ctx.rng.createRng(0);
    rand.state = s.rngState;
    s.ready = false;
    return true;
  }

  function addPlanet() {
    const prev = s.planets[s.planets.length - 1];
    const lvl = s.planets.length;
    const d = Math.min(1, lvl / 45); // difficulty 0..1
    const r = rand.range(36 - d * 12, 48 - d * 14);
    const gap = rand.range(150, 195) + d * 70;
    const margin = r + 22;
    const x0 = rand.range(margin, W - margin);
    const dir = rand.chance(0.5) ? 1 : -1;
    const spin = dir * rand.range(1.2, 1.8) * (1 + d * 0.8);
    const moving = lvl > 7 && rand.chance(0.2 + d * 0.4);
    const maxAmp = Math.min(x0 - r - 6, W - x0 - r - 6);
    const p = {
      x0,
      x: x0,
      y: prev.y - gap,
      r,
      spin,
      amp: moving ? Math.max(0, Math.min(maxAmp, rand.range(30, 90))) : 0,
      w: rand.range(0.7, 1.5),
      ph: rand.range(0, Math.PI * 2),
      hue: rand.int(0, 359),
      ring: rand.chance(0.25),
    };
    s.planets.push(p);
    if (lvl > 2 && rand.chance(0.45)) {
      s.stars.push({ x: (prev.x0 + x0) / 2 + rand.range(-30, 30), y: (prev.y + p.y) / 2, got: false });
    }
  }

  function fuseFor(score) {
    return Math.max(2.1, 4.6 - score * 0.045);
  }

  // ---------- actions ----------

  function launch() {
    const pl = s.player;
    if (s.over || pl.mode !== 'orbit') return;
    pl.mode = 'fly';
    pl.from = pl.p;
    pl.vx = Math.cos(pl.a) * SPEED;
    pl.vy = Math.sin(pl.a) * SPEED;
    s.ready = true;
    audio.sfx('jump');
  }

  function land(i) {
    const pl = s.player;
    const P = s.planets[i];
    // How close to dead-center was the approach? (perpendicular distance of the flight line)
    const ux = pl.vx / SPEED;
    const uy = pl.vy / SPEED;
    const off = Math.abs((P.x - pl.x) * uy - (P.y - pl.y) * ux);
    const perfect = off < P.r * 0.3;

    pl.mode = 'orbit';
    pl.p = i;
    pl.a = Math.atan2(pl.y - P.y, pl.x - P.x);

    const gained = i - pl.from;
    if (gained > 0) {
      let pts = gained;
      if (perfect) {
        s.combo++;
        pts += s.combo;
      } else {
        s.combo = 0;
      }
      s.score += pts;
      popups.push({ x: pl.x, y: pl.y - 16, text: (perfect ? 'PERFECT ' : '') + '+' + pts, life: 1 });
      if (gained > 1) popups.push({ x: pl.x, y: pl.y - 34, text: `SKIP x${gained}`, life: 1.2 });
      audio.sfx(perfect ? 'perfect' : 'land');
    } else {
      audio.sfx('land');
    }
    s.fuseMax = fuseFor(s.score);
    s.fuse = s.fuseMax;
    burst(pl.x, pl.y, `hsl(${P.hue},80%,70%)`, perfect ? 22 : 12);

    // keep planets ahead, drop ones far below
    while (s.planets.length - i < 8) addPlanet();
    const drop = Math.max(0, i - 3);
    if (drop > 0) {
      s.planets.splice(0, drop);
      pl.p -= drop;
      pl.from -= drop;
    }
    s.stars = s.stars.filter((st) => st.y < s.planets[0].y + 200);
  }

  function die() {
    s.over = true;
    shake = 14;
    burst(s.player.x, s.player.y, '#ff6b6b', 30);
    audio.sfx('lose');
    save.clear('run');
    save.get('plays').then((n) => save.set('plays', (n || 0) + 1));
    const final = s.score;
    save.best('best', final).then((b) => {
      const isNew = final > 0 && final >= b && final > best;
      best = b;
      setTimeout(() => {
        if (overShown) return;
        overShown = true;
        ctx.gameOver({
          title: isNew ? 'New best!' : 'Lost in space',
          lines: [`Score: ${final}`, `Best: ${b}`],
          onRetry: newRun,
        });
      }, 700);
    });
  }

  function burst(x, y, color, n) {
    for (let k = 0; k < n; k++) {
      const a = Math.random() * Math.PI * 2;
      const sp = 40 + Math.random() * 160;
      particles.push({ x, y, vx: Math.cos(a) * sp, vy: Math.sin(a) * sp, life: 0.5 + Math.random() * 0.5, color });
    }
  }

  input.on('down', launch);

  // ---------- simulation ----------

  function update(dt) {
    for (const p of particles) {
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
      p.life -= dt;
    }
    particles = particles.filter((p) => p.life > 0);
    for (const p of popups) { p.life -= dt; p.y -= 30 * dt; }
    popups = popups.filter((p) => p.life > 0);
    shake = Math.max(0, shake - dt * 40);
    if (s.over) return;

    s.t += dt;
    for (const P of s.planets) P.x = P.x0 + P.amp * Math.sin(s.t * P.w + P.ph);

    const pl = s.player;
    if (pl.mode === 'orbit') {
      const P = s.planets[pl.p];
      pl.a += P.spin * dt;
      pl.x = P.x + Math.cos(pl.a) * (P.r + PR);
      pl.y = P.y + Math.sin(pl.a) * (P.r + PR);
      if (s.ready) {
        s.fuse -= dt;
        if (s.fuse <= 0) {
          popups.push({ x: pl.x, y: pl.y - 20, text: 'ORBIT DECAYED', life: 1 });
          launch();
        }
      }
      const target = P.y - viewH * 0.68;
      s.camY += (target - s.camY) * Math.min(1, dt * 3);
    } else {
      pl.x += pl.vx * dt;
      pl.y += pl.vy * dt;
      trail.push({ x: pl.x, y: pl.y });
      if (trail.length > 18) trail.shift();

      for (let i = 0; i < s.planets.length; i++) {
        if (i === pl.from) continue;
        const P = s.planets[i];
        if (Math.hypot(pl.x - P.x, pl.y - P.y) < P.r + PR) {
          land(i);
          trail = [];
          break;
        }
      }
      for (const st of s.stars) {
        if (!st.got && Math.hypot(pl.x - st.x, pl.y - st.y) < 20) {
          st.got = true;
          s.score += 2;
          popups.push({ x: st.x, y: st.y, text: '+2', life: 0.8 });
          audio.sfx('coin');
        }
      }
      if (pl.mode === 'fly' &&
        (pl.x < -20 || pl.x > W + 20 || pl.y > s.camY + viewH + 30 || pl.y < s.camY - 260)) {
        die();
      }
    }
  }

  // ---------- rendering ----------

  function draw(g) {
    const w = ctx.width;
    const h = ctx.height;
    const bg = g.createLinearGradient(0, 0, 0, h);
    bg.addColorStop(0, '#0b0d2a');
    bg.addColorStop(1, '#1a0f33');
    g.fillStyle = bg;
    g.fillRect(0, 0, w, h);

    // parallax starfield
    g.fillStyle = '#ffffff';
    for (const st of bgStars) {
      const y = (((st.y * viewH - s.camY * st.z) % viewH) + viewH) % viewH;
      g.globalAlpha = 0.25 + st.z * 1.5;
      g.fillRect(st.x * w, y * scale, st.s, st.s);
    }
    g.globalAlpha = 1;

    g.save();
    if (shake > 0) g.translate((Math.random() - 0.5) * shake, (Math.random() - 0.5) * shake);
    g.translate(offX, 0);
    g.scale(scale, scale);
    g.translate(0, -s.camY);

    const pl = s.player;

    // tutorial aim line for the first few hops
    if (pl.mode === 'orbit' && s.score < 3 && !s.over) {
      g.strokeStyle = 'rgba(255,255,255,0.35)';
      g.setLineDash([4, 8]);
      g.lineWidth = 2;
      g.beginPath();
      g.moveTo(pl.x, pl.y);
      g.lineTo(pl.x + Math.cos(pl.a) * 170, pl.y + Math.sin(pl.a) * 170);
      g.stroke();
      g.setLineDash([]);
    }

    // planets
    s.planets.forEach((P, i) => {
      if (P.y - P.r > s.camY + viewH + 40 || P.y + P.r < s.camY - 40) return;
      if (P.ring) drawRing(g, P, true);
      const grad = g.createRadialGradient(P.x - P.r * 0.35, P.y - P.r * 0.35, P.r * 0.1, P.x, P.y, P.r);
      grad.addColorStop(0, `hsl(${P.hue},75%,68%)`);
      grad.addColorStop(1, `hsl(${P.hue},60%,28%)`);
      g.fillStyle = grad;
      g.beginPath();
      g.arc(P.x, P.y, P.r, 0, Math.PI * 2);
      g.fill();
      // surface marks show the spin
      g.strokeStyle = `hsla(${P.hue},60%,85%,0.35)`;
      g.lineWidth = 3;
      const spinA = P.spin * s.t;
      for (let k = 0; k < 3; k++) {
        const a = spinA + (k * Math.PI * 2) / 3;
        g.beginPath();
        g.arc(P.x, P.y, P.r * 0.62, a, a + 0.6);
        g.stroke();
      }
      if (P.ring) drawRing(g, P, false);

      // decay ring on the current planet
      if (i === pl.p && pl.mode === 'orbit' && !s.over) {
        const f = s.fuse / s.fuseMax;
        g.strokeStyle = f > 0.35 ? 'rgba(120,255,200,0.8)' : 'rgba(255,110,110,0.9)';
        g.lineWidth = 3;
        g.beginPath();
        g.arc(P.x, P.y, P.r + PR * 2 + 6, -Math.PI / 2, -Math.PI / 2 + Math.PI * 2 * f);
        g.stroke();
      }
    });

    // collectible stars
    for (const st of s.stars) {
      if (st.got) continue;
      drawStar(g, st.x, st.y, 8 + Math.sin(s.t * 5) * 1.5);
    }

    // trail + player
    for (let k = 0; k < trail.length; k++) {
      g.fillStyle = `rgba(150,230,255,${(k / trail.length) * 0.5})`;
      g.beginPath();
      g.arc(trail[k].x, trail[k].y, PR * (k / trail.length), 0, Math.PI * 2);
      g.fill();
    }
    if (!s.over) {
      g.shadowColor = '#9ef';
      g.shadowBlur = 14;
      g.fillStyle = '#eaffff';
      g.beginPath();
      g.arc(pl.x, pl.y, PR, 0, Math.PI * 2);
      g.fill();
      g.shadowBlur = 0;
    }

    for (const p of particles) {
      g.globalAlpha = Math.max(0, p.life);
      g.fillStyle = p.color;
      g.fillRect(p.x - 2, p.y - 2, 4, 4);
    }
    g.globalAlpha = 1;

    g.textAlign = 'center';
    g.font = 'bold 14px system-ui, sans-serif';
    for (const p of popups) {
      g.globalAlpha = Math.min(1, p.life * 2);
      g.fillStyle = '#fff6b0';
      g.fillText(p.text, p.x, p.y);
    }
    g.globalAlpha = 1;
    g.restore();

    // HUD
    const top = ctx.insets.top + 14;
    g.textAlign = 'center';
    g.fillStyle = '#fff';
    g.font = 'bold 40px system-ui, sans-serif';
    g.fillText(String(s.score), w / 2, top + 36);
    g.font = '13px system-ui, sans-serif';
    g.fillStyle = 'rgba(255,255,255,0.6)';
    g.fillText(`BEST ${Math.max(best, s.score)}`, w / 2, top + 56);
    if (s.combo > 1) {
      g.fillStyle = '#ffd43b';
      g.font = 'bold 15px system-ui, sans-serif';
      g.fillText(`COMBO x${s.combo}`, w / 2, top + 78);
    }
    if (!s.ready && !s.over) {
      g.fillStyle = 'rgba(255,255,255,0.85)';
      g.font = 'bold 18px system-ui, sans-serif';
      g.fillText(s.score > 0 ? 'Tap to continue' : 'Tap to launch', w / 2, h - ctx.insets.bottom - 40);
    }
  }

  function drawRing(g, P, back) {
    g.save();
    g.strokeStyle = `hsla(${(P.hue + 40) % 360},70%,75%,0.7)`;
    g.lineWidth = 4;
    g.beginPath();
    g.ellipse(P.x, P.y, P.r * 1.6, P.r * 0.45, -0.35, back ? Math.PI : 0, back ? Math.PI * 2 : Math.PI);
    g.stroke();
    g.restore();
  }

  function drawStar(g, x, y, r) {
    g.fillStyle = '#ffd43b';
    g.beginPath();
    for (let k = 0; k < 10; k++) {
      const a = -Math.PI / 2 + (k * Math.PI) / 5;
      const rr = k % 2 ? r * 0.45 : r;
      g.lineTo(x + Math.cos(a) * rr, y + Math.sin(a) * rr);
    }
    g.closePath();
    g.fill();
  }

  // ---------- boot ----------

  resize();
  if (!restore(ctx.resume)) newRun();
  else ctx.ui.toast('Run restored');

  return {
    update,
    draw,
    resize,
    restart: newRun,
    snapshot() {
      if (!s || s.over || s.score === 0) return null;
      s.rngState = rand.state;
      return s;
    },
  };
}
