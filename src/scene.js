// origin: A

import { FLOOR_HEIGHT, TOWER_RADIUS } from './player.js';

const SKY = 0x1b3a5c;
const HAZE = 0x2a4a66;
const SEA = 0x0d1f33;
const STONE = 0x2a3542;
const ICE = 0xdce9f5;
const SPARK = 0xeafbff;
const PLAYER_SHELL = 0.55;

const CAMERA_BEHIND = 0.42;
const CAMERA_STANDOFF = 11;
const CAMERA_HEIGHT = 4;
const CAMERA_AIM = 0.5;
const FIELD_OF_VIEW = 52;

export const RING_TOPS = [0, FLOOR_HEIGHT, FLOOR_HEIGHT * 2];

function ringGeometry(inner, outer, thickness) {
  const shape = new THREE.Shape();
  shape.absarc(0, 0, outer, 0, Math.PI * 2, false);
  const hole = new THREE.Path();
  hole.absarc(0, 0, inner, 0, Math.PI * 2, true);
  shape.holes.push(hole);
  const geometry = new THREE.ExtrudeGeometry(shape, {
    depth: thickness,
    bevelEnabled: false,
    curveSegments: 96,
  });
  geometry.rotateX(-Math.PI / 2);
  return geometry;
}

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;

  const scene = new THREE.Scene();
  scene.background = new THREE.Color(SKY);
  scene.fog = new THREE.Fog(HAZE, 26, 120);

  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 400);
  camera.up.set(0, 1, 0);

  scene.add(new THREE.HemisphereLight(0x9fc7e8, 0x0b1622, 0.62));
  const key = new THREE.DirectionalLight(0xffe9c4, 1.15);
  key.position.set(9, 18, 7);
  scene.add(key);

  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, 34, 64, 1, true),
    new THREE.MeshStandardMaterial({ color: STONE, roughness: 0.94, metalness: 0.02 })
  );
  tower.position.y = 13;
  scene.add(tower);

  const slabGeometry = ringGeometry(TOWER_RADIUS - 0.15, TOWER_RADIUS + 1.05, 0.35);
  const slabMaterial = new THREE.MeshStandardMaterial({
    color: ICE,
    roughness: 0.55,
    metalness: 0.08,
    emissive: 0x1d4058,
    emissiveIntensity: 0.35,
  });
  for (const top of RING_TOPS) {
    const slab = new THREE.Mesh(slabGeometry, slabMaterial);
    slab.position.y = top - 0.35;
    scene.add(slab);
  }

  const sea = new THREE.Mesh(
    new THREE.PlaneGeometry(420, 420),
    new THREE.MeshStandardMaterial({ color: SEA, roughness: 1, metalness: 0 })
  );
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -2.4;
  scene.add(sea);

  const spark = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({
      color: SPARK,
      emissive: 0x7cefff,
      emissiveIntensity: 2.4,
      roughness: 0.35,
      metalness: 0,
    })
  );
  scene.add(spark);

  const shell = TOWER_RADIUS + PLAYER_SHELL;

  function resize(width, height) {
    renderer.setSize(width, height, false);
    camera.aspect = width / height;
    camera.updateProjectionMatrix();
  }

  function place(theta, height) {
    spark.position.set(Math.sin(theta) * shell, height + 0.35, Math.cos(theta) * shell);

    const behind = theta - CAMERA_BEHIND;
    const radius = TOWER_RADIUS + CAMERA_STANDOFF;
    camera.position.set(
      Math.sin(behind) * radius,
      height + CAMERA_HEIGHT,
      Math.cos(behind) * radius
    );
    camera.lookAt(
      Math.sin(theta) * TOWER_RADIUS,
      height + CAMERA_AIM,
      Math.cos(theta) * TOWER_RADIUS
    );
    camera.updateMatrixWorld();
  }

  function cameraRoll() {
    const right = new THREE.Vector3().setFromMatrixColumn(camera.matrixWorld, 0);
    return (Math.asin(Math.max(-1, Math.min(1, right.y))) * 180) / Math.PI;
  }

  return {
    renderer,
    camera,
    rings: RING_TOPS.map((top) => ({ top })),
    resize,
    place,
    cameraRoll,
    render: () => renderer.render(scene, camera),
  };
}
