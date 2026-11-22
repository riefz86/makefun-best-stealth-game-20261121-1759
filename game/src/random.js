// A small seeded random source, so a seed always deals the same world:
// the same guard pauses, the same patrol jitter, the same screenshot.
export function createRandom(seed) {
  let state = (seed >>> 0) || 1;
  return function random() {
    state ^= state << 13;
    state ^= state >>> 17;
    state ^= state << 5;
    state >>>= 0;
    return state / 4294967296;
  };
}

/** An integer in [min, max) from a random source. */
export function randomInt(random, min, max) {
  return min + Math.floor(random() * (max - min));
}
