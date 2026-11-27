// origin: A

import { wrapDelta } from './vec.js';

const REACH = 0.7;
const LIFT = 0.55;
const SHARD_FLOORS = [1, 3, 5, 7, 9];

export function createShards(ledges) {
  const shards = [];

  for (const floor of SHARD_FLOORS) {
    const deck = ledges.find((entry) => entry.floor === floor);
    if (!deck) continue;
    shards.push({ theta: deck.theta + deck.arc / 2, y: deck.top + LIFT, taken: false });
  }

  return shards;
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
