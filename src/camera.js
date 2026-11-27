// origin: A

import { TOWER_RADIUS } from './player.js';

const BEHIND = 0.42;
const STANDOFF = 9.8;
const HEIGHT = 3.5;
const AIM = 1.1;
const FOV = 56;

export function createChaseCamera(aspect) {
  const camera = new THREE.PerspectiveCamera(FOV, aspect, 0.1, 500);
  camera.up.set(0, 1, 0);

  const radius = TOWER_RADIUS + STANDOFF;

  function resize(nextAspect) {
    camera.aspect = nextAspect;
    camera.updateProjectionMatrix();
  }

  function place(theta, height) {
    const behind = theta - BEHIND;
    camera.position.set(Math.sin(behind) * radius, height + HEIGHT, Math.cos(behind) * radius);
    camera.lookAt(Math.sin(theta) * TOWER_RADIUS, height + AIM, Math.cos(theta) * TOWER_RADIUS);
    camera.updateMatrixWorld();
  }

  // The horizon must stay level, so roll is measured rather than assumed.
  function roll() {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    return (Math.asin(Math.max(-1, Math.min(1, right.y))) * 180) / Math.PI;
  }

  return { camera, resize, place, roll };
}
