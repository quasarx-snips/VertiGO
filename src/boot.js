// origin: A

import { createDebug } from './debug.js';
import { createHud } from './hud.js';
import { createInput } from './input.js';
import { createLoop } from './loop.js';
import { FLOOR_HEIGHT, createPlayer, stepPlayer, surfaceSpeed } from './player.js';
import { createScene } from './scene.js';
import { runSelfTest } from '../tools/measures.js';
import { wrapDelta } from './vec.js';

const params = new URLSearchParams(location.search);
const proofMode = params.has('proof');
const testMode = params.has('test');

const world = createScene(document.getElementById('tower'));
const input = createInput();
const hud = createHud(world.rings.length);
const debug = createDebug();

let player = createPlayer(world.rings[0].top);
let elapsed = 0;
let previousTheta = player.theta;
let previousY = player.y;

function demoControls(time) {
  const jump = (time > 0.85 && time < 0.9) || (time > 1.95 && time < 2);
  const holding = (time > 0.85 && time < 1.6) || (time > 1.95 && time < 2.7);
  return { orbit: time > 0.12 ? 1 : 0, jump, jumpHeld: holding };
}

function liveControls() {
  return { orbit: input.orbitAxis(), jump: input.consumeJump(), jumpHeld: input.jumpHeld() };
}

function step(dt) {
  previousTheta = player.theta;
  previousY = player.y;
  stepPlayer(player, dt, proofMode ? demoControls(elapsed) : liveControls(), world.rings);
  elapsed += dt;
}

let lastFrameAt = performance.now();

function draw(alpha) {
  const theta = previousTheta + wrapDelta(player.theta, previousTheta) * alpha;
  const height = previousY + (player.y - previousY) * alpha;
  world.place(theta, height);
  world.render();
  hud.update(player, elapsed, Math.floor(player.y / FLOOR_HEIGHT));

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
  const probe = createPlayer(world.rings[0].top);
  for (let i = 0; i < 240; i += 1) stepPlayer(probe, 1 / 120, spinUp, world.rings);
  let roll = 0;
  for (let i = 0; i < 720; i += 1) {
    stepPlayer(probe, 1 / 120, spinUp, world.rings);
    world.place(probe.theta, probe.y);
    roll = Math.max(roll, Math.abs(world.cameraRoll()));
  }
  return roll;
}
worstRoll = measureRoll();

function reset() {
  player = createPlayer(world.rings[0].top);
  elapsed = 0;
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
    return { theta: player.theta, y: player.y, omega: player.omega, elapsed, roll: worstRoll };
  },
};

if (testMode) {
  hud.hide();
  document.getElementById('touch-pad').hidden = true;
  const rows = runSelfTest(worstRoll);
  window.VERTIGO.testRows = rows;
  window.VERTIGO.testFailures = rows.filter((row) => !row.ok).length;
  const output = document.getElementById('test-output');
  output.textContent = rows
    .map(
      (row) =>
        (row.ok ? 'pass  ' : 'FAIL  ') +
        row.label.padEnd(22) +
        row.actual.padEnd(10) +
        'want ' +
        row.expected
    )
    .join('\n');
  output.hidden = false;
} else {
  world.place(player.theta, player.y);
  world.render();
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
