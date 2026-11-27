// origin: A

import { wrapDelta } from './vec.js';

const REACH = 0.7;
const LIFT = 2;

export function createShards(rings) {
  return rings.map((ring, index) => ({ theta: index * 2.4, y: ring.top + LIFT, taken: false }));
}

export function takeShard(shards, theta, y, radius) {
  for (const shard of shards) {
    if (shard.taken) continue;
    const around = Math.abs(wrapDelta(shard.theta, theta)) * radius;
    if (around < REACH && Math.abs(shard.y - y) < REACH) {
      shard.taken = true;
      return true;
    }
  }
  return false;
}

export function clearShards(shards) {
  for (const shard of shards) shard.taken = false;
}
