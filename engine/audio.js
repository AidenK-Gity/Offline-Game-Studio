// Synthesized sound effects via WebAudio — no audio files, so nothing to download.
// iOS only allows audio after a user gesture; the launcher calls audio.unlock() on touch.

let ac = null;
let master = null;
let muted = false;
let noiseBuf = null;

function ensure() {
  if (ac) return ac;
  const AC = window.AudioContext || window.webkitAudioContext;
  if (!AC) return null;
  try {
    ac = new AC();
    master = ac.createGain();
    master.gain.value = 0.5;
    master.connect(ac.destination);
  } catch {
    ac = null;
  }
  return ac;
}

function tone({ freq = 440, to = 0, type = 'sine', dur = 0.12, vol = 0.25, delay = 0 } = {}) {
  if (muted || !ac || ac.state !== 'running') return;
  const t = ac.currentTime + delay;
  const osc = ac.createOscillator();
  const g = ac.createGain();
  osc.type = type;
  osc.frequency.setValueAtTime(freq, t);
  if (to) osc.frequency.exponentialRampToValueAtTime(Math.max(1, to), t + dur);
  g.gain.setValueAtTime(0.0001, t);
  g.gain.linearRampToValueAtTime(vol, t + 0.008);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  osc.connect(g).connect(master);
  osc.start(t);
  osc.stop(t + dur + 0.03);
}

function noise({ dur = 0.25, vol = 0.2, delay = 0, freq = 1200 } = {}) {
  if (muted || !ac || ac.state !== 'running') return;
  if (!noiseBuf) {
    noiseBuf = ac.createBuffer(1, ac.sampleRate, ac.sampleRate);
    const d = noiseBuf.getChannelData(0);
    for (let i = 0; i < d.length; i++) d[i] = Math.random() * 2 - 1;
  }
  const t = ac.currentTime + delay;
  const src = ac.createBufferSource();
  const filter = ac.createBiquadFilter();
  const g = ac.createGain();
  src.buffer = noiseBuf;
  filter.type = 'lowpass';
  filter.frequency.setValueAtTime(freq, t);
  filter.frequency.exponentialRampToValueAtTime(80, t + dur);
  g.gain.setValueAtTime(vol, t);
  g.gain.exponentialRampToValueAtTime(0.0001, t + dur);
  src.connect(filter).connect(g).connect(master);
  src.start(t);
  src.stop(t + dur + 0.03);
}

const arp = (notes, step = 0.07, opts = {}) =>
  notes.forEach((f, i) => tone({ freq: f, dur: 0.14, delay: i * step, ...opts }));

const SFX = {
  click: () => tone({ freq: 720, dur: 0.035, type: 'square', vol: 0.08 }),
  jump: () => tone({ freq: 420, to: 900, dur: 0.1, type: 'triangle', vol: 0.2 }),
  land: () => tone({ freq: 260, to: 140, dur: 0.12, type: 'triangle', vol: 0.25 }),
  coin: () => { tone({ freq: 988, dur: 0.07, type: 'square', vol: 0.1 }); tone({ freq: 1319, dur: 0.16, type: 'square', vol: 0.1, delay: 0.06 }); },
  perfect: () => arp([660, 880, 1320], 0.05, { type: 'triangle', vol: 0.18 }),
  hit: () => { noise({ dur: 0.15, vol: 0.25, freq: 2000 }); tone({ freq: 180, to: 90, dur: 0.15, type: 'square', vol: 0.12 }); },
  lose: () => { tone({ freq: 440, to: 70, dur: 0.6, type: 'sawtooth', vol: 0.15 }); noise({ dur: 0.5, vol: 0.15, freq: 900 }); },
  win: () => arp([523, 659, 784, 1047], 0.09, { type: 'triangle', vol: 0.2 }),
  error: () => tone({ freq: 160, dur: 0.18, type: 'square', vol: 0.12 }),
  pop: () => tone({ freq: 600, to: 1200, dur: 0.06, type: 'sine', vol: 0.2 }),
};

export const audio = {
  unlock() {
    const c = ensure();
    if (c && c.state !== 'running') c.resume().catch(() => {});
  },
  get muted() {
    return muted;
  },
  set muted(v) {
    muted = !!v;
  },
  tone,
  noise,
  arp,
  /** Play a named preset: click, jump, land, coin, perfect, hit, lose, win, error, pop */
  sfx(name) {
    SFX[name]?.();
  },
};
