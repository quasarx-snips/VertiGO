// origin: A

import { createDebug } from './debug.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { FLOOR_HEIGHT, TOWER_RADIUS, createPlayer, stepPlayer, surfaceSpeed } from './player.js';
import { createScene } from './scene.js';
import { clearShards, takeShard } from './shards.js';
import { TAU, wrapAngle, wrapDelta } from './vec.js';

const params = new URLSearchParams(location.search);
const onDesk = location.hostname === '127.0.0.1' || location.hostname === 'localhost';
const proofMode = params.has('proof') && onDesk;
const testMode = params.has('test') && onDesk;
const IDLE = { orbit: 0, jump: false, jumpHeld: false };

const world = createScene(document.getElementById('tower'));
const input = createInput();
const hud = createHud(world.floors, world.shards.length);
const debug = createDebug();
const wipe = document.getElementById('wipe');

let player = createPlayer(world.ledges[0].top, world.ledges[0]);
let taken = 0;
let elapsed = 0;
let reached = 0;
let recover = 0;
let wipeTimer = 0;
let previousTheta = player.theta;
let previousY = player.y;

// Proof mode has no hands. It looks at the nearest ledge ahead and leaves only
// when its current spin can still put it down on that ledge, which is the same
// judgement the gap widths were tuned for.
const AIRTIME_UP = 0.72;
const REACH_MARGIN = 0.06;

function demoControls(runner) {
  if (runner.deck && runner.deck.floor >= world.floors - 1) {
    // Walk to the middle of the summit deck, then stand still so the capture
    // has a stable final frame.
    const centre = wrapAngle(runner.deck.theta + runner.deck.arc / 2);
    const left = wrapAngle(centre - runner.theta);
    return { orbit: left > Math.PI ? 0 : 1, jump: false, jumpHeld: false };
  }

  if (!runner.grounded || !runner.deck) {
    return { orbit: 1, jump: false, jumpHeld: true };
  }

  let ahead = TAU;
  for (const deck of world.ledges) {
    if (deck === runner.deck || deck.top < runner.deck.top) continue;
    if (deck.top > runner.deck.top + FLOOR_HEIGHT + 0.01) continue;
    const gap = wrapAngle(deck.theta - runner.theta);
    if (gap > 0.05 && gap < ahead) ahead = gap;
  }

  const reach = (surfaceSpeed(runner) / TOWER_RADIUS) * AIRTIME_UP;
  const jump = ahead <= reach - REACH_MARGIN;

  return { orbit: 1, jump, jumpHeld: !runner.grounded || jump };
}

function flashWipe() {
  wipe.classList.add('on');
  clearTimeout(wipeTimer);
  wipeTimer = setTimeout(() => wipe.classList.remove('on'), 170);
}

function liveControls() {
  return { orbit: input.orbitAxis(), jump: input.consumeJump(), jumpHeld: input.jumpHeld() };
}

function step(dt) {
  previousTheta = player.theta;
  previousY = player.y;

  const controls = proofMode ? demoControls(player) : recover > 0 ? IDLE : liveControls();
  const event = stepPlayer(player, dt, controls, world.ledges);

  recover = Math.max(recover - dt, 0);

  if (event.caught) {
    flashWipe();
    recover = 0.26;
    // The catch moves you across the tower; keep interpolation from sweeping there.
    previousTheta = player.theta;
    previousY = player.y;
  }

  elapsed += dt;
  reached = Math.max(reached, Math.floor(player.y / FLOOR_HEIGHT + 0.001));

  if (takeShard(world.shards, player.theta, player.y, TOWER_RADIUS)) {
    taken += 1;
    hud.setShards(taken);
  }
}

let lastFrameAt = performance.now();

function draw(alpha) {
  const theta = previousTheta + wrapDelta(player.theta, previousTheta) * alpha;
  const height = previousY + (player.y - previousY) * alpha;
  world.place(theta, height);
  world.render(elapsed);
  hud.update(player, elapsed, reached);

  const now = performance.now();
  const frameMs = now - lastFrameAt;
  lastFrameAt = now;
  debug.sample(frameMs, {
    roll: world.cameraRoll(),
    theta: player.theta,
    omega: player.omega,
    speed: surfaceSpeed(player),
    y: player.y,
    grounded: player.grounded,
    airTime: player.airTime,
  });
}

const loop = createLoop({ stepHz: 120, update: step, render: draw });

function fitCanvas() {
  world.resize(window.innerWidth, window.innerHeight);
}

window.addEventListener('resize', fitCanvas);
fitCanvas();

const spinUp = { orbit: 1, jump: false, jumpHeld: false };
let worstRoll = 0;
function measureRoll() {
  const probe = createPlayer(world.ledges[0].top, world.ledges[0]);
  for (let i = 0; i < 240; i += 1) stepPlayer(probe, 1 / 120, spinUp, world.ledges);
  let roll = 0;
  for (let i = 0; i < 720; i += 1) {
    stepPlayer(probe, 1 / 120, spinUp, world.ledges);
    world.place(probe.theta, probe.y);
    roll = Math.max(roll, Math.abs(world.cameraRoll()));
  }
  return roll;
}
worstRoll = measureRoll();

function reset() {
  player = createPlayer(world.ledges[0].top, world.ledges[0]);
  taken = 0;
  reached = 0;
  recover = 0;
  clearShards(world.shards);
  hud.setShards(0);
  elapsed = 0;
  input.clear();
  loop.reset();
  previousTheta = player.theta;
  previousY = player.y;
  world.place(player.theta, player.y);
}

window.VERTIGO = {
  freezeAt(seconds) {
    loop.stop();
    reset();
    const frames = Math.round(seconds * 120);
    for (let i = 0; i < frames; i += 1) step(1 / 120);
    previousTheta = player.theta;
    previousY = player.y;
    draw(1);
  },
  metrics() {
    return {
      theta: player.theta,
      y: player.y,
      omega: player.omega,
      elapsed,
      taken,
      falls: player.falls,
      roll: worstRoll,
    };
  },
};

if (testMode) {
  hud.hide();
  document.getElementById('touch-pad').hidden = true;
  // The measure table lives in tools/ so it never ships with the game.
  import('../tools/measures.js')
    .then((module) => {
      const rows = module.runSelfTest(worstRoll);
      window.VERTIGO.testRows = rows;
      window.VERTIGO.testFailures = rows.filter((row) => !row.ok).length;
      const output = document.getElementById('test-output');
      output.textContent = rows
        .map(
          (row) =>
            (row.ok ? 'pass  ' : 'FAIL  ') +
            row.label.padEnd(24) +
            row.actual.padEnd(14) +
            'want ' +
            row.expected
        )
        .join('\n');
      output.hidden = false;
    })
    .catch((error) => {
      const overlay = document.getElementById('dev-overlay');
      overlay.hidden = false;
      overlay.textContent = 'test table unavailable: ' + error.message;
    });
} else {
  world.place(player.theta, player.y);
  world.render(elapsed);
  if (!proofMode) loop.start();
}

if (proofMode && params.has('t')) window.VERTIGO.freezeAt(Number(params.get('t')));

input.onFirstInput(() => {
  if (!proofMode) loop.start();
});

window.addEventListener('keydown', (event) => {
  if (event.key !== 'r' || event.repeat) return;
  reset();
  draw(1);
});

window.addEventListener('error', (event) => {
  const overlay = document.getElementById('dev-overlay');
  overlay.hidden = false;
  overlay.textContent = event.message + ' ' + event.filename + ':' + event.lineno;
});
