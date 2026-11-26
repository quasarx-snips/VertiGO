// origin: A

import { approach, wrapAngle } from './vec.js';

export const TOWER_RADIUS = 6;
export const FLOOR_HEIGHT = 2.8;
export const GRAVITY = 30;
export const JUMP_SPEED = 14.7;
export const RUN_SPEED = 7;
export const TOP_SPEED = 13;
export const GROUND_ACCEL = 55;
export const AIR_CONTROL = 0.35;
export const COYOTE = 0.1;
export const JUMP_BUFFER = 0.12;
export const JUMP_CUT = 0.55;
export const APEX_BAND = 0.8;
export const APEX_GRAVITY = 0.6;

// Left at 1.0 on purpose. The 1.6 fall gain in the brief shortens airtime from
// 0.98 s to 0.72 s, which drops a run-speed jump from 65 deg to 48 deg and
// invalidates every gap width in section 4. Revisit with new gap data, not blind.
export const FALL_GRAVITY = 1;

export function createPlayer(startHeight) {
  return {
    theta: 0,
    y: startHeight,
    omega: 0,
    vy: 0,
    grounded: true,
    surfaceY: startHeight,
    coyote: 0,
    buffer: 0,
    cutUsed: false,
    airTime: 0,
  };
}

export function surfaceSpeed(player) {
  return Math.abs(player.omega) * TOWER_RADIUS;
}

export function spinFraction(player) {
  return Math.min(surfaceSpeed(player) / TOP_SPEED, 1);
}

function highestRingBelow(rings, previousY, currentY) {
  let landed = null;
  for (const ring of rings) {
    const crossed = ring.top <= previousY + 1e-4 && ring.top >= currentY;
    if (crossed && (landed === null || ring.top > landed.top)) landed = ring;
  }
  return landed;
}

export function stepPlayer(player, dt, controls, rings) {
  const wantedSpeed = controls.orbit * RUN_SPEED;
  const accel = GROUND_ACCEL * (player.grounded ? 1 : AIR_CONTROL);
  player.omega = approach(player.omega, wantedSpeed / TOWER_RADIUS, (accel * dt) / TOWER_RADIUS);
  player.theta = wrapAngle(player.theta + player.omega * dt);

  player.buffer = Math.max(player.buffer - dt, 0);
  if (controls.jump) player.buffer = JUMP_BUFFER;
  player.coyote = Math.max(player.coyote - dt, 0);

  const canLaunch = player.grounded || player.coyote > 0;
  if (player.buffer > 0 && canLaunch) {
    player.vy = JUMP_SPEED;
    player.grounded = false;
    player.coyote = 0;
    player.buffer = 0;
    player.cutUsed = false;
  }

  if (player.vy > 0 && !controls.jumpHeld && !player.cutUsed) {
    player.vy *= JUMP_CUT;
    player.cutUsed = true;
  }

  const apex = Math.abs(player.vy) < APEX_BAND ? APEX_GRAVITY : 1;
  const falling = player.vy < 0 ? FALL_GRAVITY : 1;
  player.vy -= GRAVITY * apex * falling * dt;

  const previousY = player.y;
  player.y += player.vy * dt;

  if (!player.grounded) player.airTime += dt;

  const ring = player.vy <= 0 ? highestRingBelow(rings, previousY, player.y) : null;
  if (ring) {
    player.y = ring.top;
    player.vy = 0;
    player.grounded = true;
    player.surfaceY = ring.top;
    player.airTime = 0;
    player.coyote = COYOTE;
    player.cutUsed = false;
  } else if (player.grounded) {
    player.grounded = false;
  }

  if (player.grounded) {
    player.y = player.surfaceY;
    player.vy = 0;
  }

  if (player.y < player.surfaceY - 12) {
    player.y = player.surfaceY;
    player.vy = 0;
    player.omega = 0;
    player.grounded = true;
    player.airTime = 0;
  }
}
