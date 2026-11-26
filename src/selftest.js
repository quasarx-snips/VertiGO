// origin: A

import {
  RUN_SPEED,
  TOP_SPEED,
  TOWER_RADIUS,
  createPlayer,
  stepPlayer,
  surfaceSpeed,
} from './player.js';

const STEP = 1 / 120;
const FLOOR = [{ top: 0 }];
const DEGREES = 180 / Math.PI;

function airborneRun() {
  const player = createPlayer(0);
  let apex = 0;
  let airTime = 0;
  let launchSpeed = 0;
  for (let i = 0; i < 192; i += 1) {
    const time = i * STEP;
    const controls = { orbit: 1, jump: time < STEP, jumpHeld: !player.grounded || time < STEP };
    if (!player.grounded) launchSpeed = Math.max(launchSpeed, surfaceSpeed(player));
    stepPlayer(player, STEP, controls, FLOOR);
    apex = Math.max(apex, player.y);
    airTime = Math.max(airTime, player.airTime);
  }
  return { apex, airTime, launchSpeed };
}

function timeToRunSpeed() {
  const player = createPlayer(0);
  const controls = { orbit: 1, jump: false, jumpHeld: false };
  for (let i = 1; i < 600; i += 1) {
    stepPlayer(player, STEP, controls, FLOOR);
    if (surfaceSpeed(player) >= RUN_SPEED) return i * STEP;
  }
  return Infinity;
}

function windowFor(speed) {
  return ((40 / DEGREES) * TOWER_RADIUS) / speed;
}

export function runSelfTest(cameraRoll) {
  const launch = timeToRunSpeed();
  const jump = airborneRun();
  const arc = ((jump.airTime * jump.launchSpeed) / TOWER_RADIUS) * DEGREES;
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
  ];
}

export function renderSelfTest(rows) {
  const target = document.getElementById('test-output');
  const failures = rows.filter((row) => !row.ok).length;
  const body = rows.map(
    (row) =>
      '<tr class="' +
      (row.ok ? 'pass' : 'fail') +
      '"><td>' +
      row.label +
      '</td><td>' +
      row.expected +
      '</td><td>' +
      row.actual +
      '</td><td>' +
      (row.ok ? 'pass' : 'FAIL') +
      '</td></tr>'
  );
  target.innerHTML =
    '<h1>VertiGO day 1 &#183; simulation constants</h1>' +
    '<table><thead><tr><th>measure</th><th>brief</th><th>measured</th><th></th></tr></thead><tbody>' +
    body.join('') +
    '</tbody></table><p>' +
    (rows.length - failures) +
    ' / ' +
    rows.length +
    ' hold</p>';
  target.hidden = false;
  return failures;
}
