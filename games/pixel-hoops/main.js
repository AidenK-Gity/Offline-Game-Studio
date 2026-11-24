// Pixel Hoops — 3-on-3 half-court pixel basketball.
//
// OFFENSE (you control whoever has the ball)
//   Tap the court        -> run there
//   Drag back & release  -> slingshot pass (aim line shows where it lands; red = risky lane)
//   Hold SHOOT, release  -> timing meter; release inside the green window to score
// DEFENSE (you control the defender guarding the ball)
//   Tap the court        -> move there
//   Tap the ball handler -> steal attempt (best while the ball is low on the dribble)
//   JUMP                 -> block (jump just after the shooter rises)
//   Stand in a passing lane to intercept.
// First to 21. Season mode: 8 opponents, then the Finals if you win 5+. Wins earn upgrade points.

const W = 160; // low-res buffer width; everything is drawn at this size then scaled up crisp
const COURT_H = 194;
const BASE_Y = 14; // baseline
const HOOP = { x: 80, y: 26 }; // hoop position on the floor
const RIM_Z = 12; // rim height
const THREE_R = 62;
const WIN_SCORE = 21;
const SHOT_CLOCK = 14;
const GREEN_AT = 0.78; // where the sweet spot sits on the meter (0..1)
const METER_TIME = 0.9; // seconds for the meter to fill
const BOUNDS = { x0: 9, x1: 151, y0: 18, y1: 188 };

const HOME = { name: 'You', short: 'YOU', c1: '#2f6fed', c2: '#163a8a' };
const TEAMS = [
  { name: 'Dune Cats', short: 'DUN', c1: '#e8a33d', c2: '#7a4a12' },
  { name: 'Harbor Owls', short: 'OWL', c1: '#1fd1a5', c2: '#0c5a47' },
  { name: 'Neon Knights', short: 'NEO', c1: '#d23de8', c2: '#5a127a' },
  { name: 'Iron Pelicans', short: 'PEL', c1: '#9aa3ad', c2: '#3b4148' },
  { name: 'Lava Toads', short: 'TOA', c1: '#ff5a36', c2: '#6b1a0c' },
  { name: 'Frost Giants', short: 'FRO', c1: '#d8f3ff', c2: '#3a6b85' },
  { name: 'Metro Foxes', short: 'FOX', c1: '#ff9f1c', c2: '#2b2d42' },
  { name: 'Storm Rays', short: 'RAY', c1: '#ffe14d', c2: '#5b2a8f' },
];
const FINALS = { name: 'Gold Crowns', short: 'GLD', c1: '#ffd700', c2: '#4a3b00' };

const SKINS = ['#f1c27d', '#e0ac69', '#c68642', '#8d5524', '#5a3825'];
const HAIRS = ['#1a1a1a', '#3b2314', '#6b4423', '#d8b25a', '#2a2a2a', '#a33b20'];
const SPOTS = [[18, 22], [142, 22], [24, 60], [136, 60], [80, 92], [48, 44], [112, 44], [60, 110], [100, 110], [80, 70], [40, 128], [120, 128]];

// 3x5 pixel font: each glyph is 5 rows of 3 bits (4 = left, 2 = middle, 1 = right)
const FONT = {
  A: [2, 5, 7, 5, 5], B: [6, 5, 6, 5, 6], C: [3, 4, 4, 4, 3], D: [6, 5, 5, 5, 6], E: [7, 4, 6, 4, 7],
  F: [7, 4, 6, 4, 4], G: [3, 4, 5, 5, 3], H: [5, 5, 7, 5, 5], I: [7, 2, 2, 2, 7], J: [1, 1, 1, 5, 2],
  K: [5, 5, 6, 5, 5], L: [4, 4, 4, 4, 7], M: [5, 7, 7, 5, 5], N: [6, 5, 5, 5, 5], O: [2, 5, 5, 5, 2],
  P: [6, 5, 6, 4, 4], Q: [2, 5, 5, 6, 3], R: [6, 5, 6, 5, 5], S: [3, 4, 2, 1, 6], T: [7, 2, 2, 2, 2],
  U: [5, 5, 5, 5, 7], V: [5, 5, 5, 5, 2], W: [5, 5, 7, 7, 5], X: [5, 5, 2, 5, 5], Y: [5, 5, 2, 2, 2],
  Z: [7, 1, 2, 4, 7], 0: [7, 5, 5, 5, 7], 1: [2, 6, 2, 2, 7], 2: [6, 1, 2, 4, 7], 3: [6, 1, 2, 1, 6],
  4: [5, 5, 7, 1, 1], 5: [7, 4, 6, 1, 6], 6: [3, 4, 7, 5, 7], 7: [7, 1, 1, 2, 2], 8: [7, 5, 7, 5, 7],
  9: [7, 5, 7, 1, 6], ':': [0, 2, 0, 2, 0], '-': [0, 0, 7, 0, 0], '!': [2, 2, 2, 0, 2], '?': [6, 1, 2, 0, 2],
  '.': [0, 0, 0, 0, 2], '+': [0, 2, 7, 2, 0], '/': [1, 1, 2, 4, 4], "'": [2, 2, 0, 0, 0], ' ': [0, 0, 0, 0, 0],
};

const dist = (a, b) => Math.hypot(a.x - b.x, a.y - b.y);
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const rand = (lo, hi) => lo + Math.random() * (hi - lo);
const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
const isThree = (p) => Math.hypot(p.x - HOOP.x, p.y - HOOP.y) > THREE_R || (p.y < 42 && (p.x < 20 || p.x > 140));

export function start(ctx) {
  const { input, audio, save, ui } = ctx;
  const buf = document.createElement('canvas');
  const b = buf.getContext('2d');

  let H = 300;
  let scale = 1;
  let offX = 0;
  let offY = 0;
  let hudY = 4;
  let cy0 = 20;
  let ctrlTop = 220;
  let ctrlBot = 296;
  let ctrlMid = 258;
  let courtImg = null;
  let season = null;
  let G = null; // current game
  let drag = null; // active court drag
  let shootPtr = null; // pointer holding the action button
  let time = 0;

  // ---------------------------------------------------------------- layout

  function resize() {
    scale = ctx.width / W;
    H = Math.floor(ctx.height / scale);
    if (H < 290) {
      H = 290;
      scale = ctx.height / H;
    }
    offX = Math.round((ctx.width - W * scale) / 2);
    offY = Math.round((ctx.height - H * scale) / 2);
    buf.width = W;
    buf.height = H;
    const topI = Math.ceil(ctx.insets.top / scale);
    const botI = Math.ceil(ctx.insets.bottom / scale);
    hudY = topI + 3;
    cy0 = hudY + 15;
    ctrlTop = cy0 + COURT_H + 2;
    ctrlBot = H - botI - 2;
    ctrlMid = Math.round((ctrlTop + ctrlBot) / 2);
    courtImg ||= renderCourt();
  }

  const btn = () => ({ x: W - 28, y: ctrlMid, r: 19 });

  // ---------------------------------------------------------------- season

  function freshSeason() {
    return { v: 1, season: 1, week: 0, wins: 0, losses: 0, finals: false, titles: 0, pts: 0, stats: { shoot: 1, speed: 1, defense: 1 } };
  }

  function ratingFor(S) {
    return Math.min(10, 1 + S.week * 0.55 + (S.season - 1) * 1.3 + (S.finals ? 1 : 0));
  }

  const stats = () => season?.stats || { shoot: 1, speed: 1, defense: 1 };

  function recordResult(won) {
    const S = season;
    const lines = [];
    if (G.finals) {
      if (won) {
        S.titles++;
        lines.push(`Season ${S.season} champions! Titles: ${S.titles}`);
      } else {
        lines.push('So close. The Gold Crowns take the title.');
      }
      S.pts += won ? 4 : 2;
      newSeason(S);
      lines.push(`Season ${S.season} starts — opponents get tougher.`);
      return lines;
    }
    if (won) S.wins++;
    else S.losses++;
    S.pts += won ? 2 : 1;
    S.week++;
    lines.push(`Record ${S.wins}-${S.losses} · +${won ? 2 : 1} upgrade pts`);
    if (S.week >= TEAMS.length) {
      if (S.wins >= 5) {
        S.finals = true;
        lines.push('You made the Finals!');
      } else {
        lines.push('Missed the Finals (need 5 wins).');
        newSeason(S);
        lines.push(`Season ${S.season} starts.`);
      }
    }
    return lines;
  }

  function newSeason(S) {
    S.season++;
    S.week = 0;
    S.wins = 0;
    S.losses = 0;
    S.finals = false;
  }

  const persistSeason = () => save.set('season', season);

  // ---------------------------------------------------------------- menus

  function mainMenu() {
    const S = season;
    const opp = S.finals ? FINALS : TEAMS[S.week];
    ui.show({
      title: 'Pixel Hoops',
      lines: [
        `Season ${S.season} · ${S.finals ? 'FINALS' : `Week ${S.week + 1} of ${TEAMS.length}`}`,
        `Record ${S.wins}-${S.losses} · Titles ${S.titles}`,
        `Next: ${opp.name} (difficulty ${ratingFor(S).toFixed(1)})`,
      ],
      buttons: [
        {
          label: S.finals ? 'Play the Finals' : `Play week ${S.week + 1}`,
          primary: true,
          onClick: () => newGame({ oppIdx: S.week, rating: ratingFor(S), quick: false, finals: S.finals }),
        },
        { label: `Upgrades (${S.pts} pts)`, onClick: upgradesMenu },
        { label: 'Quick game', onClick: () => newGame({ oppIdx: Math.floor(Math.random() * TEAMS.length), rating: 3, quick: true, finals: false }) },
        { label: 'How to play', onClick: howTo },
        { label: 'Exit', onClick: () => ctx.exit() },
      ],
    });
  }

  function upgradesMenu() {
    const S = season;
    const st = S.stats;
    const bar = (n) => '■'.repeat(n) + '□'.repeat(5 - n);
    const NAMES = { shoot: 'Shooting', speed: 'Speed', defense: 'Defense' };
    ui.show({
      title: 'Upgrades',
      lines: [
        `Points: ${S.pts}`,
        `Shooting ${bar(st.shoot)} — bigger green window`,
        `Speed ${bar(st.speed)} — faster players`,
        `Defense ${bar(st.defense)} — steals, blocks, interceptions`,
        'Win = 2 pts · Loss = 1 pt · Finals = 4',
      ],
      buttons: [
        ...Object.keys(NAMES).map((k) => ({
          label: st[k] >= 5 ? `${NAMES[k]} maxed` : `+ ${NAMES[k]} (${st[k]} pt${st[k] > 1 ? 's' : ''})`,
          onClick() {
            if (st[k] >= 5) ui.toast('Already maxed');
            else if (S.pts < st[k]) ui.toast('Not enough points');
            else {
              S.pts -= st[k];
              st[k]++;
              persistSeason();
              audio.sfx('coin');
            }
            upgradesMenu();
          },
        })),
        { label: 'Back', onClick: mainMenu },
      ],
    });
  }

  function howTo() {
    ui.show({
      title: 'How to play',
      lines: [
        'OFFENSE — tap the court to run. Drag backwards and release to pass (like a slingshot). A red aim line means a defender is in the lane.',
        'SHOOT — hold the button, release when the marker is in the green. Bright green = perfect. Defenders close by shrink the window and can block late releases.',
        'DEFENSE — tap to move. Tap the ball handler to steal: it works best when the ball is low on the dribble. Missing makes you stumble.',
        'BLOCK — press JUMP just after the shooter rises. Stand in passing lanes to intercept.',
        'First to 21. Beyond the arc = 3 points.',
      ],
      buttons: [{ label: 'Got it', primary: true, onClick: mainMenu }],
    });
  }

  function reportResult() {
    const won = G.score[0] > G.score[1];
    const lines = [`${G.score[0]} – ${G.score[1]} vs ${G.opp.name}`];
    if (!G.quick) {
      lines.push(...recordResult(won));
      persistSeason();
    }
    save.get('career').then((c) => {
      c ||= { wins: 0, losses: 0 };
      if (won) c.wins++;
      else c.losses++;
      save.set('career', c);
    });
    const opts = { oppIdx: G.oppIdx, rating: G.rating, quick: G.quick, finals: false };
    ui.show({
      title: won ? (G.finals ? 'CHAMPIONS!' : 'Victory!') : 'Defeat',
      lines,
      buttons: G.quick
        ? [{ label: 'Rematch', primary: true, onClick: () => newGame(opts) }, { label: 'Menu', onClick: () => { G = null; mainMenu(); } }]
        : [{ label: 'Continue', primary: true, onClick: () => { G = null; mainMenu(); } }],
    });
  }

  // ---------------------------------------------------------------- game setup

  function makePlayer(team, k) {
    return {
      i: team * 3 + k, team, x: 80, y: 150, tx: 80, ty: 150, z: 0,
      jumpT: -1, jumpDelay: 0, fall: false, anim: 0, moving: false, stun: 0, spotT: 0,
      skin: pick(SKINS), hair: pick(HAIRS),
    };
  }

  function newGame({ oppIdx, rating, quick, finals, score = [0, 0], poss = 0 }) {
    ui.hide();
    G = {
      opp: finals ? FINALS : TEAMS[oppIdx] || TEAMS[0],
      oppIdx, rating, quick: !!quick, finals: !!finals,
      score: [...score],
      poss,
      phase: 'check',
      timer: 1,
      players: [0, 1, 2].map((k) => makePlayer(0, k)).concat([0, 1, 2].map((k) => makePlayer(1, k))),
      ball: null,
      ctrl: 0,
      ctrlIdle: 0,
      shotClock: SHOT_CLOCK,
      msg: null,
      shot: null,
      cpuShot: null,
      lastShot: null,
      cpuT: 1,
      grace: 0,
      tapMark: null,
      aim: null,
      net: 0,
      reported: false,
    };
    setupPossession(poss);
  }

  // Stand between your man and the hoop. The small sideways shift keeps both sprites visible.
  function guardSpot(man, d, side = 0) {
    const dx = HOOP.x - man.x;
    const dy = HOOP.y - man.y;
    const len = Math.hypot(dx, dy) || 1;
    const ux = dx / len;
    const uy = dy / len;
    return { x: man.x + ux * d - uy * side, y: man.y + uy * d + ux * side };
  }
  const ON_BALL = 11;

  function place(p, x, y) {
    p.x = p.tx = x;
    p.y = p.ty = y;
    p.z = 0;
    p.jumpT = -1;
    p.jumpDelay = 0;
    p.fall = false;
    p.stun = 0;
  }

  function setupPossession(team) {
    G.poss = team;
    G.phase = 'check';
    G.timer = 1.1;
    G.shotClock = SHOT_CLOCK;
    G.shot = G.cpuShot = G.aim = null;
    G.grace = 1;
    G.cpuT = 0.8;
    drag = null;
    const off = team * 3;
    const def = (1 - team) * 3;
    const spots = [[80, 150], [30, 100], [130, 100]];
    for (let k = 0; k < 3; k++) {
      const P = G.players[off + k];
      place(P, spots[k][0], spots[k][1]);
      P.spotT = rand(0.5, 2);
    }
    for (let k = 0; k < 3; k++) {
      const gs = guardSpot(G.players[off + k], k === 0 ? ON_BALL : 12, k === 0 ? 4 : 0);
      place(G.players[def + k], gs.x, gs.y);
    }
    G.ball = heldBy(off);
    G.ctrl = team === 0 ? 0 : def; // on defense you guard their ball handler
    G.ctrlIdle = 0;
    say(team === 0 ? 'YOUR BALL' : 'DEFENSE!', team === 0 ? '#8fb8ff' : '#ff9c8f', 1.1);
  }

  const heldBy = (i) => ({ mode: 'held', holder: i, x: 0, y: 0, z: 6, dribble: 0, t: 0 });

  function say(text, color = '#ffffff', t = 1) {
    G.msg = { text, color, t };
  }

  // ---------------------------------------------------------------- actions

  function holder() {
    return G.ball.mode === 'held' ? G.players[G.ball.holder] : null;
  }

  function onTap(c) {
    if (!G || G.phase !== 'live') return;
    const bl = G.ball;
    const pt = { x: clamp(c.x, BOUNDS.x0, BOUNDS.x1), y: clamp(c.y, BOUNDS.y0, BOUNDS.y1) };
    if (G.poss === 0) {
      let p = null;
      if (bl.mode === 'held' && !G.shot) p = holder();
      else if (bl.mode === 'pass') p = G.players[bl.receiver];
      if (p && p.team === 0) {
        p.tx = pt.x;
        p.ty = pt.y;
        G.tapMark = { ...pt, t: 0.6 };
      }
    } else {
      const D = G.players[G.ctrl];
      const H = holder();
      G.ctrlIdle = 0;
      if (H && Math.hypot(c.x - H.x, c.y - (H.y - 6)) < 13) {
        trySteal(D, H);
        return;
      }
      D.tx = pt.x;
      D.ty = pt.y;
      G.tapMark = { ...pt, t: 0.6 };
    }
  }

  function trySteal(D, H) {
    if (D.stun > 0) return;
    if (dist(D, H) > 13 + stats().defense) {
      D.tx = H.x;
      D.ty = H.y;
      G.tapMark = { x: H.x, y: H.y, t: 0.6 };
      return;
    }
    const ph = G.ball.dribble % 1;
    const low = ph > 0.32 && ph < 0.68;
    const chance = low ? 0.45 + stats().defense * 0.07 : 0.08 + stats().defense * 0.02;
    if (Math.random() < chance) {
      gainBall(D, 'STEAL!', '#7dff7a');
    } else {
      D.stun = 0.7;
      D.tx = D.x;
      D.ty = D.y;
      say('REACH!', '#ff9c8f', 0.6);
      audio.sfx('error');
    }
  }

  function startJump(p) {
    if (p.jumpT >= 0 || p.z > 0 || p.stun > 0) return;
    p.jumpT = 0;
  }

  function actionDown() {
    if (!G || G.phase !== 'live') return;
    if (G.poss === 0) startShot();
    else {
      G.ctrlIdle = 0;
      startJump(G.players[G.ctrl]);
    }
  }

  function actionUp() {
    if (G?.shot) releaseShot();
  }

  function startShot() {
    const p = holder();
    if (!p || p.team !== 0 || G.shot) return;
    G.shot = { t: 0, p: p.i, info: shotWindow(p) };
    p.tx = p.x;
    p.ty = p.y;
    G.aim = null;
    drag = null;
    const D = G.players[(p.i + 3) % 6];
    if (dist(D, p) < 13 && D.stun <= 0 && Math.random() < 0.25 + G.rating * 0.045) D.jumpDelay = rand(0.12, 0.4);
  }

  function nearestOpponent(p) {
    let best = null;
    let bd = Infinity;
    for (const q of G.players) {
      if (q.team === p.team) continue;
      const d = dist(p, q);
      if (d < bd) { bd = d; best = q; }
    }
    return { q: best, d: bd };
  }

  function shotWindow(p) {
    const d = dist(p, HOOP);
    const three = isThree(p);
    let base = d < 16 ? 0.3 : three ? 0.12 : d < 40 ? 0.19 : 0.15;
    if (d > 95) base = 0.06;
    const dn = nearestOpponent(p).d;
    const contest = dn < 9 ? 0.55 : dn < 16 ? 0.78 : 1;
    return { w: base * contest * (0.85 + 0.07 * stats().shoot), three, d };
  }

  function releaseShot() {
    const S = G.shot;
    G.shot = null;
    const p = G.players[S.p];
    p.fall = true;
    const m = S.t / METER_TIME;
    const info = shotWindow(p);
    const diff = Math.abs(m - GREEN_AT);
    let make;
    let label;
    if (diff <= info.w * 0.25) { make = true; label = info.d < 14 ? 'DUNK!' : info.three ? 'SPLASH!' : 'PERFECT'; }
    else if (diff <= info.w / 2) { make = true; label = 'GOOD'; }
    else if (diff <= info.w) { make = Math.random() < 0.45; label = m < GREEN_AT ? 'EARLY' : 'LATE'; }
    else { make = false; label = m < GREEN_AT ? 'WAY EARLY' : 'WAY LATE'; }
    G.lastShot = { m, w: info.w, t: 1.4 };

    // Did a defender get up in time?
    for (const D of G.players) {
      if (D.team === p.team) continue;
      if (D.z > 7 && dist(D, p) < 12 && Math.random() < 0.65) {
        blocked(p, D);
        return;
      }
    }
    say(label, make ? '#7dff7a' : '#ffd36b', 0.8);
    launchShot(p, make, info.three ? 3 : 2);
  }

  function blocked(shooter, D) {
    say('BLOCKED!', D.team === 0 ? '#7dff7a' : '#ff9c8f', 0.9);
    audio.sfx('hit');
    const ang = Math.atan2(shooter.y - HOOP.y, shooter.x - HOOP.x) + rand(-0.6, 0.6);
    const r = rand(18, 34);
    looseFlight(shooter.x, shooter.y, shooter.z + 14, shooter.x + Math.cos(ang) * r, shooter.y + Math.sin(ang) * r, 0.55, 10, false);
  }

  function launchShot(p, make, points) {
    const d = dist(p, HOOP);
    audio.sfx('jump');
    G.ball = {
      mode: 'shot', make, points, team: p.team,
      sx: p.x, sy: p.y, sz: p.z + 15,
      ex: HOOP.x + (make ? 0 : rand(-3, 3)), ey: HOOP.y, ez: RIM_Z + 2,
      t: 0, dur: 0.55 + d / 220, h: 16 + d * 0.22, x: p.x, y: p.y, z: p.z + 15,
    };
  }

  function looseFlight(x, y, z, ex, ey, dur, h, fromShot) {
    G.ball = {
      mode: 'loose', sx: x, sy: y, sz: z,
      ex: clamp(ex, BOUNDS.x0, BOUNDS.x1), ey: clamp(ey, BOUNDS.y0, BOUNDS.y1), ez: 0,
      t: 0, dur, h, x, y, z, fromShot,
    };
  }

  function throwPass(from, tx, ty) {
    const P = G.players[from];
    const mates = G.players.filter((q) => q.team === P.team && q !== P);
    const target = { x: clamp(tx, BOUNDS.x0, BOUNDS.x1), y: clamp(ty, BOUNDS.y0, BOUNDS.y1) };
    const r = mates.reduce((a, q) => (dist(q, target) < dist(a, target) ? q : a));
    const d = dist(P, target);
    G.ball = {
      mode: 'pass', from, receiver: r.i, team: P.team,
      sx: P.x + 3, sy: P.y, sz: 8, ex: target.x, ey: target.y, ez: 8,
      t: 0, dur: 0.12 + d / 150, h: 4 + d * 0.1, x: P.x, y: P.y, z: 8, tried: [],
    };
    r.tx = target.x;
    r.ty = target.y;
    audio.tone({ freq: 500, to: 700, dur: 0.06, type: 'triangle', vol: 0.12 });
  }

  function gainBall(p, label, color) {
    const wasShot = G.ball.fromShot;
    G.ball = heldBy(p.i);
    p.tx = p.x;
    p.ty = p.y;
    if (p.team !== G.poss) {
      G.phase = 'dead';
      G.timer = 1.1;
      G.next = p.team;
      say(label || (wasShot ? 'REBOUND' : 'TURNOVER'), color || (p.team === 0 ? '#7dff7a' : '#ff9c8f'), 1.1);
      audio.sfx(p.team === 0 ? 'pop' : 'error');
    } else {
      G.grace = 0.6;
      if (wasShot) {
        G.shotClock = SHOT_CLOCK;
        say('OFF. REBOUND', '#ffffff', 0.8);
      }
      if (G.poss === 1) G.ctrl = (p.i + 3) % 6;
    }
  }

  function scored(team, pts) {
    G.score[team] += pts;
    audio.noise({ dur: 0.18, vol: 0.12, freq: 3500 });
    if (team === 0) audio.sfx('coin');
    if (G.score[team] >= WIN_SCORE) {
      G.phase = 'over';
      G.timer = 1.6;
      say(team === 0 ? 'GAME!' : 'FINAL', team === 0 ? '#7dff7a' : '#ff9c8f', 1.6);
      audio.sfx(team === 0 ? 'win' : 'lose');
      save.clear('run');
      return;
    }
    G.phase = 'dead';
    G.timer = 1.2;
    G.next = 1 - team;
    say(team === 0 ? `+${pts}` : `THEY SCORE +${pts}`, team === 0 ? '#7dff7a' : '#ff9c8f', 1.1);
  }

  function turnover(label) {
    G.phase = 'dead';
    G.timer = 1.1;
    G.next = 1 - G.poss;
    G.shot = null;
    say(label, '#ffd36b', 1.1);
    audio.tone({ freq: 2300, dur: 0.3, type: 'sine', vol: 0.1 }); // whistle
  }

  // ---------------------------------------------------------------- CPU brain

  function cpuStartShot(p) {
    G.cpuShot = { t: 0, p: p.i, released: false };
    p.tx = p.x;
    p.ty = p.y;
    for (const D of G.players) {
      if (D.team !== 0 || D.i === G.ctrl) continue;
      if (dist(D, p) < 11 && Math.random() < 0.3) D.jumpDelay = rand(0.05, 0.15);
    }
  }

  function cpuRelease() {
    const p = G.players[G.cpuShot.p];
    G.cpuShot.released = true;
    const st = stats();
    for (const D of G.players) {
      if (D.team !== 0) continue;
      if (D.z > 7.5 - st.defense * 0.5 && dist(D, p) < 14 + st.defense * 0.5) {
        const chance = D.i === G.ctrl ? 0.9 : 0.5;
        if (Math.random() < chance) {
          blocked(p, D);
          return;
        }
      }
    }
    const d = dist(p, HOOP);
    const three = isThree(p);
    let pr = d < 16 ? 0.6 : three ? 0.32 : d < 40 ? 0.5 : 0.42;
    pr *= 0.72 + G.rating * 0.05;
    const dn = nearestOpponent(p).d;
    pr *= dn < 9 ? 0.55 : dn < 16 ? 0.8 : 1;
    launchShot(p, Math.random() < clamp(pr, 0.05, 0.9), three ? 3 : 2);
  }

  function cpuThink(dt) {
    const p = holder();
    if (G.poss !== 1 || !p || G.cpuShot) return;
    G.cpuT -= dt;
    if (G.cpuT > 0) return;
    G.cpuT = rand(0.5, 1.2);
    const d = dist(p, HOOP);
    const open = nearestOpponent(p).d;
    const three = isThree(p);
    if (G.shotClock < 2.2 || (d < 18 && open > 6) || (d < 60 && open > 16 && Math.random() < 0.5) ||
      (three && open > 20 && Math.random() < 0.3)) {
      cpuStartShot(p);
      return;
    }
    if (Math.random() < 0.4) {
      const mates = G.players.filter((q) => q.team === 1 && q !== p);
      const best = mates.reduce((a, q) => (nearestOpponent(q).d > nearestOpponent(a).d ? q : a));
      if (nearestOpponent(best).d > open + 3) {
        throwPass(p.i, best.x + (best.tx - best.x) * 0.2, best.y + (best.ty - best.y) * 0.2);
        return;
      }
    }
    const ang = Math.atan2(HOOP.y - p.y, HOOP.x - p.x) + rand(-0.7, 0.7);
    const step = rand(18, 42);
    p.tx = clamp(p.x + Math.cos(ang) * step, BOUNDS.x0, BOUNDS.x1);
    p.ty = clamp(p.y + Math.sin(ang) * step, 30, BOUNDS.y1);
  }

  // ---------------------------------------------------------------- simulation

  function speedOf(p) {
    let s = 40;
    if (p.team === 0) s *= 0.92 + 0.05 * stats().speed;
    else s *= 0.9 + 0.035 * G.rating;
    if (G.ball.mode === 'held' && G.ball.holder === p.i) s *= 0.9;
    return s;
  }

  function aiTargets(dt) {
    const bl = G.ball;
    const H = holder();
    for (const p of G.players) {
      if (p.stun > 0) { p.tx = p.x; p.ty = p.y; continue; }
      if (bl.mode === 'loose') { p.tx = bl.ex; p.ty = bl.ey; continue; }
      const offense = p.team === G.poss;
      if (offense && H === p) continue; // user moves it, or cpuThink does
      if (bl.mode === 'pass' && p.i === bl.receiver) continue;
      if (bl.mode === 'shot' || bl.mode === 'swish') {
        const k = offense ? 0.75 : 0.6; // crash the boards
        p.tx = HOOP.x + (p.x - HOOP.x) * k;
        p.ty = Math.max(30, HOOP.y + (p.y - HOOP.y) * k);
        continue;
      }
      if (offense) {
        p.spotT -= dt;
        if (p.spotT <= 0) {
          const mates = G.players.filter((q) => q.team === p.team && q !== p);
          const free = SPOTS.filter(([x, y]) => mates.every((q) => Math.hypot(q.tx - x, q.ty - y) > 24));
          const [x, y] = pick(free.length ? free : SPOTS);
          p.tx = x;
          p.ty = y;
          p.spotT = rand(1.5, 4);
        }
        continue;
      }
      // defense
      const userCtrl = p.team === 0 && p.i === G.ctrl;
      if (userCtrl && G.ctrlIdle < 1.3) continue;
      const man = G.players[(p.i + 3) % 6];
      const gs = man === H ? guardSpot(man, ON_BALL, 4) : guardSpot(man, 12);
      const react = p.team === 1 ? 2 + G.rating * 0.35 : (userCtrl ? 1.2 : 2.4 + stats().defense * 0.4);
      const k = Math.min(1, dt * react);
      p.tx += (gs.x - p.tx) * k;
      p.ty += (gs.y - p.ty) * k;
    }
  }

  function movePlayers(dt) {
    for (const p of G.players) {
      const frozen = p.stun > 0 || (G.shot && G.shot.p === p.i) || (G.cpuShot && G.cpuShot.p === p.i) || p.z > 0;
      if (frozen) { p.moving = false; continue; }
      const dx = p.tx - p.x;
      const dy = p.ty - p.y;
      const d = Math.hypot(dx, dy);
      if (d > 0.6) {
        const st = Math.min(d, speedOf(p) * dt);
        p.x += (dx / d) * st;
        p.y += (dy / d) * st;
        p.moving = true;
        p.anim += dt;
      } else {
        p.moving = false;
      }
      p.x = clamp(p.x, BOUNDS.x0, BOUNDS.x1);
      p.y = clamp(p.y, BOUNDS.y0, BOUNDS.y1);
    }
    // bodies can't overlap
    for (let i = 0; i < 6; i++) {
      for (let j = i + 1; j < 6; j++) {
        const a = G.players[i];
        const c = G.players[j];
        const d = dist(a, c);
        if (d < 6 && d > 0.01) {
          const push = (6 - d) / 2;
          const nx = (a.x - c.x) / d;
          const ny = (a.y - c.y) / d;
          a.x += nx * push; a.y += ny * push;
          c.x -= nx * push; c.y -= ny * push;
        }
      }
    }
  }

  function animatePlayers(dt) {
    for (const p of G.players) {
      if (p.jumpDelay > 0) {
        p.jumpDelay -= dt;
        if (p.jumpDelay <= 0) { p.jumpDelay = 0; startJump(p); }
      }
      if (p.jumpT >= 0) {
        p.jumpT += dt;
        p.z = Math.max(0, 90 * p.jumpT - 150 * p.jumpT * p.jumpT);
        if (p.jumpT > 0.6) { p.jumpT = -1; p.z = 0; }
      } else if (p.fall) {
        p.z -= 70 * dt;
        if (p.z <= 0) { p.z = 0; p.fall = false; }
      }
      if (p.stun > 0) p.stun -= dt;
    }
  }

  function flight(bl, dt) {
    bl.t += dt;
    const k = Math.min(1, bl.t / bl.dur);
    bl.x = bl.sx + (bl.ex - bl.sx) * k;
    bl.y = bl.sy + (bl.ey - bl.sy) * k;
    bl.z = bl.sz + (bl.ez - bl.sz) * k + bl.h * 4 * k * (1 - k);
    return k >= 1;
  }

  function updateBall(dt) {
    const bl = G.ball;
    if (bl.mode === 'held') {
      const p = G.players[bl.holder];
      const shooting = (G.shot && G.shot.p === p.i) || (G.cpuShot && G.cpuShot.p === p.i);
      const before = bl.dribble % 1;
      bl.dribble += dt * 2.1;
      bl.x = p.x + (shooting ? 0 : 4);
      bl.y = p.y + 1;
      bl.z = shooting ? p.z + 15 : 7 * Math.abs(Math.cos(Math.PI * bl.dribble));
      if (!shooting && G.phase === 'live' && before < 0.5 && bl.dribble % 1 >= 0.5 && p.team === 0) {
        audio.tone({ freq: 130, dur: 0.04, type: 'triangle', vol: 0.07 });
      }
      return;
    }
    if (bl.mode === 'pass') {
      const done = flight(bl, dt);
      for (const D of G.players) {
        if (D.team === bl.team || D.stun > 0 || bl.tried.includes(D.i)) continue;
        if (Math.hypot(D.x - bl.x, D.y - bl.y) < 6 && bl.z < 14 + D.z) {
          bl.tried.push(D.i);
          const st = stats().defense;
          const chance = D.team === 1 ? 0.35 + G.rating * 0.04 : D.i === G.ctrl ? 0.6 + st * 0.06 : 0.3 + st * 0.05;
          if (Math.random() < chance) {
            gainBall(D, 'PICKED OFF!', D.team === 0 ? '#7dff7a' : '#ff9c8f');
            return;
          }
        }
      }
      if (done) {
        // The intended receiver gets first claim (defenders already had their interception roll mid-flight).
        const R = G.players[bl.receiver];
        let best = Math.hypot(R.x - bl.ex, R.y - bl.ey) < 13 ? R : null;
        let bd = 9;
        if (!best) {
          for (const q of G.players) {
            const d = Math.hypot(q.x - bl.ex, q.y - bl.ey);
            if (d < bd) { bd = d; best = q; }
          }
        }
        if (best && best.team === bl.team) {
          G.ball = heldBy(best.i);
          best.tx = best.x;
          best.ty = best.y;
          G.grace = 0.5;
          if (G.poss === 1) G.ctrl = (best.i + 3) % 6;
        } else if (best) {
          gainBall(best, 'PICKED OFF!');
        } else {
          looseFlight(bl.ex, bl.ey, bl.z, bl.ex + rand(-10, 10), bl.ey + rand(-10, 10), 0.35, 5, false);
        }
      }
      return;
    }
    if (bl.mode === 'shot') {
      if (flight(bl, dt)) {
        if (bl.make) {
          G.ball = { ...bl, mode: 'swish', t: 0 };
          G.net = 0.4;
        } else {
          audio.tone({ freq: 320, to: 200, dur: 0.1, type: 'square', vol: 0.1 }); // clank
          const ang = rand(0.25, Math.PI - 0.25);
          const r = rand(14, 38);
          looseFlight(bl.x, bl.y, RIM_Z, HOOP.x + Math.cos(ang) * r, HOOP.y + Math.sin(ang) * r, 0.6, 12, true);
        }
      }
      return;
    }
    if (bl.mode === 'swish') {
      bl.t += dt;
      bl.x = HOOP.x;
      bl.y = HOOP.y;
      bl.z = Math.max(0, RIM_Z - bl.t * 40);
      if (bl.t >= 0.35 && !bl.counted) {
        bl.counted = true;
        scored(bl.team, bl.points);
      }
      return;
    }
    if (bl.mode === 'loose') {
      if (bl.t < bl.dur) flight(bl, dt);
      if (bl.z > 6) return;
      let best = null;
      let bd = 5;
      for (const q of G.players) {
        if (q.stun > 0) continue;
        const d = Math.hypot(q.x - bl.x, q.y - bl.y);
        if (d < bd) { bd = d; best = q; }
      }
      if (best) gainBall(best);
    }
  }

  function cpuSteals(dt) {
    G.grace = Math.max(0, G.grace - dt);
    const H = holder();
    if (G.poss !== 0 || !H || G.shot || G.grace > 0) return;
    const D = G.players[(H.i + 3) % 6];
    if (D.stun > 0 || dist(D, H) > ON_BALL + 3) return;
    const rate = (0.02 + G.rating * 0.015) * (H.moving ? 0.4 : 1);
    if (Math.random() < rate * dt) gainBall(D, 'STOLEN!', '#ff9c8f');
  }

  function update(dt) {
    time += dt;
    if (season && (!G || G.reported) && !ui.isOpen) {
      G = null;
      mainMenu();
      return;
    }
    if (!G) return;
    if (G.msg && (G.msg.t -= dt) <= 0) G.msg = null;
    if (G.tapMark && (G.tapMark.t -= dt) <= 0) G.tapMark = null;
    if (G.lastShot && (G.lastShot.t -= dt) <= 0) G.lastShot = null;
    G.net = Math.max(0, G.net - dt);
    animatePlayers(dt);

    if (G.phase === 'check') {
      G.timer -= dt;
      if (G.timer <= 0) G.phase = 'live';
      updateBall(dt);
      return;
    }
    if (G.phase === 'dead') {
      updateBall(dt);
      G.timer -= dt;
      if (G.timer <= 0) setupPossession(G.next);
      return;
    }
    if (G.phase === 'over') {
      if (G.ball.mode === 'swish') updateBall(dt);
      G.timer -= dt;
      if (G.timer <= 0 && !G.reported) {
        G.reported = true;
        reportResult();
      }
      return;
    }

    // live
    if (G.ball.mode === 'held' || G.ball.mode === 'pass' || G.ball.mode === 'loose') {
      G.shotClock -= dt;
      if (G.shotClock <= 0 && G.ball.mode !== 'loose') {
        turnover('SHOT CLOCK');
        return;
      }
    }
    if (G.poss === 1) G.ctrlIdle += dt;
    cpuThink(dt);
    aiTargets(dt);
    movePlayers(dt);

    if (G.shot) {
      G.shot.t += dt;
      G.shot.info = shotWindow(G.players[G.shot.p]);
      const p = G.players[G.shot.p];
      p.z = Math.max(0, 14 * Math.sin((Math.PI * Math.min(G.shot.t, 1.15)) / 1.25));
      if (G.shot.t >= 1.1) releaseShot();
    }
    if (G.cpuShot) {
      const c = G.cpuShot;
      const p = G.players[c.p];
      c.t += dt;
      // Visible windup: the shooter rises for 0.4s before letting go — that's your block cue.
      p.z = Math.max(0, 14 * Math.sin((Math.PI * Math.min(c.t, 0.75)) / 0.75));
      if (!c.released && c.t >= 0.4) cpuRelease();
      if (c.t >= 0.75) { G.cpuShot = null; p.z = 0; }
    }
    if (G.phase !== 'live') return;
    updateBall(dt);
    if (G.phase === 'live') cpuSteals(dt);
  }

  // ---------------------------------------------------------------- input

  const toBuf = (e) => ({ x: (e.x - offX) / scale, y: (e.y - offY) / scale });

  input.on('down', (e) => {
    if (e.id === -1 || !G) return; // ignore keyboard-generated presses
    const p = toBuf(e);
    const B = btn();
    if (Math.hypot(p.x - B.x, p.y - B.y) < B.r + 6) {
      shootPtr = e.id;
      actionDown();
      return;
    }
    drag = { id: e.id, sx: p.x, sy: p.y, x: p.x, y: p.y };
  });

  input.on('move', (e) => {
    if (!drag || e.id !== drag.id || !G) return;
    const p = toBuf(e);
    drag.x = p.x;
    drag.y = p.y;
    const H = holder();
    const len = Math.hypot(drag.x - drag.sx, drag.y - drag.sy);
    if (G.phase === 'live' && G.poss === 0 && H && H.team === 0 && !G.shot && len > 10) {
      let dx = -(drag.x - drag.sx) * 1.7;
      let dy = -(drag.y - drag.sy) * 1.7;
      const l = Math.hypot(dx, dy);
      if (l > 130) { dx *= 130 / l; dy *= 130 / l; }
      G.aim = { x: clamp(H.x + dx, BOUNDS.x0, BOUNDS.x1), y: clamp(H.y + dy, BOUNDS.y0, BOUNDS.y1) };
    } else {
      G.aim = null;
    }
  });

  input.on('up', (e) => {
    if (!G) return;
    if (e.id === shootPtr) {
      shootPtr = null;
      actionUp();
      return;
    }
    if (!drag || e.id !== drag.id) return;
    const len = Math.hypot(drag.x - drag.sx, drag.y - drag.sy);
    const H = holder();
    if (G.aim && H && G.phase === 'live' && !G.shot) throwPass(H.i, G.aim.x, G.aim.y);
    else if (len < 12) onTap({ x: drag.x, y: drag.y - cy0 });
    G.aim = null;
    drag = null;
  });

  // ---------------------------------------------------------------- drawing helpers

  function text(str, x, y, color, size = 1, align = 'left', shadow = true) {
    str = String(str).toUpperCase();
    const w = str.length * 4 * size - size;
    if (align === 'center') x -= Math.floor(w / 2);
    else if (align === 'right') x -= w;
    x = Math.round(x);
    y = Math.round(y);
    const draw = (ox, oy, col) => {
      b.fillStyle = col;
      let cx = ox;
      for (const ch of str) {
        const gl = FONT[ch] || FONT['?'];
        for (let r = 0; r < 5; r++) {
          for (let c = 0; c < 3; c++) if (gl[r] & (4 >> c)) b.fillRect(cx + c * size, oy + r * size, size, size);
        }
        cx += 4 * size;
      }
    };
    if (shadow) draw(x + size, y + size, 'rgba(0,0,0,0.6)');
    draw(x, y, color);
  }

  function fillCircle(cx, cy, r, color) {
    b.fillStyle = color;
    for (let dy = -r; dy <= r; dy++) {
      const dx = Math.floor(Math.sqrt(r * r - dy * dy));
      b.fillRect(cx - dx, cy + dy, dx * 2 + 1, 1);
    }
  }

  function arc(k, cx, cy, r, a0, a1, color, dashed = false) {
    k.fillStyle = color;
    const steps = Math.ceil(Math.abs(a1 - a0) * r * 1.6);
    for (let i = 0; i <= steps; i++) {
      if (dashed && Math.floor(i / 3) % 2) continue;
      const a = a0 + ((a1 - a0) * i) / steps;
      k.fillRect(Math.round(cx + Math.cos(a) * r), Math.round(cy + Math.sin(a) * r), 1, 1);
    }
  }

  function renderCourt() {
    const c = document.createElement('canvas');
    c.width = W;
    c.height = COURT_H;
    const k = c.getContext('2d');
    k.fillStyle = '#5c3720';
    k.fillRect(0, 0, W, COURT_H);
    for (let x = 4, i = 0; x < W - 4; x += 6, i++) {
      k.fillStyle = i % 2 ? '#c4854a' : '#cc9055';
      k.fillRect(x, 8, 6, COURT_H - 8);
      k.fillStyle = '#b0733d';
      k.fillRect(x, 8, 1, COURT_H - 8);
      for (let y = 8 + ((i * 13) % 31); y < COURT_H; y += 31) k.fillRect(x, y, 6, 1);
    }
    k.fillStyle = '#b4473b';
    k.fillRect(62, BASE_Y, 37, 54);
    const L = '#f6efe0';
    k.fillStyle = L;
    k.fillRect(6, BASE_Y, W - 12, 1);
    k.fillRect(6, BASE_Y, 1, COURT_H - BASE_Y);
    k.fillRect(W - 7, BASE_Y, 1, COURT_H - BASE_Y);
    k.fillRect(6, COURT_H - 2, W - 12, 1);
    k.fillRect(62, BASE_Y, 1, 54);
    k.fillRect(98, BASE_Y, 1, 54);
    k.fillRect(62, BASE_Y + 54, 37, 1);
    arc(k, 80, BASE_Y + 54, 14, 0, Math.PI, L);
    arc(k, 80, BASE_Y + 54, 14, Math.PI, Math.PI * 2, L, true);
    const a0 = Math.acos(60 / THREE_R);
    const cornerY = Math.round(HOOP.y + Math.sin(a0) * THREE_R);
    k.fillStyle = L;
    k.fillRect(20, BASE_Y, 1, cornerY - BASE_Y);
    k.fillRect(140, BASE_Y, 1, cornerY - BASE_Y);
    arc(k, HOOP.x, HOOP.y, THREE_R, a0, Math.PI - a0, L);
    arc(k, HOOP.x, HOOP.y, 8, 0, Math.PI, L);
    arc(k, 80, COURT_H - 2, 14, Math.PI, Math.PI * 2, L);
    // center logo dots
    k.fillStyle = '#b4473b';
    for (let dx = -4; dx <= 4; dx++) k.fillRect(80 + dx, COURT_H - 6 - Math.abs(dx) % 2, 1, 1);
    return c;
  }

  function drawHoop() {
    const y0 = cy0;
    b.fillStyle = '#4a4f5a';
    b.fillRect(79, y0 - 2, 3, 3); // stanchion top
    b.fillStyle = '#eef3f8';
    b.fillRect(69, y0 + 1, 23, 10);
    b.fillStyle = '#9aa7b5';
    b.fillRect(69, y0 + 11, 23, 1);
    b.fillStyle = '#d23c3c';
    b.fillRect(76, y0 + 5, 9, 1);
    b.fillRect(76, y0 + 5, 1, 5);
    b.fillRect(84, y0 + 5, 1, 5);
    const ry = y0 + HOOP.y - RIM_Z;
    b.fillStyle = '#ff6a1a';
    b.fillRect(76, ry, 9, 1);
    b.fillRect(75, ry + 1, 1, 1);
    b.fillRect(85, ry + 1, 1, 1);
    b.fillRect(76, ry + 2, 9, 1);
    const sw = G && G.net > 0 ? Math.floor(G.net * 20) % 2 : 0;
    b.fillStyle = '#ffffff';
    for (let r = 0; r < 5; r++) {
      const inset = Math.floor(r / 2);
      for (let x = 76 + inset; x <= 84 - inset; x += 2) b.fillRect(x + ((r + sw) % 2), ry + 3 + r, 1, 1);
    }
  }

  function drawPlayer(p) {
    const T = p.team === 0 ? HOME : G.opp;
    const gx = Math.round(p.x);
    const gy = Math.round(cy0 + p.y);
    const y = gy - Math.round(p.z);
    b.fillStyle = 'rgba(0,0,0,0.28)';
    b.fillRect(gx - 3, gy, 7, 2);
    const up = p.z > 1;
    const f = p.moving && !up ? Math.floor(p.anim * 9) % 2 : 0;
    const lOff = p.moving && !up ? (f ? -1 : 0) : 0;
    const rOff = p.moving && !up ? (f ? 0 : -1) : 0;
    b.fillStyle = p.skin;
    b.fillRect(gx - 2, y - 4 + lOff, 2, 3);
    b.fillRect(gx + 1, y - 4 + rOff, 2, 3);
    b.fillStyle = '#f4f4f4';
    b.fillRect(gx - 2, y - 1 + lOff, 2, 1);
    b.fillRect(gx + 1, y - 1 + rOff, 2, 1);
    b.fillStyle = T.c2;
    b.fillRect(gx - 3, y - 7, 7, 3);
    b.fillStyle = T.c1;
    b.fillRect(gx - 3, y - 11, 7, 4);
    b.fillStyle = T.c2;
    b.fillRect(gx - 1, y - 10, 3, 1);
    b.fillStyle = p.skin;
    if (up) {
      b.fillRect(gx - 4, y - 16, 1, 5);
      b.fillRect(gx + 4, y - 16, 1, 5);
    } else {
      b.fillRect(gx - 4, y - 11 + f, 1, 3);
      b.fillRect(gx + 4, y - 11 + (1 - f), 1, 3);
    }
    b.fillRect(gx - 2, y - 15, 5, 4);
    b.fillStyle = p.hair;
    b.fillRect(gx - 2, y - 16, 5, 2);
    b.fillStyle = '#1a1a1a';
    b.fillRect(gx - 1, y - 13, 1, 1);
    b.fillRect(gx + 1, y - 13, 1, 1);
    if (p.stun > 0) {
      b.fillStyle = '#ffe066';
      b.fillRect(gx + Math.round(Math.cos(time * 12) * 3), y - 18, 1, 1);
      b.fillRect(gx - Math.round(Math.cos(time * 12) * 3), y - 19, 1, 1);
    }
  }

  function marker(p, color) {
    const x = Math.round(p.x);
    const y = Math.round(cy0 + p.y - p.z) - 21 + (Math.floor(time * 4) % 2);
    b.fillStyle = color;
    b.fillRect(x - 2, y, 5, 1);
    b.fillRect(x - 1, y + 1, 3, 1);
    b.fillRect(x, y + 2, 1, 1);
  }

  function drawBall(x, y, z) {
    const gx = Math.round(x);
    const by = Math.round(cy0 + y - z);
    b.fillStyle = '#e86a17';
    b.fillRect(gx - 1, by - 2, 3, 3);
    b.fillStyle = '#ffa25a';
    b.fillRect(gx - 1, by - 2, 1, 1);
    b.fillStyle = '#6b2a00';
    b.fillRect(gx, by - 1, 1, 1);
  }

  function drawAim() {
    const H = holder();
    if (!G.aim || !H) return;
    const A = G.aim;
    const d = dist(H, A);
    // risky if a defender sits near the lane
    let risky = false;
    for (const q of G.players) {
      if (q.team === 0) continue;
      const t = clamp(((q.x - H.x) * (A.x - H.x) + (q.y - H.y) * (A.y - H.y)) / (d * d || 1), 0, 1);
      if (Math.hypot(q.x - (H.x + (A.x - H.x) * t), q.y - (H.y + (A.y - H.y) * t)) < 7) risky = true;
    }
    const col = risky ? '#ff5d5d' : '#ffffff';
    b.fillStyle = col;
    const steps = Math.floor(d / 3);
    for (let i = 1; i < steps; i++) {
      const k = i / steps;
      const z = (4 + d * 0.1) * 4 * k * (1 - k) + 8;
      if ((i + Math.floor(time * 10)) % 2) b.fillRect(Math.round(H.x + (A.x - H.x) * k), Math.round(cy0 + H.y + (A.y - H.y) * k - z), 1, 1);
    }
    const ax = Math.round(A.x);
    const ay = Math.round(cy0 + A.y);
    b.fillRect(ax - 3, ay, 2, 1);
    b.fillRect(ax + 2, ay, 2, 1);
    b.fillRect(ax, ay - 3, 1, 2);
    b.fillRect(ax, ay + 2, 1, 2);
  }

  function meterGeometry() {
    if (G?.shot) return { m: G.shot.t / METER_TIME, w: G.shot.info.w, live: true };
    if (G?.lastShot) return { m: G.lastShot.m, w: G.lastShot.w, live: false };
    return null;
  }

  function drawShooterMeter() {
    if (!G.shot) return;
    const p = G.players[G.shot.p];
    const { m, w } = meterGeometry();
    const x = Math.round(p.x) + 6;
    const top = Math.round(cy0 + p.y - p.z) - 24;
    const hgt = 16;
    b.fillStyle = '#111';
    b.fillRect(x - 1, top - 1, 5, hgt + 2);
    b.fillStyle = '#3a3a55';
    b.fillRect(x, top, 3, hgt);
    const zy = (v) => top + hgt - Math.round(clamp(v, 0, 1) * hgt);
    b.fillStyle = '#2fbf4a';
    b.fillRect(x, zy(GREEN_AT + w), 3, Math.max(1, zy(GREEN_AT - w) - zy(GREEN_AT + w)));
    b.fillStyle = '#9dff8a';
    b.fillRect(x, zy(GREEN_AT + w * 0.25), 3, Math.max(1, zy(GREEN_AT - w * 0.25) - zy(GREEN_AT + w * 0.25)));
    b.fillStyle = '#ffffff';
    b.fillRect(x - 1, zy(m), 5, 1);
  }

  function drawHUD() {
    const y = hudY;
    b.fillStyle = '#0b0b17';
    b.fillRect(0, y - 3, W, 15);
    b.fillStyle = '#26263f';
    b.fillRect(0, y + 11, W, 1);
    if (!G) {
      text('PIXEL HOOPS', 80, y + 1, '#ffb347', 1, 'center');
      return;
    }
    text(HOME.short, 24, y + 2, HOME.c1);
    text(G.score[0], 54, y, '#ffffff', 2, 'right');
    text(G.score[1], 106, y, '#ffffff', 2, 'left');
    text(G.opp.short, 136, y + 2, G.opp.c1 === '#d8f3ff' ? '#bfe6ff' : G.opp.c1, 1, 'right');
    // shot clock
    const sc = Math.ceil(Math.max(0, G.shotClock));
    b.fillStyle = '#2a0b0b';
    b.fillRect(70, y - 2, 21, 13);
    text(sc, 80, y, sc <= 4 ? '#ff4d4d' : '#ffcc33', 2, 'center', false);
    // possession arrow
    b.fillStyle = '#ffffff';
    if (G.poss === 0) { b.fillRect(60, y + 3, 1, 3); b.fillRect(59, y + 4, 1, 1); }
    else { b.fillRect(99, y + 3, 1, 3); b.fillRect(100, y + 4, 1, 1); }
  }

  function drawControls() {
    b.fillStyle = '#12122a';
    b.fillRect(0, ctrlTop, W, H - ctrlTop);
    b.fillStyle = '#26263f';
    b.fillRect(0, ctrlTop, W, 1);
    const B = btn();
    let label = '';
    let on = false;
    let color = '#3a3a55';
    if (G && G.phase !== 'over') {
      if (G.poss === 0) {
        label = 'SHOOT';
        on = !!holder() && holder().team === 0;
        color = G.shot ? '#ffb347' : '#ff7b1c';
      } else {
        label = 'JUMP';
        const D = G.players[G.ctrl];
        on = D && D.z === 0 && D.stun <= 0;
        color = '#2fa4ff';
      }
    }
    fillCircle(B.x, B.y + 2, B.r, '#05050c');
    fillCircle(B.x, B.y, B.r, on && G?.phase === 'live' ? color : '#3a3a55');
    fillCircle(B.x - 4, B.y - 5, 5, 'rgba(255,255,255,0.15)');
    if (label) text(label, B.x, B.y - 2, '#ffffff', 1, 'center');

    // shot meter
    const mx = 8;
    const mw = 96;
    const my = ctrlMid - 12;
    text('SHOT METER', mx, my - 8, '#7a7aa8', 1, 'left', false);
    b.fillStyle = '#05050c';
    b.fillRect(mx - 1, my - 1, mw + 2, 8);
    b.fillStyle = '#2a2a44';
    b.fillRect(mx, my, mw, 6);
    const mg = meterGeometry();
    const w = mg ? mg.w : (G && G.poss === 0 && holder() ? shotWindow(holder()).w : 0.15);
    const zx = (v) => mx + Math.round(clamp(v, 0, 1) * mw);
    b.fillStyle = '#2fbf4a';
    b.fillRect(zx(GREEN_AT - w), my, Math.max(1, zx(GREEN_AT + w) - zx(GREEN_AT - w)), 6);
    b.fillStyle = '#9dff8a';
    b.fillRect(zx(GREEN_AT - w * 0.25), my, Math.max(1, zx(GREEN_AT + w * 0.25) - zx(GREEN_AT - w * 0.25)), 6);
    if (mg) {
      b.fillStyle = mg.live ? '#ffffff' : '#ffd36b';
      b.fillRect(zx(mg.m) - 1, my - 2, 2, 10);
    }

    const hints = !G ? [] : G.poss === 0
      ? ['TAP: RUN', 'DRAG BACK: PASS', 'HOLD BTN: LET GO IN GREEN']
      : ['TAP: MOVE', 'TAP HANDLER: STEAL', 'JUMP ON SHOT: BLOCK'];
    hints.forEach((h, i) => text(h, mx, my + 11 + i * 7, '#9a9acb', 1, 'left', false));
  }

  function drawMsg() {
    if (!G?.msg) return;
    const y = cy0 + 96;
    const w = G.msg.text.length * 8 + 8;
    b.fillStyle = 'rgba(8,8,20,0.75)';
    b.fillRect(80 - w / 2, y - 4, w, 18);
    text(G.msg.text, 80, y, G.msg.color, 2, 'center');
  }

  function draw(g) {
    b.fillStyle = '#10101f';
    b.fillRect(0, 0, W, H);
    b.drawImage(courtImg, 0, cy0);

    if (G) {
      const bl = G.ball;
      if (G.tapMark) {
        b.fillStyle = 'rgba(255,255,255,0.7)';
        const x = Math.round(G.tapMark.x);
        const y = Math.round(cy0 + G.tapMark.y);
        b.fillRect(x - 2, y, 5, 1);
        b.fillRect(x, y - 1, 1, 3);
      }
      if (bl.mode !== 'held') {
        b.fillStyle = 'rgba(0,0,0,0.3)';
        b.fillRect(Math.round(bl.x) - 1, Math.round(cy0 + bl.y), 3, 1);
      }
      const order = [...G.players].sort((a, c) => a.y - c.y);
      for (const p of order) {
        drawPlayer(p);
        if (bl.mode === 'held' && bl.holder === p.i) drawBall(bl.x, bl.y, bl.z);
      }
      if (G.phase !== 'over') {
        const H = holder();
        if (G.poss === 0 && H && H.team === 0) marker(H, '#ffe14d');
        if (G.poss === 1) marker(G.players[G.ctrl], G.players[G.ctrl].stun > 0 ? '#777' : '#5ee6ff');
        if (G.poss === 0 && bl.mode === 'pass') marker(G.players[bl.receiver], '#ffe14d');
      }
      if (bl.mode === 'swish') {
        drawBall(bl.x, bl.y, bl.z);
        drawHoop();
      } else {
        drawHoop();
        if (bl.mode !== 'held') drawBall(bl.x, bl.y, bl.z);
      }
      drawAim();
      drawShooterMeter();
    } else {
      drawHoop();
      text('PIXEL', 80, cy0 + 80, '#ffb347', 3, 'center');
      text('HOOPS', 80, cy0 + 100, '#ffffff', 3, 'center');
    }
    drawHUD();
    drawControls();
    drawMsg();

    g.imageSmoothingEnabled = false;
    g.fillStyle = '#000';
    g.fillRect(0, 0, ctx.width, ctx.height);
    g.drawImage(buf, offX, offY, W * scale, H * scale);
  }

  // ---------------------------------------------------------------- boot

  resize();
  if (location.hostname === 'localhost') window.__hoops = { get G() { return G; }, get season() { return season; } };
  save.get('season').then((s) => {
    season = s && s.v === 1 ? s : freshSeason();
    const r = ctx.resume;
    if (r && r.v === 1 && !G) {
      newGame(r);
      ui.toast('Game resumed');
    }
  });

  return {
    update,
    draw,
    resize,
    restart() {
      if (G) newGame({ oppIdx: G.oppIdx, rating: G.rating, quick: G.quick, finals: G.finals });
    },
    snapshot() {
      if (!G || G.phase === 'over') return null;
      return { v: 1, score: G.score, poss: G.poss, oppIdx: G.oppIdx, rating: G.rating, quick: G.quick, finals: G.finals };
    },
  };
}
