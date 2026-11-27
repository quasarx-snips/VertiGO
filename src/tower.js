// origin: A

import { FLOOR_HEIGHT, TOWER_RADIUS } from './player.js';
import { TAU, wrapAngle } from './vec.js';

const PLANK_RADIUS = TOWER_RADIUS + 0.62;
const PLANK_WIDTH = ((TAU * PLANK_RADIUS) / 26) * 1.07;
const PLANK_DEPTH = 1.6;
const PLANK_THICK = 0.32;
const DEG = Math.PI / 180;

// Hand laid route, clockwise. Each part is [arc, gap] in degrees and the gap is
// the empty stretch you have to clear before it. A full speed jump gains 2.8 m
// and about 50 deg, so gaps stay under 40; split floors use a 20 deg hop.
const ROUTE = [
  { floor: 1, parts: [[95, 30]] },
  { floor: 2, parts: [[85, 32]] },
  { floor: 3, parts: [[90, 30]] },
  {
    floor: 4,
    parts: [
      [45, 32],
      [40, 22],
    ],
  },
  { floor: 5, parts: [[75, 30]] },
  { floor: 6, parts: [[90, 34]] },
  {
    floor: 7,
    parts: [
      [40, 30],
      [38, 20],
    ],
  },
  { floor: 8, parts: [[80, 32]] },
  { floor: 9, parts: [[110, 34]] },
];

export function buildLedges() {
  const ledges = [{ floor: 0, theta: 0, arc: TAU, top: 0, depth: 1.8 }];
  let cursor = 20;

  for (const row of ROUTE) {
    for (const [arc, gap] of row.parts) {
      cursor += gap;
      ledges.push({
        floor: row.floor,
        theta: wrapAngle(cursor * DEG),
        arc: arc * DEG,
        top: row.floor * FLOOR_HEIGHT,
        depth: PLANK_DEPTH,
      });
      cursor += arc;
    }
  }

  return ledges;
}

// One draw call for every plank on the tower. The base deck is deeper than the
// ledges, so each instance scales on z to suit its deck.
export function addTower(scene, ledges, material) {
  const shape = new THREE.BoxGeometry(PLANK_WIDTH, PLANK_THICK, PLANK_DEPTH);
  const spots = [];

  for (const deck of ledges) {
    const count = Math.max(1, Math.round(deck.arc / (TAU / 26)));
    for (let index = 0; index < count; index += 1) {
      spots.push({
        theta: deck.theta + ((index + 0.5) * deck.arc) / count,
        top: deck.top,
        depth: deck.depth,
      });
    }
  }

  const planks = new THREE.InstancedMesh(shape, material, spots.length);
  const dummy = new THREE.Object3D();

  spots.forEach((spot, index) => {
    dummy.position.set(
      Math.sin(spot.theta) * PLANK_RADIUS,
      spot.top - PLANK_THICK / 2,
      Math.cos(spot.theta) * PLANK_RADIUS
    );
    dummy.rotation.set(0, spot.theta, 0);
    dummy.scale.set(1, 1, spot.depth / PLANK_DEPTH);
    dummy.updateMatrix();
    planks.setMatrixAt(index, dummy.matrix);
  });

  planks.instanceMatrix.needsUpdate = true;
  // Instanced bounds come from the single box, so let it stay visible always.
  planks.frustumCulled = false;
  scene.add(planks);

  const band = new THREE.Mesh(new THREE.TorusGeometry(TOWER_RADIUS + 0.5, 0.4, 8, 48), material);
  band.rotation.x = Math.PI / 2;
  band.position.y = -0.5;
  scene.add(band);

  return planks;
}
