const READY_TIMEOUT_MS = 10000;

function nextFrame() {
  return new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForReady() {
  const deadline = performance.now() + READY_TIMEOUT_MS;
  while (performance.now() < deadline) {
    const vertigo = window.VERTIGO;
    if (vertigo?.freezeAt) {
      if (vertigo.ready?.then) {
        await vertigo.ready;
        return vertigo;
      }
      if (vertigo.ready !== false) return vertigo;
    }
    await nextFrame();
  }
  throw new Error('VERTIGO.ready did not arrive within 10 s');
}

async function capture(day, t) {
  const vertigo = await waitForReady();
  vertigo.freezeAt(t);
  const png = document.querySelector('canvas').toDataURL('image/png');
  await fetch('/_capture', {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ day, t, png }),
  });
}

export function setupCapture() {
  const query = new URLSearchParams(location.search);
  const day = query.get('proof');
  if (!day) return;
  const t = Number(query.get('t') ?? 0);
  void capture(day, t);
}
