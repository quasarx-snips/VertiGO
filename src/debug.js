// origin: A

const SAMPLE_SIZE = 90;
const PAINT_INTERVAL = 200;

export function createDebug() {
  const enabled = new URLSearchParams(location.search).has('dev');
  if (!enabled) return { visible: false, sample() {}, trace() {} };

  const pane = document.getElementById('dev-overlay');
  const frameTimes = [];
  const lines = [];
  let lastPaint = 0;
  pane.hidden = false;

  function percentile(values, fraction) {
    const sorted = [...values].sort((a, b) => a - b);
    return sorted[Math.min(sorted.length - 1, Math.floor(sorted.length * fraction))];
  }

  return {
    visible: true,
    sample(frameMs, state) {
      frameTimes.push(frameMs);
      if (frameTimes.length > SAMPLE_SIZE) frameTimes.shift();

      const now = performance.now();
      if (now - lastPaint < PAINT_INTERVAL) return;
      lastPaint = now;

      const mean = frameTimes.reduce((sum, value) => sum + value, 0) / frameTimes.length;
      const header = [
        'fps ' + (1000 / mean).toFixed(0),
        'p95 ' + percentile(frameTimes, 0.95).toFixed(1) + ' ms',
        'roll ' + state.roll.toFixed(3) + ' deg',
        'theta ' + ((state.theta * 180) / Math.PI).toFixed(1) + ' deg',
        'omega ' + state.omega.toFixed(2) + ' rad/s',
        'speed ' + state.speed.toFixed(2) + ' m/s',
        'y ' + state.y.toFixed(2) + ' m',
        state.grounded ? 'grounded' : 'air ' + state.airTime.toFixed(2) + ' s',
      ];
      pane.textContent = header.join('   ') + (lines.length ? '\n' + lines.join('\n') : '');
    },
    trace(label) {
      lines.push(label);
      if (lines.length > 6) lines.shift();
    },
  };
}
