// origin: A

import { glowTexture } from './paint.js';

const SKY_TOP = 0x2e6a92;
const SKY_HORIZON = 0xffd3a0;
const SEA_DEEP = 0x14536f;
const SEA_LIGHT = 0x9fd0e2;
const SUN_TINT = 0xffe3b0;

export const SUN_DIRECTION = new THREE.Vector3(0.72, 0.34, 0.4).normalize();

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

export function addSky(scene) {
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

  const sun = new THREE.Mesh(
    new THREE.SphereGeometry(15, 24, 16),
    new THREE.MeshBasicMaterial({ color: 0xfff6da, fog: false })
  );
  sun.position.copy(SUN_DIRECTION).multiplyScalar(300);
  scene.add(sun);

  const halo = new THREE.Sprite(
    new THREE.SpriteMaterial({
      map: glowTexture(),
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

  return { sunDirection: SUN_DIRECTION };
}

export function addSea(scene) {
  const material = new THREE.ShaderMaterial({
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

  const sea = new THREE.Mesh(new THREE.PlaneGeometry(620, 620, 90, 90), material);
  sea.rotation.x = -Math.PI / 2;
  sea.position.y = -2.4;
  scene.add(sea);

  return material;
}
