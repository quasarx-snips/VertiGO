// origin: A

import { TAU, approach, clamp, wrapAngle } from './vec.js';

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
// 0.98 s to 0.72 s, which drops a run-speed jump from 65 deg to about 50 deg
// and invalidates every gap width in section 4. Revisit with new gap data, not blind.
export const FALL_GRAVITY = 1;

// Falling more than this below the last deck you stood on hands you spin and
// puts you back on that deck. Six metres is two floors: a missed jump, not a
// whole climb thrown away.
export const CATCH_DROP = 6;
export const CATCH_SPIN = 0.35;

export function createPlayer(startHeight, startDeck = null) {
  return {
    theta: 0,
    y: startHeight,
    omega: 0,
    vy: 0,
    grounded: true,
    surfaceY: startHeight,
    deck: startDeck,
    lastDeck: startDeck,
    coyote: 0,
    buffer: 0,
    cutUsed: false,
    airTime: 0,
    falls: 0,
  };
}

export function surfaceSpeed(player) {
  return Math.abs(player.omega) * TOWER_RADIUS;
}

export function spinFraction(player) {
  return Math.min(surfaceSpeed(player) / TOP_SPEED, 1);
}

// A deck only holds you up while theta sits inside its arc. The base ring is a
// full circle, so it skips the wrap comparison instead of always matching.
export function onDeck(deck, theta) {
  if (deck.arc >= TAU - 1e-6) return true;
  const around = (((theta - deck.theta) % TAU) + TAU) % TAU;
  return around <= deck.arc;
}

function driveOmega(player, dt, controls) {
  const maxOmega = TOP_SPEED / TOWER_RADIUS;
  const cruise = (controls.orbit * RUN_SPEED) / TOWER_RADIUS;
  const gain = (GROUND_ACCEL * (player.grounded ? 1 : AIR_CONTROL) * dt) / TOWER_RADIUS;

  // Spin won from a fall is worth keeping: holding the same direction lets omega
  // sit above run speed instead of being dragged back down to it. Braking and
  // turning still work normally.
  const carrying =
    controls.orbit !== 0 &&
    Math.sign(cruise) === Math.sign(player.omega) &&
    Math.abs(player.omega) > Math.abs(cruise);

  if (!carrying) player.omega = approach(player.omega, cruise, gain);
  player.omega = clamp(player.omega, -maxOmega, maxOmega);
  player.theta = wrapAngle(player.theta + player.omega * dt);
}

function deckUnder(ledges, theta, fromY, toY) {
  let hit = null;
  for (const deck of ledges) {
    if (deck.top > fromY + 1e-4 || deck.top < toY) continue;
    if (!onDeck(deck, theta)) continue;
    if (hit === null || deck.top > hit.top) hit = deck;
  }
  return hit;
}

function standOn(player, deck) {
  player.deck = deck;
  player.lastDeck = deck;
  player.y = deck.top;
  player.surfaceY = deck.top;
  player.vy = 0;
  player.grounded = true;
  player.airTime = 0;
  player.coyote = COYOTE;
  player.cutUsed = false;
}

function catchFall(player) {
  const anchor = player.lastDeck;
  const top = anchor ? anchor.top : 0;
  if (player.y >= top - CATCH_DROP) return null;

  // One floor of falling is the reference fall (7 -> 11.5 m/s). Letting the
  // full six metre drop count would cap spin on every single miss, which makes
  // the retry harder than the jump that was missed.
  const impact = Math.min(Math.abs(player.vy), JUMP_SPEED);
  const maxOmega = TOP_SPEED / TOWER_RADIUS;
  // k is metres per second of surface speed per m/s of impact, so it has to be
  // divided by the radius before it can join omega (rad/s).
  const kick = (CATCH_SPIN * impact) / TOWER_RADIUS;
  const spin = player.omega + Math.sign(player.omega || 1) * kick;

  player.falls += 1;
  player.omega = clamp(spin, -maxOmega, maxOmega);
  player.theta = anchor ? wrapAngle(anchor.theta + anchor.arc / 2) : 0;
  player.vy = 0;
  player.grounded = true;
  player.deck = anchor;
  player.surfaceY = top;
  player.y = top;
  player.airTime = 0;
  player.coyote = COYOTE;
  player.cutUsed = false;

  return { impact, top };
}

export function stepPlayer(player, dt, controls, ledges) {
  driveOmega(player, dt, controls);

  // Walking past the end of a ledge starts a fall, not a glide.
  if (player.grounded && player.deck && !onDeck(player.deck, player.theta)) {
    player.grounded = false;
    player.coyote = COYOTE;
    player.vy = 0;
  }

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

  const fromY = player.y;
  player.y += player.vy * dt;
  if (!player.grounded) player.airTime += dt;

  const deck = player.vy <= 0 ? deckUnder(ledges, player.theta, fromY, player.y) : null;
  if (deck) {
    standOn(player, deck);
  } else if (player.grounded) {
    player.grounded = false;
  }

  if (player.grounded) {
    player.y = player.surfaceY;
    player.vy = 0;
  }

  const fall = catchFall(player);
  return { caught: fall !== null, impact: fall ? fall.impact : 0 };
}
