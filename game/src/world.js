// Silent Gallery: the rules and the state, with no drawing and no browser
// in it. A level is a museum floor seen from above: walls and crates block
// movement and sight, bushes hide the player, dark tiles slow detection.
// Guards patrol waypoints with vision cones; step() advances one fixed step
// and returns what happened as bit flags, so the caller can react without
// the world knowing about screens or sound.
import { COLS, DETECTION, FIELD, GUARD, LIVES, PEBBLE, PLAYER, ROWS, TILE } from './config.js';

// Tiles: 0 open floor, 1 wall, 2 crate (cover), 3 bush (hiding), 4 dark floor.
const T_FLOOR = 0;
const T_WALL = 1;
const T_CRATE = 2;
const T_BUSH = 3;
const T_DARK = 4;

export const EVENT_RELIC = 1;
export const EVENT_ALERT = 2;
export const EVENT_CAUGHT = 4;
export const EVENT_LEVEL_CLEAR = 8;
export const EVENT_NOISE = 16;
export const EVENT_GAME_OVER = 32;
export const EVENT_VICTORY = 64;

function tileCenter(col, row) {
  return { x: col * TILE + TILE / 2, y: row * TILE + TILE / 2 };
}

function angleDifference(a, b) {
  let d = a - b;
  while (d > Math.PI) d -= Math.PI * 2;
  while (d < -Math.PI) d += Math.PI * 2;
  return d;
}

/**
 * The three museum floors. Each level names wall rectangles, crates, bushes
 * and dark patches by tile, plus the player's start, the exit, the relics
 * and every guard's patrol loop. The border walls are added by the builder.
 */
export const LEVELS = [
  {
    name: 'The Quiet Wing',
    walls: [[14, 1, 2, 3], [14, 16, 2, 3], [5, 4, 6, 1], [19, 4, 6, 1], [5, 14, 6, 1], [19, 14, 6, 1]],
    crates: [[7, 2], [22, 7], [7, 11], [22, 16], [12, 9], [17, 9]],
    bushes: [[2, 11], [27, 11]],
    dark: [[20, 1, 8, 3], [2, 15, 6, 3]],
    player: [2, 2],
    exit: [27, 17],
    relics: [[23, 2], [25, 16]],
    guards: [
      { waypoints: [[8, 6], [8, 12], [20, 12], [20, 6]] },
      { waypoints: [[24, 5], [24, 10], [15, 10], [15, 5]] },
    ],
  },
  {
    name: 'The Marble Hall',
    walls: [[9, 2, 2, 5], [19, 2, 2, 5], [9, 13, 2, 5], [19, 13, 2, 5], [14, 8, 2, 4]],
    crates: [[5, 9], [24, 9], [14, 3], [14, 16], [4, 16], [25, 3]],
    bushes: [[2, 9], [27, 9]],
    dark: [[2, 2, 5, 3], [23, 15, 5, 3]],
    player: [2, 17],
    exit: [27, 2],
    relics: [[15, 2], [27, 17], [4, 4]],
    guards: [
      { waypoints: [[7, 7], [7, 12], [22, 12], [22, 7]] },
      { waypoints: [[15, 4], [15, 15]] },
      { waypoints: [[25, 6], [25, 13], [12, 13], [12, 6]] },
    ],
  },
  {
    name: 'The Grand Vault',
    walls: [[7, 3, 2, 4], [21, 3, 2, 4], [7, 13, 2, 4], [21, 13, 2, 4], [14, 8, 2, 4]],
    crates: [[12, 6], [17, 6], [12, 13], [17, 13], [4, 9], [25, 9]],
    bushes: [[2, 9], [27, 9], [14, 16]],
    dark: [[12, 2, 6, 3], [12, 15, 6, 3]],
    player: [2, 2],
    exit: [27, 17],
    relics: [[15, 5], [15, 14], [27, 2]],
    guards: [
      { waypoints: [[5, 5], [5, 14], [24, 14], [24, 5]] },
      { waypoints: [[10, 3], [10, 16]] },
      { waypoints: [[19, 16], [19, 3]] },
      { waypoints: [[14, 6], [14, 13]] },
    ],
  },
];

function buildGrid(level) {
  const grid = new Uint8Array(COLS * ROWS);
  for (let col = 0; col < COLS; col += 1) {
    grid[col] = T_WALL;
    grid[(ROWS - 1) * COLS + col] = T_WALL;
  }
  for (let row = 0; row < ROWS; row += 1) {
    grid[row * COLS] = T_WALL;
    grid[row * COLS + COLS - 1] = T_WALL;
  }
  for (const [x, y, w, h] of level.walls) {
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) grid[row * COLS + col] = T_WALL;
    }
  }
  for (const [x, y, w, h] of level.dark) {
    for (let row = y; row < y + h; row += 1) {
      for (let col = x; col < x + w; col += 1) {
        if (grid[row * COLS + col] === T_FLOOR) grid[row * COLS + col] = T_DARK;
      }
    }
  }
  for (const [x, y] of level.crates) grid[y * COLS + x] = T_CRATE;
  for (const [x, y] of level.bushes) grid[y * COLS + x] = T_BUSH;
  return grid;
}

export function createWorld(random) {
  const state = {
    grid: null,
    levelIndex: 0,
    levelName: '',
    player: { x: 0, y: 0, radius: PLAYER.radius, sneaking: false, moving: false, facing: -Math.PI / 2 },
    guards: [],
    relics: [],
    exit: { x: 0, y: 0 },
    exitOpen: false,
    relicsTaken: 0,
    relicsTotal: 0,
    lives: LIVES,
    score: 0,
    pebbles: PEBBLE.perLevel,
    pebble: null,
    detection: 0,
    alert: false,
    elapsed: 0,
    levelTime: 0,
  };

  function tileAt(col, row) {
    if (col < 0 || col >= COLS || row < 0 || row >= ROWS) return T_WALL;
    return state.grid[row * COLS + col];
  }

  function isSolidTile(tile) {
    return tile === T_WALL || tile === T_CRATE;
  }

  function isSolidAtPixel(x, y) {
    return isSolidTile(tileAt(Math.floor(x / TILE), Math.floor(y / TILE)));
  }

  /** Slide a circle along one axis, stopping at solid tiles. */
  function moveCircle(body, dx, dy) {
    const radius = body.radius;
    if (dx !== 0) {
      const nextX = body.x + dx;
      const top = Math.floor((body.y - radius + 1) / TILE);
      const bottom = Math.floor((body.y + radius - 1) / TILE);
      const edge = dx > 0 ? Math.floor((nextX + radius) / TILE) : Math.floor((nextX - radius) / TILE);
      let blocked = false;
      for (let row = top; row <= bottom; row += 1) {
        if (isSolidTile(tileAt(edge, row))) {
          blocked = true;
          break;
        }
      }
      if (!blocked) body.x = nextX;
    }
    if (dy !== 0) {
      const nextY = body.y + dy;
      const left = Math.floor((body.x - radius + 1) / TILE);
      const right = Math.floor((body.x + radius - 1) / TILE);
      const edge = dy > 0 ? Math.floor((nextY + radius) / TILE) : Math.floor((nextY - radius) / TILE);
      let blocked = false;
      for (let col = left; col <= right; col += 1) {
        if (isSolidTile(tileAt(col, edge))) {
          blocked = true;
          break;
        }
      }
      if (!blocked) body.y = nextY;
    }
  }

  /** True when no wall, crate or bush stands between the two points. */
  function hasLineOfSight(x0, y0, x1, y1) {
    const dx = x1 - x0;
    const dy = y1 - y0;
    const distance = Math.hypot(dx, dy);
    if (distance < 1) return true;
    const steps = Math.ceil(distance / 6);
    for (let i = 1; i < steps; i += 1) {
      const t = i / steps;
      const tile = tileAt(Math.floor((x0 + dx * t) / TILE), Math.floor((y0 + dy * t) / TILE));
      if (tile === T_WALL || tile === T_CRATE || tile === T_BUSH) return false;
    }
    return true;
  }

  /** How visible the player is to one guard right now, 0 when unseen. */
  function guardVisibility(guard) {
    const player = state.player;
    const dx = player.x - guard.x;
    const dy = player.y - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance > GUARD.viewRange) return 0;
    const angleToPlayer = Math.atan2(dy, dx);
    if (Math.abs(angleDifference(angleToPlayer, guard.heading)) > GUARD.viewHalfAngle) return 0;
    if (!hasLineOfSight(guard.x, guard.y, player.x, player.y)) return 0;
    const playerTile = tileAt(Math.floor(player.x / TILE), Math.floor(player.y / TILE));
    if (playerTile === T_BUSH) {
      if (distance > DETECTION.bushBlindRange) return 0;
      return DETECTION.bushFactor;
    }
    let visibility = 1 - 0.6 * (distance / GUARD.viewRange);
    if (player.sneaking) visibility *= PLAYER.sneakVisibility;
    if (playerTile === T_DARK) visibility *= DETECTION.shadowFactor;
    return visibility;
  }

  function resetLevel(levelIndex) {
    const level = LEVELS[levelIndex];
    state.grid = buildGrid(level);
    state.levelIndex = levelIndex;
    state.levelName = level.name;
    const start = tileCenter(level.player[0], level.player[1]);
    state.player.x = start.x;
    state.player.y = start.y;
    state.player.sneaking = false;
    state.player.moving = false;
    const exit = tileCenter(level.exit[0], level.exit[1]);
    state.exit.x = exit.x;
    state.exit.y = exit.y;
    state.exitOpen = false;
    state.relics = level.relics.map(([col, row]) => {
      const centre = tileCenter(col, row);
      return { x: centre.x, y: centre.y, taken: false };
    });
    state.relicsTaken = 0;
    state.relicsTotal = state.relics.length;
    state.guards = level.guards.map((definition) => {
      const spawn = tileCenter(definition.waypoints[0][0], definition.waypoints[0][1]);
      const second = tileCenter(definition.waypoints[1][0], definition.waypoints[1][1]);
      return {
        x: spawn.x,
        y: spawn.y,
        radius: GUARD.radius,
        heading: Math.atan2(second.y - spawn.y, second.x - spawn.x),
        mode: 'patrol',
        waypoints: definition.waypoints.map(([col, row]) => tileCenter(col, row)),
        waypointIndex: 1,
        pauseTimer: 0,
        scanDirection: random() < 0.5 ? 1 : -1,
        scanTimer: 0,
        lastSeen: { x: spawn.x, y: spawn.y },
        memoryTimer: 0,
        searchTimer: 0,
        investigatePoint: null,
        investigateTimer: 0,
      };
    });
    state.pebbles = PEBBLE.perLevel;
    state.pebble = null;
    state.detection = 0;
    state.alert = false;
    state.levelTime = 0;
  }

  function reset() {
    state.lives = LIVES;
    state.score = 0;
    state.elapsed = 0;
    resetLevel(0);
  }

  function throwPebble(targetX, targetY) {
    if (state.pebbles <= 0 || state.pebble !== null) return false;
    const player = state.player;
    const dx = targetX - player.x;
    const dy = targetY - player.y;
    const distance = Math.hypot(dx, dy);
    const range = Math.min(distance, PEBBLE.throwRange);
    const scale = distance === 0 ? 0 : range / distance;
    state.pebble = {
      x: player.x,
      y: player.y,
      fromX: player.x,
      fromY: player.y,
      toX: player.x + dx * scale,
      toY: player.y + dy * scale,
      timer: 0,
      landed: false,
    };
    state.pebbles -= 1;
    return true;
  }

  function moveGuardToward(guard, targetX, targetY, speed, dt) {
    const dx = targetX - guard.x;
    const dy = targetY - guard.y;
    const distance = Math.hypot(dx, dy);
    if (distance < 3) return true;
    const stepLength = Math.min(distance, speed * dt);
    const wanted = Math.atan2(dy, dx);
    const turn = Math.max(-GUARD.turnSpeed * dt, Math.min(GUARD.turnSpeed * dt, angleDifference(wanted, guard.heading)));
    guard.heading += turn;
    moveCircle(guard, (dx / distance) * stepLength, (dy / distance) * stepLength);
    return distance - stepLength < 3;
  }

  function updateGuard(guard, dt, events) {
    const player = state.player;
    if (guard.mode === 'patrol') {
      const target = guard.waypoints[guard.waypointIndex];
      if (guard.pauseTimer > 0) {
        guard.pauseTimer -= dt;
        guard.scanTimer -= dt;
        if (guard.scanTimer <= 0) {
          guard.scanDirection *= -1;
          guard.scanTimer = 0.8;
        }
        guard.heading += guard.scanDirection * GUARD.turnSpeed * 0.45 * dt;
      } else if (moveGuardToward(guard, target.x, target.y, GUARD.patrolSpeed, dt)) {
        guard.waypointIndex = (guard.waypointIndex + 1) % guard.waypoints.length;
        guard.pauseTimer = GUARD.pauseAtWaypoint;
        guard.scanTimer = 0.8;
      }
      return events;
    }
    if (guard.mode === 'chase') {
      guard.lastSeen.x = player.x;
      guard.lastSeen.y = player.y;
      moveGuardToward(guard, player.x, player.y, GUARD.chaseSpeed, dt);
      const distance = Math.hypot(player.x - guard.x, player.y - guard.y);
      if (distance < DETECTION.catchRange) return events | EVENT_CAUGHT;
      const seen = guardVisibility(guard) > 0;
      if (seen) guard.memoryTimer = GUARD.chaseMemory;
      else {
        guard.memoryTimer -= dt;
        if (guard.memoryTimer <= 0) {
          guard.mode = 'search';
          guard.searchTimer = GUARD.searchTime;
        }
      }
      return events;
    }
    if (guard.mode === 'search') {
      if (!moveGuardToward(guard, guard.lastSeen.x, guard.lastSeen.y, GUARD.investigateSpeed, dt)) return events;
      guard.searchTimer -= dt;
      guard.heading += GUARD.turnSpeed * 0.7 * dt;
      if (guard.searchTimer <= 0) guard.mode = 'return';
      return events;
    }
    if (guard.mode === 'investigate') {
      if (guard.investigatePoint === null) {
        guard.mode = 'return';
        return events;
      }
      if (!moveGuardToward(guard, guard.investigatePoint.x, guard.investigatePoint.y, GUARD.investigateSpeed, dt)) return events;
      guard.investigateTimer -= dt;
      guard.heading += GUARD.turnSpeed * 0.7 * dt;
      if (guard.investigateTimer <= 0) guard.mode = 'return';
      return events;
    }
    // return: walk back to the nearest waypoint, then resume the patrol.
    let nearest = 0;
    let nearestDistance = Infinity;
    for (let i = 0; i < guard.waypoints.length; i += 1) {
      const d = Math.hypot(guard.waypoints[i].x - guard.x, guard.waypoints[i].y - guard.y);
      if (d < nearestDistance) {
        nearestDistance = d;
        nearest = i;
      }
    }
    if (moveGuardToward(guard, guard.waypoints[nearest].x, guard.waypoints[nearest].y, GUARD.returnSpeed, dt)) {
      guard.waypointIndex = (nearest + 1) % guard.waypoints.length;
      guard.mode = 'patrol';
      guard.pauseTimer = 0.5;
    }
    return events;
  }

  function step(dt, move, sneaking, throwTarget) {
    let events = 0;
    state.elapsed += dt;
    state.levelTime += dt;
    const player = state.player;
    player.sneaking = sneaking;
    const speed = sneaking ? PLAYER.sneakSpeed : PLAYER.walkSpeed;
    const moving = move.x !== 0 || move.y !== 0;
    player.moving = moving;
    if (moving) {
      player.facing = Math.atan2(move.y, move.x);
      moveCircle(player, move.x * speed * dt, move.y * speed * dt);
    }
    if (throwTarget !== null) {
      if (throwPebble(throwTarget.x, throwTarget.y)) events |= EVENT_NOISE;
    }

    // A thrown pebble flies, lands, and draws nearby guards to its spot.
    if (state.pebble !== null) {
      const pebble = state.pebble;
      pebble.timer += dt;
      const t = Math.min(1, pebble.timer / PEBBLE.flightTime);
      pebble.x = pebble.fromX + (pebble.toX - pebble.fromX) * t;
      pebble.y = pebble.fromY + (pebble.toY - pebble.fromY) * t;
      if (t >= 1 && !pebble.landed) {
        pebble.landed = true;
        for (const guard of state.guards) {
          const distance = Math.hypot(guard.x - pebble.x, guard.y - pebble.y);
          if (distance < PEBBLE.noiseRadius && guard.mode !== 'chase') {
            guard.mode = 'investigate';
            guard.investigatePoint = { x: pebble.x, y: pebble.y };
            guard.investigateTimer = PEBBLE.investigateTime;
          }
        }
        state.pebble = null;
      }
    }

    // Detection: the most suspicious guard sets the meter; it drains unseen.
    let seenBy = null;
    let bestVisibility = 0;
    for (const guard of state.guards) {
      const visibility = guardVisibility(guard);
      if (visibility > bestVisibility) {
        bestVisibility = visibility;
        seenBy = guard;
      }
    }
    if (bestVisibility > 0 && seenBy !== null) {
      const distance = Math.hypot(player.x - seenBy.x, player.y - seenBy.y);
      const rate = DETECTION.farRate + (DETECTION.fullRate - DETECTION.farRate) * (1 - distance / GUARD.viewRange);
      state.detection = Math.min(1, state.detection + rate * bestVisibility * dt);
      if (state.detection >= 1 && !state.alert) {
        state.alert = true;
        for (const guard of state.guards) {
          if (guardVisibility(guard) > 0) {
            guard.mode = 'chase';
            guard.memoryTimer = GUARD.chaseMemory;
          }
        }
        events |= EVENT_ALERT;
      }
    } else {
      state.detection = Math.max(0, state.detection - DETECTION.decayRate * dt);
    }
    if (state.alert && !state.guards.some((guard) => guard.mode === 'chase')) {
      state.alert = false;
      state.detection = 0;
    }

    for (const guard of state.guards) {
      events = updateGuard(guard, dt, events);
      if (events & EVENT_CAUGHT) break;
    }
    if (events & EVENT_CAUGHT) {
      state.lives -= 1;
      if (state.lives <= 0) return events | EVENT_GAME_OVER;
      resetLevel(state.levelIndex);
      return events;
    }

    // Relics: walking over one pockets it; the exit opens on the last one.
    for (const relic of state.relics) {
      if (!relic.taken && Math.hypot(player.x - relic.x, player.y - relic.y) < 22) {
        relic.taken = true;
        state.relicsTaken += 1;
        state.score += 100;
        events |= EVENT_RELIC;
        if (state.relicsTaken === state.relicsTotal) state.exitOpen = true;
      }
    }

    // The exit, once open, ends the level; the last level ends the game.
    if (state.exitOpen && Math.hypot(player.x - state.exit.x, player.y - state.exit.y) < 24) {
      state.score += 500 + Math.max(0, Math.round(300 - state.levelTime * 2));
      if (state.levelIndex + 1 >= LEVELS.length) return events | EVENT_VICTORY;
      resetLevel(state.levelIndex + 1);
      return events | EVENT_LEVEL_CLEAR;
    }
    return events;
  }

  // -- Helpers the screenshot staging uses (real rules, staged positions) --

  /** Breadth-first path over walkable tiles, from one tile to another. */
  function findPath(fromCol, fromRow, toCol, toRow) {
    const start = fromRow * COLS + fromCol;
    const goal = toRow * COLS + toCol;
    if (start === goal) return [[fromCol, fromRow]];
    const cameFrom = new Int32Array(COLS * ROWS).fill(-1);
    const queue = [start];
    cameFrom[start] = start;
    while (queue.length > 0) {
      const current = queue.shift();
      const col = current % COLS;
      const row = Math.floor(current / COLS);
      const neighbours = [[col + 1, row], [col - 1, row], [col, row + 1], [col, row - 1]];
      for (const [nextCol, nextRow] of neighbours) {
        if (nextCol < 0 || nextCol >= COLS || nextRow < 0 || nextRow >= ROWS) continue;
        const next = nextRow * COLS + nextCol;
        if (cameFrom[next] !== -1) continue;
        if (isSolidTile(tileAt(nextCol, nextRow))) continue;
        cameFrom[next] = current;
        if (next === goal) {
          const path = [[toCol, toRow]];
          let at = current;
          while (at !== start) {
            path.unshift([at % COLS, Math.floor(at / COLS)]);
            at = cameFrom[at];
          }
          return path;
        }
        queue.push(next);
      }
    }
    return null;
  }

  /** True when any guard's cone, with a clear line of sight, covers a tile. */
  function tileWatched(col, row) {
    const centre = tileCenter(col, row);
    for (const guard of state.guards) {
      const dx = centre.x - guard.x;
      const dy = centre.y - guard.y;
      if (Math.hypot(dx, dy) > GUARD.viewRange) continue;
      if (Math.abs(angleDifference(Math.atan2(dy, dx), guard.heading)) > GUARD.viewHalfAngle) continue;
      if (hasLineOfSight(guard.x, guard.y, centre.x, centre.y)) return true;
    }
    return false;
  }

  return {
    state,
    reset,
    resetLevel,
    step,
    throwPebble,
    tileAt,
    isSolidTile,
    isSolidAtPixel,
    hasLineOfSight,
    guardVisibility,
    findPath,
    tileWatched,
    tileCenter,
    levelCount: LEVELS.length,
    /** Stage a scene for a screenshot: put the player on a tile. */
    placePlayer(col, row) {
      const centre = tileCenter(col, row);
      state.player.x = centre.x;
      state.player.y = centre.y;
    },
    /** Stage a scene: set the detection meter (0 to 1). */
    setDetection(value) {
      state.detection = value;
    },
    /** Stage a scene: make one guard chase the player right now. */
    alertGuard(index) {
      const guard = state.guards[index];
      if (!guard) return;
      guard.mode = 'chase';
      guard.memoryTimer = GUARD.chaseMemory;
      state.alert = true;
      state.detection = 1;
    },
    /** Stage a scene: pocket every relic and open the exit. */
    openExit() {
      for (const relic of state.relics) relic.taken = true;
      state.relicsTaken = state.relicsTotal;
      state.exitOpen = true;
    },
  };
}
