// origin: A

const LEFT_KEYS = new Set(['KeyA', 'ArrowLeft']);
const RIGHT_KEYS = new Set(['KeyD', 'ArrowRight']);
const JUMP_KEYS = new Set(['Space', 'KeyW', 'ArrowUp']);

export function createInput() {
  const held = new Set();
  let jumpQueued = false;
  let jumpHeld = false;
  let firstInputSeen = false;
  const firstInputListeners = [];

  function announceFirstInput() {
    if (firstInputSeen) return;
    firstInputSeen = true;
    for (const listener of firstInputListeners) listener();
  }

  function release(code) {
    if (LEFT_KEYS.has(code)) held.delete('left');
    if (RIGHT_KEYS.has(code)) held.delete('right');
    if (JUMP_KEYS.has(code)) jumpHeld = false;
  }

  window.addEventListener('keydown', (event) => {
    const code = event.code;
    const isOrbit = LEFT_KEYS.has(code) || RIGHT_KEYS.has(code);
    const isJump = JUMP_KEYS.has(code);
    if (!isOrbit && !isJump) return;
    event.preventDefault();
    if (isOrbit) held.add(LEFT_KEYS.has(code) ? 'left' : 'right');
    if (isJump && !jumpHeld) {
      jumpQueued = true;
      jumpHeld = true;
    }
    announceFirstInput();
  });

  window.addEventListener('keyup', (event) => release(event.code));
  window.addEventListener('blur', () => {
    held.clear();
    jumpHeld = false;
  });

  function pressTouch(action, isDown) {
    if (action === 'jump') {
      if (isDown && !jumpHeld) jumpQueued = true;
      jumpHeld = isDown;
    } else if (isDown) {
      held.add(action);
    } else {
      held.delete(action);
    }
    if (isDown) announceFirstInput();
  }

  for (const button of document.querySelectorAll('[data-action]')) {
    const action = button.dataset.action;
    button.addEventListener('pointerdown', (event) => {
      event.preventDefault();
      button.setPointerCapture(event.pointerId);
      pressTouch(action, true);
    });
    const lift = () => pressTouch(action, false);
    button.addEventListener('pointerup', lift);
    button.addEventListener('pointercancel', lift);
  }

  return {
    orbitAxis() {
      return (held.has('right') ? 1 : 0) - (held.has('left') ? 1 : 0);
    },
    consumeJump() {
      const queued = jumpQueued;
      jumpQueued = false;
      return queued;
    },
    jumpHeld: () => jumpHeld,
    onFirstInput(listener) {
      firstInputListeners.push(listener);
    },
  };
}
