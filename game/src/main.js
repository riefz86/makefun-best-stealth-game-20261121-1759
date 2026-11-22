// Silent Gallery: boot and the one loop. Input is read every frame, the
// world advances in fixed 1/60 s steps (several in a slow frame, none in a
// fast one), and the renderer paints what is there. The game moves between
// six screens: title, play, paused, wing cleared, caught and victory.
//
// ?seed=N fixes the guard pauses. ?shot=start|play|alert|win (with &seed=N)
// stages that scene instead of running the loop, paints it twice and sets
// window.__shotReady for a screenshot.
import { BEST_KEY, LIVES, STEP } from './config.js';
import { createRandom } from './random.js';
import { createWorld, EVENT_ALERT, EVENT_CAUGHT, EVENT_GAME_OVER, EVENT_LEVEL_CLEAR, EVENT_NOISE, EVENT_RELIC, EVENT_VICTORY } from './world.js';
import { ACTION_CONFIRM, ACTION_MUTE, ACTION_PAUSE, ACTION_RESTART, ACTION_THROW, createInput } from './input.js';
import { createAudio } from './audio.js';
import { createRenderer, SCREEN_CLEAR, SCREEN_OVER, SCREEN_PAUSED, SCREEN_PLAY, SCREEN_TITLE, SCREEN_VICTORY } from './render.js';
import { stageShot } from './shots.js';

/** The longest frame the loop catches up on; a longer stall is dropped. */
const MAX_FRAME = 0.25;

const params = new URLSearchParams(window.location.search);
const shot = params.get('shot');
const seedParam = Number.parseInt(params.get('seed') ?? '', 10);
const seed = Number.isInteger(seedParam) ? seedParam : Math.floor(Math.random() * 4294967296);

const canvas = document.getElementById('game');
const status = document.getElementById('status');
const world = createWorld(createRandom(seed));
const renderer = createRenderer(canvas);
const audio = createAudio();

function readBest() {
  try {
    return Number.parseInt(window.localStorage.getItem(BEST_KEY) ?? '0', 10) || 0;
  } catch {
    return 0;
  }
}

function saveBest(value) {
  try {
    window.localStorage.setItem(BEST_KEY, String(value));
  } catch {
    // Storage can be off (private windows): the best then lasts one visit.
  }
}

function runShot(name) {
  const scene = stageShot(name, world);
  window.__game = { world, screen: scene.screen };
  let painted = 0;
  function paint() {
    renderer.draw(world.state, scene.screen, scene.best, audio.isMuted(), performance.now() / 1000, world.hasLineOfSight);
    painted += 1;
    if (painted < 2) requestAnimationFrame(paint);
    else window.__shotReady = true;
  }
  requestAnimationFrame(paint);
}

function runGame() {
  const input = createInput(canvas);
  let screen = SCREEN_TITLE;
  let best = readBest();
  let accumulator = 0;
  let last = performance.now();

  window.addEventListener('keydown', () => audio.unlock());
  canvas.addEventListener('mousedown', () => audio.unlock());

  // Screen readers (and anyone watching the page's text) hear the changes.
  function announce(message) {
    status.textContent = message;
  }

  function startGame() {
    world.reset();
    accumulator = 0;
    screen = SCREEN_PLAY;
    announce(`Playing. ${LIVES} lives. Pocket every relic, then reach the exit.`);
  }

  function endGame() {
    screen = SCREEN_OVER;
    announce(`Caught. Score ${world.state.score}. Press Space to try again.`);
  }

  function handleEvents(events) {
    if (events & EVENT_RELIC) {
      audio.pickup();
      const left = world.state.relicsTotal - world.state.relicsTaken;
      announce(left === 0 ? 'Last relic. The exit is open.' : `Relic pocketed. ${left} left.`);
    }
    if (events & EVENT_ALERT) {
      audio.alert();
      announce('Spotted! A guard is chasing you. Break line of sight!');
    }
    if (events & EVENT_CAUGHT) audio.caught();
    if (events & EVENT_NOISE) audio.pebble();
    if (events & EVENT_LEVEL_CLEAR) {
      audio.levelClear();
      best = Math.max(best, world.state.levelIndex + 1);
      saveBest(best);
      screen = SCREEN_CLEAR;
      announce(`Wing cleared. Score ${world.state.score}. Press Space for the next wing.`);
    }
    if (events & EVENT_VICTORY) {
      audio.victory();
      best = Math.max(best, world.levelCount);
      saveBest(best);
      screen = SCREEN_VICTORY;
      announce(`You stole the whole gallery. Final score ${world.state.score}.`);
    }
    if (events & EVENT_GAME_OVER) endGame();
  }

  function handleActions() {
    const actions = input.takeActions();
    if (actions & ACTION_MUTE) {
      const muted = audio.toggleMute();
      announce(muted ? 'Sound off.' : 'Sound on.');
    }
    if (screen === SCREEN_TITLE || screen === SCREEN_OVER || screen === SCREEN_VICTORY) {
      if (actions & (ACTION_CONFIRM | ACTION_THROW)) startGame();
      return;
    }
    if (screen === SCREEN_CLEAR) {
      if (actions & ACTION_CONFIRM) {
        screen = SCREEN_PLAY;
        announce(`Wing ${world.state.levelIndex + 1}: ${world.state.levelName}.`);
      }
      return;
    }
    if (screen === SCREEN_PAUSED) {
      if (actions & (ACTION_PAUSE | ACTION_CONFIRM)) {
        screen = SCREEN_PLAY;
        announce('Playing.');
      } else if (actions & ACTION_RESTART) {
        world.resetLevel(world.state.levelIndex);
        screen = SCREEN_PLAY;
        announce('Wing restarted.');
      }
      return;
    }
    // SCREEN_PLAY
    if (actions & ACTION_PAUSE) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    } else if (actions & ACTION_RESTART) {
      world.resetLevel(world.state.levelIndex);
      announce('Wing restarted.');
    } else if (actions & ACTION_THROW) {
      const mouse = input.mouse();
      let target;
      if (mouse.inside) {
        target = renderer.toField(mouse.x, mouse.y);
      } else {
        // No mouse yet (keyboard-only play): throw ahead of where the player faces.
        const player = world.state.player;
        target = {
          x: player.x + Math.cos(player.facing) * 200,
          y: player.y + Math.sin(player.facing) * 200,
        };
      }
      const events = world.step(0, { x: 0, y: 0 }, input.sneaking(), target);
      handleEvents(events);
    }
  }

  function step() {
    if (screen === SCREEN_TITLE) {
      world.step(STEP, { x: 0, y: 0 }, false, null);
      return;
    }
    if (screen !== SCREEN_PLAY) return;
    const events = world.step(STEP, input.direction(), input.sneaking(), null);
    audio.step(world.state.player.moving, world.state.player.sneaking, STEP);
    handleEvents(events);
  }

  function frame(now) {
    requestAnimationFrame(frame);
    accumulator += Math.min((now - last) / 1000, MAX_FRAME);
    last = now;
    handleActions();
    if (screen === SCREEN_TITLE || screen === SCREEN_PLAY) {
      while (accumulator >= STEP && (screen === SCREEN_TITLE || screen === SCREEN_PLAY)) {
        step();
        accumulator -= STEP;
      }
    } else {
      accumulator = 0;
    }
    renderer.draw(world.state, screen, best, audio.isMuted(), now / 1000, world.hasLineOfSight);
  }

  // Leaving the tab pauses a running game rather than letting guards hunt unseen.
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && screen === SCREEN_PLAY) {
      screen = SCREEN_PAUSED;
      announce('Paused.');
    }
  });

  world.reset();
  window.__game = { world, get screen() { return screen; } };
  announce('Silent Gallery. Press Space or click to begin.');
  requestAnimationFrame(frame);
}

if (shot) runShot(shot);
else runGame();
