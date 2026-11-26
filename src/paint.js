// origin: A

const SEED = 20260417;

function mulberry32(seed) {
  let state = seed >>> 0;
  return function next() {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function surface(size) {
  const node = document.createElement('canvas');
  node.width = size;
  node.height = size;
  return node;
}

function finish(node, repeatX, repeatY) {
  const texture = new THREE.CanvasTexture(node);
  texture.wrapS = THREE.RepeatWrapping;
  texture.wrapT = THREE.RepeatWrapping;
  texture.repeat.set(repeatX, repeatY);
  texture.encoding = THREE.sRGBEncoding;
  texture.anisotropy = 4;
  return texture;
}

export function stoneTexture() {
  const size = 512;
  const node = surface(size);
  const ctx = node.getContext('2d');
  const roll = mulberry32(SEED);

  const wash = ctx.createLinearGradient(0, 0, 0, size);
  wash.addColorStop(0, '#eef2f4');
  wash.addColorStop(0.55, '#dfe6ea');
  wash.addColorStop(1, '#cfd9df');
  ctx.fillStyle = wash;
  ctx.fillRect(0, 0, size, size);

  for (let streak = 0; streak < 240; streak += 1) {
    const x = roll() * size;
    const width = 1 + roll() * 7;
    const shade = 130 + Math.floor(roll() * 60);
    const alpha = 0.07 + roll() * 0.16;
    ctx.fillStyle = 'rgba(' + shade + ',' + (shade + 8) + ',' + (shade + 14) + ',' + alpha + ')';
    ctx.fillRect(x, 0, width, size);
  }

  for (let joint = 0; joint < size; joint += 128) {
    ctx.fillStyle = 'rgba(112,126,134,0.22)';
    ctx.fillRect(0, joint, size, 2);
  }

  for (let grain = 0; grain < 2600; grain += 1) {
    const x = roll() * size;
    const y = roll() * size;
    ctx.fillStyle = roll() > 0.5 ? 'rgba(255,255,255,0.35)' : 'rgba(120,134,142,0.3)';
    ctx.fillRect(x, y, 1.4, 1.4);
  }

  const depth = ctx.createLinearGradient(0, size * 0.4, 0, size);
  depth.addColorStop(0, 'rgba(118,132,142,0)');
  depth.addColorStop(1, 'rgba(92,106,118,0.55)');
  ctx.fillStyle = depth;
  ctx.fillRect(0, 0, size, size);

  return finish(node, 3, 5);
}

export function plankTexture() {
  const size = 512;
  const node = surface(size);
  const ctx = node.getContext('2d');
  const roll = mulberry32(SEED + 7);

  ctx.fillStyle = '#7d4f33';
  ctx.fillRect(0, 0, size, size);

  for (let band = 0; band < 90; band += 1) {
    const y = roll() * size;
    const height = 1 + roll() * 5;
    const warm = 92 + Math.floor(roll() * 46);
    ctx.fillStyle =
      'rgba(' +
      warm +
      ',' +
      Math.floor(warm * 0.56) +
      ',' +
      Math.floor(warm * 0.3) +
      ',' +
      (0.18 + roll() * 0.3) +
      ')';
    ctx.fillRect(0, y, size, height);
  }

  for (let seam = 0; seam < size; seam += 128) {
    ctx.fillStyle = 'rgba(58,30,14,0.55)';
    ctx.fillRect(0, seam, size, 3);
    ctx.fillStyle = 'rgba(255,206,160,0.18)';
    ctx.fillRect(0, seam + 3, size, 2);
  }

  for (let knot = 0; knot < 5; knot += 1) {
    const cx = roll() * size;
    const cy = roll() * size;
    const radius = 5 + roll() * 9;
    const ring = ctx.createRadialGradient(cx, cy, 1, cx, cy, radius);
    ring.addColorStop(0, 'rgba(64,32,15,0.75)');
    ring.addColorStop(1, 'rgba(64,32,15,0)');
    ctx.fillStyle = ring;
    ctx.beginPath();
    ctx.arc(cx, cy, radius, 0, Math.PI * 2);
    ctx.fill();
  }

  return finish(node, 2, 1);
}

export function glowTexture() {
  const size = 128;
  const node = surface(size);
  const ctx = node.getContext('2d');
  const halo = ctx.createRadialGradient(size / 2, size / 2, 0, size / 2, size / 2, size / 2);
  halo.addColorStop(0, 'rgba(255,255,255,1)');
  halo.addColorStop(0.35, 'rgba(255,226,168,0.55)');
  halo.addColorStop(1, 'rgba(255,210,140,0)');
  ctx.fillStyle = halo;
  ctx.fillRect(0, 0, size, size);
  const texture = new THREE.CanvasTexture(node);
  texture.encoding = THREE.sRGBEncoding;
  return texture;
}
