// Procedural sound, made with the Web Audio API and no audio files:
// short tones for footsteps, pickups, alarms and wins. Nothing plays until
// the player first presses a key or clicks, which is when the browser lets
// an AudioContext start; in a screenshot run there is no gesture, so every
// call is a safe no-op until then.
export function createAudio() {
  let context = null;
  let muted = false;
  let stepTimer = 0;

  function ensure() {
    if (context !== null) return context;
    try {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      context = new AudioContextClass();
    } catch {
      context = null;
    }
    return context;
  }

  function tone(frequency, duration, type, volume, when = 0, slideTo = null) {
    if (muted) return;
    const audio = ensure();
    if (audio === null) return;
    try {
      const start = audio.currentTime + when;
      const oscillator = audio.createOscillator();
      const gain = audio.createGain();
      oscillator.type = type;
      oscillator.frequency.setValueAtTime(frequency, start);
      if (slideTo !== null) oscillator.frequency.exponentialRampToValueAtTime(slideTo, start + duration);
      gain.gain.setValueAtTime(0.0001, start);
      gain.gain.exponentialRampToValueAtTime(volume, start + 0.012);
      gain.gain.exponentialRampToValueAtTime(0.0001, start + duration);
      oscillator.connect(gain);
      gain.connect(audio.destination);
      oscillator.start(start);
      oscillator.stop(start + duration + 0.05);
    } catch {
      // Sound is garnish: a browser that refuses it never stops the game.
    }
  }

  return {
    /** Call from any key or click handler so the context may start. */
    unlock() {
      ensure();
    },
    toggleMute() {
      muted = !muted;
      return muted;
    },
    isMuted() {
      return muted;
    },
    /** A soft footstep tick, throttled by the caller through the timer. */
    step(moving, sneaking, delta) {
      stepTimer -= delta;
      if (!moving || stepTimer > 0) return;
      stepTimer = sneaking ? 0.42 : 0.3;
      tone(140 + Math.random() * 40, 0.05, 'sine', sneaking ? 0.015 : 0.035);
    },
    pickup() {
      tone(660, 0.12, 'sine', 0.08);
      tone(990, 0.18, 'sine', 0.08, 0.09);
    },
    alert() {
      tone(220, 0.28, 'sawtooth', 0.07, 0, 440);
      tone(220, 0.28, 'sawtooth', 0.07, 0.3, 440);
    },
    caught() {
      tone(392, 0.22, 'triangle', 0.09, 0, 196);
      tone(196, 0.4, 'triangle', 0.09, 0.2, 98);
    },
    pebble() {
      tone(1200, 0.05, 'square', 0.04);
      tone(900, 0.07, 'square', 0.03, 0.32);
    },
    levelClear() {
      tone(523, 0.14, 'sine', 0.08);
      tone(659, 0.14, 'sine', 0.08, 0.12);
      tone(784, 0.26, 'sine', 0.09, 0.24);
    },
    victory() {
      const notes = [523, 659, 784, 1047];
      notes.forEach((note, index) => tone(note, 0.3, 'sine', 0.09, index * 0.14));
    },
    denied() {
      tone(160, 0.12, 'square', 0.05);
    },
  };
}
