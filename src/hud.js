// origin: A

import { spinFraction, surfaceSpeed } from './player.js';

function formatClock(seconds) {
  const whole = Math.floor(seconds);
  const minutes = String(Math.floor(whole / 60)).padStart(2, '0');
  const rest = String(whole % 60).padStart(2, '0');
  const cents = String(Math.floor((seconds - whole) * 100)).padStart(2, '0');
  return minutes + ':' + rest + '.' + cents;
}

function pad(value) {
  return String(value).padStart(2, '0');
}

export function createHud(floorCount, shardTotal) {
  const clock = document.getElementById('clock');
  const floor = document.getElementById('floor');
  const shards = document.getElementById('shard-count');
  const spinValue = document.getElementById('spin-value');
  const spinFill = document.getElementById('spin-fill');

  function setShards(taken) {
    shards.parentElement.hidden = false;
    shards.textContent = pad(taken) + '/' + pad(shardTotal);
  }

  setShards(0);

  return {
    update(player, elapsed, floorIndex) {
      clock.textContent = formatClock(elapsed);
      floor.textContent = pad(Math.min(floorIndex + 1, floorCount)) + '/' + pad(floorCount);

      const spin = spinFraction(player);
      spinValue.textContent = surfaceSpeed(player).toFixed(1);
      spinFill.style.width = (spin * 100).toFixed(1) + '%';
      spinFill.style.background =
        spin > 0.75 ? 'var(--vermilion)' : spin > 0.35 ? 'var(--amber)' : 'var(--ice-dim)';
    },
    setShards,
    hide() {
      document.getElementById('hud').hidden = true;
    },
  };
}
