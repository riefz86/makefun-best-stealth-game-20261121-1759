// The screenshot scenes behind ?shot=start|play|alert|win. Each one plays
// the real rules forward from a fresh world for a fixed number of steps,
// steered by a simple autopilot: breadth-first path to the nearest relic
// (then the exit), waiting in cover while the next tile sits inside a
// guard's vision cone, so the frame is what a short game really looks like
// and the same seed always gives the same frame.
import { STEP } from './config.js';
import { EVENT_CAUGHT, EVENT_LEVEL_CLEAR, EVENT_VICTORY } from './world.js';
import { SCREEN_CLEAR, SCREEN_PLAY, SCREEN_TITLE } from './render.js';

const START_SECONDS = 5;
const PLAY_SECONDS = 26;
const WIN_LIMIT_SECONDS = 110;
const SAMPLE = STEP;

/** The autopilot's current plan: a tile path and where it is along it. */
function createPilot(world) {
  return {
    path: null,
    pathIndex: 0,
    waitTimer: 0,
    replanTimer: 0,
    target: null,
    targetKey: '',
  };
}

function planTarget(world, pilot) {
  const state = world.state;
  let target = null;
  let targetKey = '';
  for (const relic of state.relics) {
    if (relic.taken) continue;
    target = relic;
    targetKey = `relic-${relic.x}-${relic.y}`;
    break;
  }
  if (target === null) {
    target = state.exit;
    targetKey = 'exit';
  }
  if (targetKey !== pilot.targetKey) {
    pilot.target = target;
    pilot.targetKey = targetKey;
    pilot.path = null;
  }
}

/** One autopilot step: the movement direction for this fixed step. */
function autopilot(world, pilot, dt) {
  const state = world.state;
  planTarget(world, pilot);
  pilot.replanTimer -= dt;
  const playerCol = Math.floor(state.player.x / 32);
  const playerRow = Math.floor(state.player.y / 32);
  const targetCol = Math.floor(pilot.target.x / 32);
  const targetRow = Math.floor(pilot.target.y / 32);
  if (pilot.path === null || pilot.replanTimer <= 0) {
    pilot.path = world.findPath(playerCol, playerRow, targetCol, targetRow);
    pilot.pathIndex = 0;
    pilot.replanTimer = 0.5;
  }
  if (pilot.path === null || pilot.path.length === 0) return { x: 0, y: 0, sneak: true };
  while (pilot.pathIndex < pilot.path.length - 1) {
    const [nextCol, nextRow] = pilot.path[pilot.pathIndex + 1];
    const centre = world.tileCenter(nextCol, nextRow);
    if (Math.hypot(centre.x - state.player.x, centre.y - state.player.y) < 6) pilot.pathIndex += 1;
    else break;
  }
  const [nextCol, nextRow] = pilot.path[Math.min(pilot.pathIndex + 1, pilot.path.length - 1)];
  // Wait in cover while the next tile is watched; after a long wait, risk it.
  if (world.tileWatched(nextCol, nextRow)) {
    pilot.waitTimer += dt;
    if (pilot.waitTimer < 4) return { x: 0, y: 0, sneak: true };
  } else {
    pilot.waitTimer = 0;
  }
  const centre = world.tileCenter(nextCol, nextRow);
  const dx = centre.x - state.player.x;
  const dy = centre.y - state.player.y;
  const distance = Math.hypot(dx, dy);
  if (distance < 2) return { x: 0, y: 0, sneak: false };
  const sneak = world.tileWatched(nextCol, nextRow) || world.tileWatched(playerCol, playerRow);
  return { x: dx / distance, y: dy / distance, sneak };
}

/** Run the autopilot for up to `seconds`, returning the events it raised. */
function runPilot(world, seconds) {
  const pilot = createPilot(world);
  let events = 0;
  const steps = Math.floor(seconds / SAMPLE);
  for (let index = 0; index < steps; index += 1) {
    const move = autopilot(world, pilot, SAMPLE);
    events |= world.step(SAMPLE, { x: move.x, y: move.y }, move.sneak, null);
    if (events & (EVENT_LEVEL_CLEAR | EVENT_VICTORY)) break;
  }
  return events;
}

/**
 * Set `world` to the named scene (start, play, alert or win) and return the
 * screen to draw over it and the best level to show.
 */
export function stageShot(name, world) {
  world.reset();
  if (name !== 'play' && name !== 'alert' && name !== 'win') {
    for (let index = 0; index < START_SECONDS / SAMPLE; index += 1) {
      world.step(SAMPLE, { x: 0, y: 0 }, false, null);
    }
    return { screen: SCREEN_TITLE, best: 0 };
  }
  if (name === 'alert') {
    runPilot(world, 6);
    // Step into the first guard's cone: stand ahead of where he looks,
    // far enough that the chase has begun but not yet caught the player.
    const guard = world.state.guards[0];
    const aheadX = guard.x + Math.cos(guard.heading) * 140;
    const aheadY = guard.y + Math.sin(guard.heading) * 140;
    const col = Math.floor(aheadX / 32);
    const row = Math.floor(aheadY / 32);
    if (!world.isSolidTile(world.tileAt(col, row))) world.placePlayer(col, row);
    world.setDetection(0.95);
    world.alertGuard(0);
    for (let index = 0; index < 6; index += 1) {
      world.step(SAMPLE, { x: 0, y: 0 }, false, null);
    }
    return { screen: SCREEN_PLAY, best: 0 };
  }
  if (name === 'win') {
    const events = runPilot(world, WIN_LIMIT_SECONDS);
    if (!(events & (EVENT_LEVEL_CLEAR | EVENT_VICTORY))) {
      // The pilot ran out of time: stage the finish through the real rules.
      world.openExit();
      const exitCol = Math.floor(world.state.exit.x / 32);
      const exitRow = Math.floor(world.state.exit.y / 32);
      world.placePlayer(exitCol, exitRow - 1);
      for (let index = 0; index < 240; index += 1) {
        const moveEvents = world.step(SAMPLE, { x: 0, y: 1 }, false, null);
        if (moveEvents & (EVENT_LEVEL_CLEAR | EVENT_VICTORY)) break;
      }
    }
    return { screen: SCREEN_CLEAR, best: 1 };
  }
  runPilot(world, PLAY_SECONDS);
  return { screen: SCREEN_PLAY, best: 0 };
}
