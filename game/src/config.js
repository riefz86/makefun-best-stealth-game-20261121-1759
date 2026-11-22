// Silent Gallery: shared tuning numbers for the whole game.
// One place for every speed, range and rate, so a level or a balance tweak
// never means hunting through the rules or the renderer.
export const TILE = 32;
export const COLS = 30;
export const ROWS = 20;
export const FIELD = { width: COLS * TILE, height: ROWS * TILE };

/** Fixed step the world advances in; the loop runs several per frame. */
export const STEP = 1 / 60;

export const PLAYER = {
  radius: 11,
  walkSpeed: 150,
  sneakSpeed: 82,
  /** How much slower a sneaking player is spotted (multiplies detection). */
  sneakVisibility: 0.55,
};

export const GUARD = {
  radius: 12,
  patrolSpeed: 58,
  chaseSpeed: 168,
  investigateSpeed: 95,
  returnSpeed: 80,
  /** How far a guard can see, in pixels. */
  viewRange: 175,
  /** Half of the vision cone's angle, in radians. */
  viewHalfAngle: 0.61,
  /** Seconds a guard keeps chasing after losing sight of the player. */
  chaseMemory: 3.5,
  /** Seconds a guard searches the last seen spot before giving up. */
  searchTime: 3,
  /** Seconds a guard stands at each waypoint, looking around. */
  pauseAtWaypoint: 1.6,
  /** How fast a guard turns toward a new heading, radians per second. */
  turnSpeed: 4.5,
};

export const DETECTION = {
  /** Detection gained per second when the player is fully visible, close up. */
  fullRate: 1.5,
  /** Detection gained per second at the far edge of a vision cone. */
  farRate: 0.55,
  /** Detection lost per second while no guard sees the player. */
  decayRate: 0.45,
  /** Visibility multiplier while the player stands on a dark tile. */
  shadowFactor: 0.5,
  /** Visibility multiplier while the player hides in a bush. */
  bushFactor: 0.12,
  /** Beyond this distance a player in a bush is not seen at all. */
  bushBlindRange: 55,
  /** How close a guard must be to catch the player while chasing. */
  catchRange: 20,
};

export const PEBBLE = {
  /** Pebbles carried at the start of each level. */
  perLevel: 3,
  /** How far a thrown pebble flies toward its target, in pixels. */
  throwRange: 260,
  /** Seconds a pebble takes to land after it is thrown. */
  flightTime: 0.35,
  /** Guards inside this radius of the landing spot come to look. */
  noiseRadius: 230,
  /** Seconds a guard investigates a pebble's landing spot. */
  investigateTime: 3.5,
};

export const LIVES = 3;
export const BEST_KEY = 'silent-gallery-best-level';
export const LEVEL_NAMES = ['The Quiet Wing', 'The Marble Hall', 'The Grand Vault'];
