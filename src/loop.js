// origin: A

const MAX_STEPS_PER_FRAME = 5;
const MAX_FRAME_DELTA = 0.25;

export function createLoop({ stepHz, update, render }) {
  const step = 1 / stepHz;
  let accumulator = 0;
  let lastMs = 0;
  let handle = 0;

  function frame(nowMs) {
    handle = requestAnimationFrame(frame);
    const delta = Math.min((nowMs - lastMs) / 1000, MAX_FRAME_DELTA);
    lastMs = nowMs;
    accumulator += delta;

    let steps = 0;
    while (accumulator >= step && steps < MAX_STEPS_PER_FRAME) {
      update(step);
      accumulator -= step;
      steps += 1;
    }
    if (steps === MAX_STEPS_PER_FRAME) accumulator = 0;
    render(accumulator / step);
  }

  return {
    start() {
      if (handle) return;
      lastMs = performance.now();
      handle = requestAnimationFrame(frame);
    },
    stop() {
      cancelAnimationFrame(handle);
      handle = 0;
    },
  };
}
