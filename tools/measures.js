// origin: A

import {
  FLOOR_HEIGHT,
  RUN_SPEED,
  TOP_SPEED,
  TOWER_RADIUS,
  createPlayer,
  stepPlayer,
  surfaceSpeed,
} from '../src/player.js';

const STEP = 1 / 120;
const DEGREES = 180 / Math.PI;
const IDLE = { orbit: 0, jump: false, jumpHeld: false };
const RUN = { orbit: 1, jump: false, jumpHeld: true };
const BASE = { floor: 0, top: 0, theta: 0, arc: Math.PI * 2 };

function airborneRun() {
  const player = createPlayer(0, BASE);
  let apex = 0;
  let airTime = 0;
  let launchSpeed = 0;
  for (let i = 0; i < 192; i += 1) {
    const time = i * STEP;
    const controls = { orbit: 1, jump: time < STEP, jumpHeld: !player.grounded || time < STEP };
    if (!player.grounded) launchSpeed = Math.max(launchSpeed, surfaceSpeed(player));
    stepPlayer(player, STEP, controls, [BASE]);
    apex = Math.max(apex, player.y);
    airTime = Math.max(airTime, player.airTime);
  }
  return { apex, airTime, launchSpeed };
}

function timeToRunSpeed() {
  const player = createPlayer(0, BASE);
  for (let i = 1; i < 600; i += 1) {
    stepPlayer(player, STEP, RUN, [BASE]);
    if (surfaceSpeed(player) >= RUN_SPEED) return i * STEP;
  }
  return Infinity;
}

function windowFor(speed) {
  return ((40 / DEGREES) * TOWER_RADIUS) / speed;
}

// Drop from just over the lip of a 40 deg ledge, once inside its arc and once
// well outside it.
function dropAt(theta, deck) {
  const player = createPlayer(0.4, null);
  player.grounded = false;
  player.vy = -1.4;
  player.theta = theta;
  for (let i = 0; i < 36; i += 1) stepPlayer(player, STEP, IDLE, [deck]);
  return player;
}

// A miss happens while you are already running, so the catch is measured from
// run speed, not from a standstill.
function catchGain() {
  const player = createPlayer(0, BASE);
  player.grounded = false;
  player.y = -6.2;
  player.vy = -13;
  player.omega = RUN_SPEED / TOWER_RADIUS;
  const event = stepPlayer(player, STEP, IDLE, [BASE]);
  return { caught: event.caught, player };
}

function keptSpin() {
  const player = createPlayer(0, BASE);
  player.omega = 2;
  for (let i = 0; i < 60; i += 1) stepPlayer(player, STEP, RUN, [BASE]);
  return surfaceSpeed(player);
}

// The gap designer needs this number; a jump that gains 2.8 m covers less arc
// than one that lands back on its own floor.
function nextFloorReach() {
  const upper = { floor: 1, top: FLOOR_HEIGHT, theta: 0, arc: Math.PI * 2 };
  const ledges = [BASE, upper];
  const player = createPlayer(0, BASE);
  for (let i = 0; i < 30; i += 1) stepPlayer(player, STEP, RUN, ledges);
  const from = player.theta;
  stepPlayer(player, STEP, { orbit: 1, jump: true, jumpHeld: true }, ledges);
  for (let i = 0; i < 300 && !player.grounded; i += 1) stepPlayer(player, STEP, RUN, ledges);
  return (player.theta - from) * DEGREES;
}

export function runSelfTest(cameraRoll) {
  const launch = timeToRunSpeed();
  const jump = airborneRun();
  const arc = ((jump.airTime * jump.launchSpeed) / TOWER_RADIUS) * DEGREES;
  const ledge = { floor: 0, top: 0, theta: 0, arc: (40 * Math.PI) / 180 };
  const offLedge = dropAt(1, ledge);
  const onLedge = dropAt(0.2, ledge);
  const caught = catchGain();
  const carried = keptSpin();
  const reach = nextFloorReach();

  return [
    {
      label: 'time to 7 m/s',
      expected: '<= 0.35 s',
      actual: launch.toFixed(3) + ' s',
      ok: launch <= 0.35,
    },
    {
      label: 'jump apex',
      expected: '3.6 +/- 0.1 m',
      actual: jump.apex.toFixed(3) + ' m',
      ok: Math.abs(jump.apex - 3.6) <= 0.1,
    },
    {
      label: 'airtime',
      expected: '0.98 +/- 0.02 s',
      actual: jump.airTime.toFixed(3) + ' s',
      ok: Math.abs(jump.airTime - 0.98) <= 0.02,
    },
    {
      label: 'arc per run jump',
      expected: '65 +/- 3 deg',
      actual: arc.toFixed(1) + ' deg',
      ok: Math.abs(arc - 65) <= 3,
    },
    {
      label: '40 deg window at run',
      expected: '0.55 - 0.65 s',
      actual: windowFor(RUN_SPEED).toFixed(3) + ' s',
      ok: windowFor(RUN_SPEED) >= 0.55 && windowFor(RUN_SPEED) <= 0.65,
    },
    {
      label: '40 deg window at top',
      expected: '0.30 - 0.34 s',
      actual: windowFor(TOP_SPEED).toFixed(3) + ' s',
      ok: windowFor(TOP_SPEED) >= 0.3 && windowFor(TOP_SPEED) <= 0.34,
    },
    {
      label: 'camera roll, full orbit',
      expected: '0.000 deg',
      actual: cameraRoll.toFixed(3) + ' deg',
      ok: Math.abs(cameraRoll) < 0.01,
    },
    {
      label: 'ledge holds inside arc',
      expected: 'grounded at 0 m',
      actual: onLedge.grounded ? onLedge.y.toFixed(2) + ' m' : 'falling',
      ok: onLedge.grounded && Math.abs(onLedge.y) < 0.01,
    },
    {
      label: 'ledge rejects outside arc',
      expected: 'still falling',
      actual: offLedge.grounded ? 'landed' : 'y ' + offLedge.y.toFixed(2) + ' m',
      ok: !offLedge.grounded && offLedge.y < -0.5,
    },
    {
      label: 'catch respawns with spin',
      expected: 'deck 0, 11 - 12.5 m/s, 1 fall',
      actual:
        caught.player.y.toFixed(2) +
        ' m, ' +
        surfaceSpeed(caught.player).toFixed(1) +
        ' m/s, ' +
        caught.player.falls,
      ok:
        caught.caught &&
        caught.player.grounded &&
        Math.abs(caught.player.y) < 1e-6 &&
        surfaceSpeed(caught.player) > 10.5 &&
        surfaceSpeed(caught.player) < 12.5 &&
        caught.player.falls === 1,
    },
    {
      label: 'spin kept above run',
      expected: '>= 11.9 m/s',
      actual: carried.toFixed(2) + ' m/s',
      ok: carried >= 11.9,
    },
    {
      label: 'reach to floor above',
      expected: '49 - 51 deg',
      actual: reach.toFixed(1) + ' deg',
      ok: reach >= 49 && reach <= 51,
    },
  ];
}
