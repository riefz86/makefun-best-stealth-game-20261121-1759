// Keyboard and mouse input, read every frame: a direction vector, a sneak
// flag, and one-shot actions (confirm, pause, throw a pebble, restart, mute).
// The world never touches the DOM: it reads only what this module hands it.
export const ACTION_CONFIRM = 1;
export const ACTION_PAUSE = 2;
export const ACTION_THROW = 4;
export const ACTION_RESTART = 8;
export const ACTION_MUTE = 16;

const MOVE_KEYS = {
  KeyW: [0, -1], ArrowUp: [0, -1],
  KeyS: [0, 1], ArrowDown: [0, 1],
  KeyA: [-1, 0], ArrowLeft: [-1, 0],
  KeyD: [1, 0], ArrowRight: [1, 0],
};

export function createInput(canvas) {
  const held = new Set();
  let actions = 0;
  let mouse = { x: 0, y: 0, inside: false };

  function onKeyDown(event) {
    if (event.repeat) return;
    if (MOVE_KEYS[event.code]) {
      held.add(event.code);
      event.preventDefault();
      return;
    }
    if (event.code === 'Space' || event.code === 'Enter') {
      actions |= ACTION_CONFIRM;
      event.preventDefault();
    } else if (event.code === 'KeyP' || event.code === 'Escape') {
      actions |= ACTION_PAUSE;
    } else if (event.code === 'KeyQ') {
      actions |= ACTION_THROW;
    } else if (event.code === 'KeyR') {
      actions |= ACTION_RESTART;
    } else if (event.code === 'KeyM') {
      actions |= ACTION_MUTE;
    }
    if (event.code === 'ShiftLeft' || event.code === 'ShiftRight') held.add(event.code);
  }

  function onKeyUp(event) {
    held.delete(event.code);
  }

  function onMouseMove(event) {
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top, inside: true };
  }

  function onMouseDown(event) {
    if (event.button !== 0) return;
    const rect = canvas.getBoundingClientRect();
    mouse = { x: event.clientX - rect.left, y: event.clientY - rect.top, inside: true };
    actions |= ACTION_THROW;
  }

  function onBlur() {
    held.clear();
  }

  window.addEventListener('keydown', onKeyDown);
  window.addEventListener('keyup', onKeyUp);
  window.addEventListener('blur', onBlur);
  canvas.addEventListener('mousemove', onMouseMove);
  canvas.addEventListener('mousedown', onMouseDown);

  return {
    /** Normalised movement direction from the held keys, {x, y} in [-1, 1]. */
    direction() {
      let x = 0;
      let y = 0;
      for (const code of held) {
        const move = MOVE_KEYS[code];
        if (move) {
          x += move[0];
          y += move[1];
        }
      }
      if (x === 0 && y === 0) return { x: 0, y: 0 };
      const length = Math.hypot(x, y);
      return { x: x / length, y: y / length };
    },
    /** True while either Shift key is held: the player sneaks. */
    sneaking() {
      return held.has('ShiftLeft') || held.has('ShiftRight');
    },
    /** The mouse position in canvas pixels, for aiming a pebble throw. */
    mouse() {
      return mouse;
    },
    /** One-shot actions since the last call; each is reported once. */
    takeActions() {
      const taken = actions;
      actions = 0;
      return taken;
    },
  };
}
