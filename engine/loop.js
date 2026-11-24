// Fixed-timestep game loop. update(dt) runs at a steady rate; draw(alpha) once per frame.

export function createLoop(update, draw, step = 1 / 120) {
  let raf = 0;
  let last = 0;
  let acc = 0;
  let running = false;

  function frame(now) {
    if (!running) return;
    raf = requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    if (dt > 0.25) dt = 0.25; // tab was asleep; don't fast-forward
    acc += dt;
    let n = 0;
    while (acc >= step && n < 30) {
      update(step);
      acc -= step;
      n++;
    }
    if (n === 30) acc = 0;
    draw(acc / step);
  }

  return {
    start() {
      if (running) return;
      running = true;
      last = performance.now();
      acc = 0;
      raf = requestAnimationFrame(frame);
    },
    stop() {
      running = false;
      cancelAnimationFrame(raf);
    },
    get running() {
      return running;
    },
  };
}
