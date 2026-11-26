// origin: A

export const TAU = Math.PI * 2;

export function wrapAngle(angle) {
  const wrapped = angle % TAU;
  return wrapped < 0 ? wrapped + TAU : wrapped;
}

export function wrapDelta(target, from) {
  let delta = (target - from) % TAU;
  if (delta > Math.PI) delta -= TAU;
  if (delta < -Math.PI) delta += TAU;
  return delta;
}

export function approach(current, target, maxDelta) {
  const gap = target - current;
  if (Math.abs(gap) <= maxDelta) return target;
  return current + Math.sign(gap) * maxDelta;
}
