// origin: A

import { createChaseCamera } from './camera.js';
import { glowTexture, plankTexture, shadowTexture, stoneTexture } from './paint.js';
import { FLOOR_HEIGHT, TOWER_RADIUS, onDeck } from './player.js';
import { createShards } from './shards.js';
import { addSea, addSky } from './sky.js';
import { addTower, buildLedges } from './tower.js';

const PLANK = 0x8b5a37;
const PLAYER_SHELL = 0.55;
const DISC_RADIUS = TOWER_RADIUS + 0.8;
const CATCH_LOOK = 7;

export const FLOORS = 10;

export function createScene(canvas) {
  const renderer = new THREE.WebGLRenderer({
    canvas,
    antialias: true,
    powerPreference: 'high-performance',
  });
  renderer.setPixelRatio(Math.min(devicePixelRatio, 2));
  renderer.outputEncoding = THREE.sRGBEncoding;
  renderer.toneMapping = THREE.ACESFilmicToneMapping;
  renderer.toneMappingExposure = 1.12;
  // Blob sprites do the grounding now; a 2048 shadow map cost more than it added.
  renderer.shadowMap.enabled = false;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf0c8a2, 70, 300);

  const sky = addSky(scene);
  const sea = addSea(scene);

  scene.add(new THREE.HemisphereLight(0xd3e8f5, 0x2b5566, 0.72));
  const key = new THREE.DirectionalLight(0xffd2a1, 1.65);
  key.position.copy(sky.sunDirection).multiplyScalar(60);
  scene.add(key);
  const fill = new THREE.DirectionalLight(0x9dc4dc, 0.35);
  fill.position.set(-24, 18, -30);
  scene.add(fill);

  const towerHeight = FLOOR_HEIGHT * FLOORS + 8;
  const tower = new THREE.Mesh(
    new THREE.CylinderGeometry(TOWER_RADIUS, TOWER_RADIUS, towerHeight, 64, 1, true),
    new THREE.MeshStandardMaterial({ map: stoneTexture(), roughness: 0.88, metalness: 0 })
  );
  tower.position.y = towerHeight / 2 - 4;
  scene.add(tower);

  const ledges = buildLedges();
  addTower(
    scene,
    ledges,
    new THREE.MeshStandardMaterial({
      map: plankTexture(),
      color: PLANK,
      roughness: 0.82,
      metalness: 0,
    })
  );

  const shards = createShards(ledges);
  const shardShape = new THREE.OctahedronGeometry(0.32, 0);
  const shardMaterial = new THREE.MeshStandardMaterial({
    color: 0xeafbff,
    emissive: 0xffb45c,
    emissiveIntensity: 0.9,
    roughness: 0.25,
    metalness: 0.1,
  });
  const shardShell = TOWER_RADIUS + 0.42;

  for (const shard of shards) {
    const gem = new THREE.Mesh(shardShape, shardMaterial);
    gem.position.set(
      Math.sin(shard.theta) * shardShell,
      shard.y,
      Math.cos(shard.theta) * shardShell
    );
    shard.gem = gem;
    scene.add(gem);
  }

  const spark = new THREE.Mesh(
    new THREE.IcosahedronGeometry(0.42, 0),
    new THREE.MeshStandardMaterial({
      color: 0xfffaf0,
      emissive: 0xffb45c,
      emissiveIntensity: 1.6,
      roughness: 0.3,
      metalness: 0,
    })
  );
  scene.add(spark);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
      color: 0x5fe8ff,
      transparent: true,
      opacity: 0.7,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
    })
  );
  halo.scale.set(1.7, 1.7, 1);
  scene.add(halo);

  const disc = new THREE.Mesh(
    new THREE.RingGeometry(0.3, 0.52, 28),
    new THREE.MeshBasicMaterial({
      color: 0x5fe8ff,
      transparent: true,
      opacity: 0.42,
      side: THREE.DoubleSide,
      depthWrite: false,
    })
  );
  disc.rotation.x = -Math.PI / 2;
  scene.add(disc);

  const shadow = new THREE.Mesh(
    new THREE.PlaneGeometry(1.9, 1.9),
    new THREE.MeshBasicMaterial({
      map: shadowTexture(),
      transparent: true,
      opacity: 0.85,
      depthWrite: false,
    })
  );
  shadow.rotation.x = -Math.PI / 2;
  scene.add(shadow);

  const chase = createChaseCamera(1);
  const shell = TOWER_RADIUS + PLAYER_SHELL;

  function deckBelow(theta, height) {
    let found = null;
    for (const deck of ledges) {
      if (deck.top > height + 0.05) continue;
      if (height - deck.top > CATCH_LOOK) continue;
      if (!onDeck(deck, theta)) continue;
      if (found === null || deck.top > found.top) found = deck;
    }
    return found;
  }

  function resize(width, height) {
    renderer.setSize(width, height, false);
    chase.resize(width / height);
  }

  function place(theta, height) {
    spark.position.set(Math.sin(theta) * shell, height + 0.35, Math.cos(theta) * shell);
    halo.position.copy(spark.position);

    const deck = deckBelow(theta, height);
    disc.visible = deck !== null;
    shadow.visible = deck !== null;

    if (deck) {
      const x = Math.sin(theta) * DISC_RADIUS;
      const z = Math.cos(theta) * DISC_RADIUS;
      disc.position.set(x, deck.top + 0.04, z);
      shadow.position.set(x, deck.top + 0.05, z);
    }

    chase.place(theta, height);
  }

  function render(elapsed = 0) {
    sea.uniforms.uTime.value = elapsed;

    for (const shard of shards) {
      shard.gem.visible = !shard.taken;
      shard.gem.rotation.y = elapsed * 1.4;
      shard.gem.position.y = shard.y + Math.sin(elapsed * 2 + shard.theta) * 0.09;
    }

    disc.scale.setScalar(1 + Math.sin(elapsed * 6) * 0.06);
    halo.scale.setScalar(1.7 + Math.sin(elapsed * 8) * 0.12);
    renderer.render(scene, chase.camera);
  }

  return {
    renderer,
    camera: chase.camera,
    ledges,
    floors: FLOORS,
    shards,
    resize,
    place,
    cameraRoll: chase.roll,
    render,
  };
}
