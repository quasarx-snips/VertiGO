// origin: A

import { spinFraction, surfaceSpeed } from './player.js';

function formatClock(seconds) {
  const whole = Math.floor(seconds);
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
  const rest = String(whole % 60).padStart(2, '0');
  const cents = String(Math.floor((seconds - whole) * 100)).padStart(2, '0');
  return minutes + ':' + rest + '.' + cents;
}

export function createHud() {
  const clock = document.getElementById('clock');
  const floor = document.getElementById('floor');
  const shards = document.getElementById('shard-count');
  const spinValue = document.getElementById('spin-value');
  const spinFill = document.getElementById('spin-fill');

  return {
    update(player, elapsed, floorIndex) {
      clock.textContent = formatClock(elapsed);
      floor.textContent = String(Math.min(floorIndex + 1, 10)).padStart(2, '0') + '/10';

      const spin = spinFraction(player);
      spinValue.textContent = surfaceSpeed(player).toFixed(1);
      spinFill.style.width = (spin * 100).toFixed(1) + '%';
      spinFill.style.background =
        spin > 0.75 ? 'var(--vermilion)' : spin > 0.35 ? 'var(--amber)' : 'var(--ice-dim)';
    },
    setShards(count) {
      shards.parentElement.hidden = count === 0;
      shards.textContent = count + '/5';
    },
    hide() {
      document.getElementById('hud').hidden = true;
    },
  };
}
