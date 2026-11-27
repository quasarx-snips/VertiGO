// origin: A

import { FLOOR_HEIGHT, TOWER_RADIUS } from './player.js';
import { glowTexture, plankTexture, stoneTexture } from './paint.js';
import { createShards } from './shards.js';

const SKY_TOP = 0x2e6a92;
const SKY_HORIZON = 0xffd3a0;
const SEA_DEEP = 0x14536f;
const SEA_LIGHT = 0x9fd0e2;
const SUN_TINT = 0xffe3b0;
const PLANK = 0x8b5a37;
const PLAYER_SHELL = 0.55;

const CAMERA_BEHIND = 0.42;
const CAMERA_STANDOFF = 13;
const CAMERA_HEIGHT = 4.6;
const CAMERA_AIM = 0.5;
const FIELD_OF_VIEW = 52;

const SUN_DIRECTION = new THREE.Vector3(0.72, 0.34, 0.4).normalize();
const PLANKS_PER_RING = 26;

export const FLOORS = 10;
export const RING_TOPS = Array.from({ length: FLOORS }, (_, index) => index * FLOOR_HEIGHT);

const SKY_VERTEX = `
varying vec3 vView;
void main() {
  vView = position;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
}
`;

const SKY_FRAGMENT = `
uniform vec3 topColor;
uniform vec3 horizonColor;
uniform vec3 sunColor;
uniform vec3 sunDirection;
varying vec3 vView;
void main() {
  vec3 dir = normalize(vView);
  float lift = pow(1.0 - clamp(dir.y, 0.0, 1.0), 2.6);
  vec3 color = mix(topColor, horizonColor, lift);
  float facing = max(dot(dir, sunDirection), 0.0);
  color += sunColor * pow(facing, 90.0) * 1.4;
  color += sunColor * pow(facing, 9.0) * 0.28;
  gl_FragColor = vec4(color, 1.0);
}
`;

const SEA_VERTEX = `
uniform float uTime;
varying vec2 vFlat;
varying float vSwell;
void main() {
  vec3 spot = position;
  float swell = sin(spot.x * 0.055 + uTime * 0.55) * 0.42;
  swell += sin(spot.y * 0.082 - uTime * 0.4) * 0.3;
  swell += sin((spot.x + spot.y) * 0.14 + uTime * 0.9) * 0.12;
  spot.z += swell;
  vFlat = spot.xy;
  vSwell = swell;
  gl_Position = projectionMatrix * modelViewMatrix * vec4(spot, 1.0);
}
`;

const SEA_FRAGMENT = `
uniform float uTime;
uniform vec3 deepColor;
uniform vec3 lightColor;
uniform vec3 sunColor;
uniform vec3 horizonColor;
uniform vec3 sunDirection;
varying vec2 vFlat;
varying float vSwell;

float grain(vec2 spot) {
  return fract(sin(dot(spot, vec2(127.1, 311.7))) * 43758.5453);
}

float glint(vec2 spot) {
  vec2 cell = floor(spot);
  vec2 offset = fract(spot) - 0.5;
  vec2 centre = (vec2(grain(cell + 19.0), grain(cell + 41.0)) - 0.5) * 0.62;
  float core = 1.0 - smoothstep(0.05, 0.17, length(offset - centre));
  return core * step(0.62, grain(cell)) * (0.3 + 0.7 * grain(cell + 7.0));
}

void main() {
  float reach = length(vFlat);
  vec3 color = mix(deepColor, lightColor, smoothstep(6.0, 110.0, reach) * 0.6);

  vec3 toCamera = normalize(cameraPosition - vec3(vFlat.x, 0.0, vFlat.y));
  vec3 bounce = reflect(-sunDirection, vec3(0.0, 1.0, 0.0));
  float aim = max(dot(toCamera, bounce), 0.0);

  vec2 spot = vFlat * 2.2 + vec2(uTime * 0.45, uTime * 0.28);
  float clump = 0.3 + 0.9 * smoothstep(0.3, 0.95, grain(floor(vFlat * 0.15) + 3.0));
  float twinkle = 0.6 + 0.4 * sin(uTime * 3.0 + grain(floor(spot) + 11.0) * 6.2832);
  float closeness = 1.0 - smoothstep(45.0, 150.0, reach);
  float fleck = glint(spot) * clump * twinkle * closeness;

  color += sunColor * (fleck * (0.45 + 1.2 * pow(aim, 6.0)) + pow(aim, 140.0) * 0.3);
  color = mix(color, horizonColor, smoothstep(70.0, 210.0, reach) * 0.95);
  gl_FragColor = vec4(color, 1.0);
}
`;

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
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = THREE.PCFSoftShadowMap;

  const scene = new THREE.Scene();
  scene.fog = new THREE.Fog(0xf0c8a2, 70, 300);

  const camera = new THREE.PerspectiveCamera(FIELD_OF_VIEW, 1, 0.1, 500);
  camera.up.set(0, 1, 0);

  const sky = new THREE.Mesh(
    new THREE.SphereGeometry(360, 32, 16),
    new THREE.ShaderMaterial({
      side: THREE.BackSide,
      depthWrite: false,
      uniforms: {
        topColor: { value: new THREE.Color(SKY_TOP) },
        horizonColor: { value: new THREE.Color(SKY_HORIZON) },
        sunColor: { value: new THREE.Color(SUN_TINT) },
        sunDirection: { value: SUN_DIRECTION },
      },
      vertexShader: SKY_VERTEX,
      fragmentShader: SKY_FRAGMENT,
    })
  );
  scene.add(sky);

  const glow = glowTexture();
  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(15, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6da, fog: false })
  );
  sun.position.copy(SUN_DIRECTION).multiplyScalar(300);
  scene.add(sun);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glow,
      color: 0xffdca8,
      transparent: true,
      blending: THREE.AdditiveBlending,
      depthWrite: false,
      fog: false,
    })
  );
  halo.position.copy(SUN_DIRECTION).multiplyScalar(292);
  halo.scale.set(150, 150, 1);
  scene.add(halo);

  scene.add(new THREE.HemisphereLight(0xd3e8f5, 0x2b5566, 0.72));
  const key = new THREE.DirectionalLight(0xffd2a1, 1.65);
  key.position.copy(SUN_DIRECTION).multiplyScalar(60);
  key.castShadow = true;
  key.shadow.mapSize.set(2048, 2048);
  key.shadow.camera.left = -30;
  key.shadow.camera.right = 30;
  key.shadow.camera.top = 30;
  key.shadow.camera.bottom = -30;
  key.shadow.camera.near = 10;
  key.shadow.camera.far = 200;
  key.shadow.bias = -0.0015;
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
  tower.castShadow = true;
  tower.receiveShadow = true;
  scene.add(tower);

  const plankMap = plankTexture();
  const plankMaterial = new THREE.MeshStandardMaterial({
    map: plankMap,
    color: PLANK,
    roughness: 0.82,
    metalness: 0,
  });
  const plankRadius = TOWER_RADIUS + 0.62;
  const plankWidth = ((2 * Math.PI * plankRadius) / PLANKS_PER_RING) * 1.07;
  const plankShape = new THREE.BoxGeometry(plankWidth, 0.32, 1.5);
  for (const top of RING_TOPS) {
    for (let index = 0; index < PLANKS_PER_RING; index += 1) {
      const angle = (index / PLANKS_PER_RING) * Math.PI * 2;
      const plank = new THREE.Mesh(plankShape, plankMaterial);
      plank.position.set(Math.sin(angle) * plankRadius, top - 0.16, Math.cos(angle) * plankRadius);
      plank.rotation.y = angle;
      plank.castShadow = true;
      plank.receiveShadow = true;
      scene.add(plank);
    }
  }

  const seaMaterial = new THREE.ShaderMaterial({
    uniforms: {
      uTime: { value: 0 },
      deepColor: { value: new THREE.Color(SEA_DEEP) },
      lightColor: { value: new THREE.Color(SEA_LIGHT) },
      sunColor: { value: new THREE.Color(SUN_TINT) },
      horizonColor: { value: new THREE.Color(SKY_HORIZON) },
      sunDirection: { value: SUN_DIRECTION },
    },
    vertexShader: SEA_VERTEX,
    fragmentShader: SEA_FRAGMENT,
  });
  const sea = new THREE.Mesh(new THREE.PlaneGeometry(620, 620, 90, 90), seaMaterial);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -2.4;
  scene.add(sea);

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
  spark.castShadow = true;
  scene.add(spark);

  const shards = createShards(RING_TOPS.map((top) => ({ top })));
  const shardShape = new THREE.OctahedronGeometry(0.32, 0);
  const shardMaterial = new THREE.MeshStandardMaterial({
    color: 0x5c2b06,
    emissive: 0xff8a1a,
    emissiveIntensity: 1.1,
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
    gem.castShadow = true;
    shard.gem = gem;
    scene.add(gem);
  }

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

  function render(elapsed = 0) {
    seaMaterial.uniforms.uTime.value = elapsed;
    for (const shard of shards) {
      shard.gem.visible = !shard.taken;
      shard.gem.rotation.y = elapsed * 1.4;
    }
    renderer.render(scene, camera);
  }

  return {
    renderer,
    camera,
    rings: RING_TOPS.map((top) => ({ top })),
    shards,
    resize,
    place,
    cameraRoll,
    render,
  };
}
