// Silent Gallery: everything the player sees. A top-down museum floor in
// the dark: a checkerboard marble floor, stone walls, wooden crates, bushes
// to hide in, glowing relics and the exit door, guards with translucent
// vision cones, and a darkness overlay with pools of light around the
// player. The HUD sits on top in screen space.
import { COLS, FIELD, GUARD, ROWS, TILE } from './config.js';

export const SCREEN_TITLE = 0;
export const SCREEN_PLAY = 1;
export const SCREEN_PAUSED = 2;
export const SCREEN_CLEAR = 3;
export const SCREEN_OVER = 4;
export const SCREEN_VICTORY = 5;

const CONE_RAYS = 20;

export function createRenderer(canvas) {
  const context = canvas.getContext('2d');
  const overlay = document.createElement('canvas');
  const overlayContext = overlay.getContext('2d');
  // The floor, walls and crates never move, so they are painted once per
  // level onto a static layer and blitted each frame instead of redrawn.
  const staticLayer = document.createElement('canvas');
  staticLayer.width = FIELD.width;
  staticLayer.height = FIELD.height;
  const staticContext = staticLayer.getContext('2d');
  let staticLevelIndex = -1;
  let scale = 1;
  let offsetX = 0;
  let offsetY = 0;

  function resize() {
    const width = canvas.clientWidth || window.innerWidth;
    const height = canvas.clientHeight || window.innerHeight;
    const ratio = window.devicePixelRatio || 1;
    canvas.width = Math.round(width * ratio);
    canvas.height = Math.round(height * ratio);
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    scale = Math.min(width / FIELD.width, height / FIELD.height);
    offsetX = (width - FIELD.width * scale) / 2;
    offsetY = (height - FIELD.height * scale) / 2;
    overlay.width = Math.round(FIELD.width * scale);
    overlay.height = Math.round(FIELD.height * scale);
  }

  function toField(clientX, clientY) {
    return { x: (clientX - offsetX) / scale, y: (clientY - offsetY) / scale };
  }

  function drawFloor(state) {
    const ctx = staticContext;
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        const tile = state.grid[row * COLS + col];
        const x = col * TILE;
        const y = row * TILE;
        if (tile === 1) {
          ctx.fillStyle = '#232733';
          ctx.fillRect(x, y, TILE, TILE);
          ctx.fillStyle = '#39405a';
          ctx.fillRect(x, y, TILE, 5);
          ctx.fillStyle = '#171a24';
          ctx.fillRect(x, y + TILE - 4, TILE, 4);
          continue;
        }
        const light = (col + row) % 2 === 0;
        if (tile === 4) {
          ctx.fillStyle = light ? '#20242f' : '#1c202b';
        } else {
          ctx.fillStyle = light ? '#3a3f52' : '#343947';
        }
        ctx.fillRect(x, y, TILE, TILE);
        ctx.strokeStyle = 'rgba(0,0,0,0.18)';
        ctx.strokeRect(x + 0.5, y + 0.5, TILE - 1, TILE - 1);
        if (tile === 2) drawCrate(ctx, x, y);
      }
    }
  }

  function drawCrate(ctx, x, y) {
    ctx.fillStyle = '#6b4a26';
    ctx.fillRect(x + 3, y + 3, TILE - 6, TILE - 6);
    ctx.fillStyle = '#7d5a30';
    ctx.fillRect(x + 3, y + 3, TILE - 6, 6);
    ctx.strokeStyle = '#4a3016';
    ctx.lineWidth = 2;
    ctx.strokeRect(x + 3.5, y + 3.5, TILE - 7, TILE - 7);
    ctx.beginPath();
    ctx.moveTo(x + 3, y + 3);
    ctx.lineTo(x + TILE - 3, y + TILE - 3);
    ctx.moveTo(x + TILE - 3, y + 3);
    ctx.lineTo(x + 3, y + TILE - 3);
    ctx.stroke();
  }

  function drawBush(x, y, time) {
    const wobble = Math.sin(time * 1.4 + x * 0.05) * 1.5;
    context.fillStyle = '#1e4d2a';
    context.beginPath();
    context.arc(x + 10, y + 18 + wobble, 10, 0, Math.PI * 2);
    context.arc(x + 22, y + 12 - wobble, 11, 0, Math.PI * 2);
    context.arc(x + 24, y + 24, 9, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2c6b3a';
    context.beginPath();
    context.arc(x + 13, y + 15, 5, 0, Math.PI * 2);
    context.arc(x + 21, y + 20, 4, 0, Math.PI * 2);
    context.fill();
  }

  function drawRelic(relic, time) {
    const pulse = 0.75 + Math.sin(time * 3 + relic.x) * 0.25;
    const glow = context.createRadialGradient(relic.x, relic.y, 2, relic.x, relic.y, 26);
    glow.addColorStop(0, `rgba(255, 214, 90, ${0.55 * pulse})`);
    glow.addColorStop(1, 'rgba(255, 214, 90, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(relic.x, relic.y, 26, 0, Math.PI * 2);
    context.fill();
    context.save();
    context.translate(relic.x, relic.y + Math.sin(time * 2 + relic.y) * 2);
    context.rotate(Math.PI / 4);
    context.fillStyle = '#ffd65a';
    context.fillRect(-7, -7, 14, 14);
    context.fillStyle = '#fff0b0';
    context.fillRect(-7, -7, 14, 5);
    context.restore();
  }

  function drawExit(exit, open, time) {
    const glow = context.createRadialGradient(exit.x, exit.y, 2, exit.x, exit.y, open ? 46 : 26);
    const colour = open ? '110, 255, 170' : '255, 90, 90';
    glow.addColorStop(0, `rgba(${colour}, ${open ? 0.6 : 0.35})`);
    glow.addColorStop(1, `rgba(${colour}, 0)`);
    context.fillStyle = glow;
    context.beginPath();
    context.arc(exit.x, exit.y, open ? 46 : 26, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = open ? '#0e3d24' : '#3d0e0e';
    context.fillRect(exit.x - 13, exit.y - 15, 26, 30);
    context.strokeStyle = open ? '#6effaa' : '#ff6e6e';
    context.lineWidth = 3;
    context.strokeRect(exit.x - 13, exit.y - 15, 26, 30);
    if (open) {
      context.fillStyle = '#6effaa';
      context.font = 'bold 11px sans-serif';
      context.textAlign = 'center';
      context.fillText('EXIT', exit.x, exit.y - 22);
    } else {
      context.fillStyle = '#ff9a9a';
      context.font = 'bold 10px sans-serif';
      context.textAlign = 'center';
      context.fillText('LOCKED', exit.x, exit.y - 22);
    }
    if (open) {
      const shimmer = 0.5 + Math.sin(time * 4) * 0.5;
      context.fillStyle = `rgba(110, 255, 170, ${0.25 + shimmer * 0.25})`;
      context.fillRect(exit.x - 9, exit.y - 11, 18, 22);
    }
  }

  /** The guard's vision cone, cut short by walls and crates along each ray. */
  function conePolygon(guard, hasLineOfSight) {
    const points = [];
    for (let i = 0; i <= CONE_RAYS; i += 1) {
      const angle = guard.heading - GUARD.viewHalfAngle + (2 * GUARD.viewHalfAngle * i) / CONE_RAYS;
      let reach = GUARD.viewRange;
      for (let d = 8; d <= GUARD.viewRange; d += 8) {
        const x = guard.x + Math.cos(angle) * d;
        const y = guard.y + Math.sin(angle) * d;
        if (!hasLineOfSight(guard.x, guard.y, x, y)) {
          reach = d - 8;
          break;
        }
      }
      points.push([guard.x + Math.cos(angle) * Math.max(0, reach), guard.y + Math.sin(angle) * Math.max(0, reach)]);
    }
    return points;
  }

  function drawGuard(guard, detection, time, hasLineOfSight) {
    const alerted = guard.mode === 'chase';
    const suspicious = guard.mode === 'investigate' || guard.mode === 'search';
    const coneColour = alerted ? '255, 60, 60' : suspicious ? '255, 150, 60' : '255, 220, 90';
    const coneAlpha = alerted ? 0.4 : detection > 0.3 ? 0.34 : 0.26;
    const polygon = conePolygon(guard, hasLineOfSight);
    context.fillStyle = `rgba(${coneColour}, ${coneAlpha})`;
    context.beginPath();
    context.moveTo(guard.x, guard.y);
    for (const [x, y] of polygon) context.lineTo(x, y);
    context.closePath();
    context.fill();
    context.strokeStyle = `rgba(${coneColour}, 0.5)`;
    context.lineWidth = 1;
    context.stroke();
    // Body: a dark-uniform guard with a cap brim facing where he looks.
    context.fillStyle = '#3a0d0d';
    context.beginPath();
    context.arc(guard.x, guard.y, guard.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#8c1f1f';
    context.beginPath();
    context.arc(guard.x, guard.y, guard.radius - 3, 0, Math.PI * 2);
    context.fill();
    context.strokeStyle = '#d8b25a';
    context.lineWidth = 2;
    context.beginPath();
    context.arc(guard.x, guard.y, guard.radius - 3, guard.heading - 0.9, guard.heading + 0.9);
    context.stroke();
    context.fillStyle = '#ffd9a0';
    context.beginPath();
    context.arc(guard.x + Math.cos(guard.heading) * 6, guard.y + Math.sin(guard.heading) * 6, 3, 0, Math.PI * 2);
    context.fill();
    if (alerted || suspicious) {
      context.font = 'bold 18px sans-serif';
      context.textAlign = 'center';
      context.fillStyle = alerted ? '#ff4040' : '#ffb340';
      context.fillText(alerted ? '!' : '?', guard.x, guard.y - guard.radius - 8 + Math.sin(time * 6) * 2);
    }
  }

  function drawPlayer(player, time) {
    const bob = player.moving ? Math.sin(time * 12) * 1.5 : 0;
    const glow = context.createRadialGradient(player.x, player.y, 2, player.x, player.y, 34);
    glow.addColorStop(0, 'rgba(120, 170, 255, 0.28)');
    glow.addColorStop(1, 'rgba(120, 170, 255, 0)');
    context.fillStyle = glow;
    context.beginPath();
    context.arc(player.x, player.y, 34, 0, Math.PI * 2);
    context.fill();
    // Hooded figure: a dark blue cloak, a hood, and a pale face in shadow.
    context.fillStyle = '#1d2f57';
    context.beginPath();
    context.arc(player.x, player.y + bob, player.radius, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#2c4a86';
    context.beginPath();
    context.arc(player.x, player.y + bob, player.radius - 4, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#0e1830';
    context.beginPath();
    context.arc(player.x + Math.cos(player.facing) * 3, player.y + Math.sin(player.facing) * 3 + bob, 6.5, 0, Math.PI * 2);
    context.fill();
    context.fillStyle = '#ffe9c4';
    context.beginPath();
    context.arc(player.x + Math.cos(player.facing) * 5, player.y + Math.sin(player.facing) * 5 + bob, 3, 0, Math.PI * 2);
    context.fill();
    if (player.sneaking) {
      context.fillStyle = 'rgba(180, 210, 255, 0.85)';
      context.font = 'bold 10px sans-serif';
      context.textAlign = 'center';
      context.fillText('SNEAKING', player.x, player.y - player.radius - 8);
    }
  }

  function drawPebble(pebble) {
    context.fillStyle = '#cfd6e4';
    context.beginPath();
    context.arc(pebble.x, pebble.y, 3.5, 0, Math.PI * 2);
    context.fill();
    if (!pebble.landed) {
      context.strokeStyle = 'rgba(207, 214, 228, 0.5)';
      context.beginPath();
      context.arc(pebble.x, pebble.y, 8, 0, Math.PI * 2);
      context.stroke();
    }
  }

  /** Darkness with pools of light: the museum at night, lit where it matters. */
  function drawDarkness(state) {
    const ratio = window.devicePixelRatio || 1;
    const octx = overlayContext;
    octx.setTransform(1, 0, 0, 1, 0, 0);
    octx.clearRect(0, 0, overlay.width, overlay.height);
    octx.fillStyle = 'rgba(4, 6, 18, 0.5)';
    octx.fillRect(0, 0, overlay.width, overlay.height);
    octx.globalCompositeOperation = 'destination-out';
    function hole(x, y, radius, strength) {
      const gradient = octx.createRadialGradient(x * scale, y * scale, 4, x * scale, y * scale, radius * scale);
      gradient.addColorStop(0, `rgba(0,0,0,${strength})`);
      gradient.addColorStop(1, 'rgba(0,0,0,0)');
      octx.fillStyle = gradient;
      octx.beginPath();
      octx.arc(x * scale, y * scale, radius * scale, 0, Math.PI * 2);
      octx.fill();
    }
    hole(state.player.x, state.player.y, 165, 0.92);
    for (const relic of state.relics) if (!relic.taken) hole(relic.x, relic.y, 55, 0.7);
    if (state.exitOpen) hole(state.exit.x, state.exit.y, 80, 0.8);
    octx.globalCompositeOperation = 'source-over';
    context.save();
    context.setTransform(ratio, 0, 0, ratio, 0, 0);
    context.drawImage(overlay, offsetX, offsetY);
    context.restore();
  }

  function drawHud(state, screen, best, muted) {
    const width = canvas.clientWidth || window.innerWidth;
    context.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    context.fillStyle = 'rgba(8, 10, 20, 0.82)';
    context.fillRect(0, 0, width, 44);
    context.fillStyle = '#e8ecf7';
    context.font = 'bold 15px Georgia, serif';
    context.textAlign = 'left';
    context.fillText(`SILENT GALLERY — ${state.levelName}`, 14, 28);
    context.font = '13px sans-serif';
    context.textAlign = 'right';
    let right = width - 14;
    context.fillText(muted ? 'MUTED (M)' : 'SOUND (M)', right, 28);
    right -= 92;
    context.fillText(`SCORE ${state.score}`, right, 28);
    right -= 110;
    context.fillText(`TIME ${Math.floor(state.elapsed / 60)}:${String(Math.floor(state.elapsed % 60)).padStart(2, '0')}`, right, 28);
    right -= 96;
    // Lives as hearts.
    context.textAlign = 'right';
    context.fillStyle = '#ff5f7a';
    context.font = '15px sans-serif';
    context.fillText('♥'.repeat(Math.max(0, state.lives)), right, 28);
    right -= 52;
    // Pebbles left.
    context.fillStyle = '#cfd6e4';
    context.fillText('●'.repeat(state.pebbles), right, 28);
    right -= 52;
    // Relics as diamonds.
    for (let i = 0; i < state.relicsTotal; i += 1) {
      const x = right - i * 22;
      context.save();
      context.translate(x - 6, 20);
      context.rotate(Math.PI / 4);
      context.fillStyle = i < state.relicsTaken ? '#ffd65a' : 'rgba(255,255,255,0.25)';
      context.fillRect(-6, -6, 12, 12);
      context.restore();
    }
    // The detection eye: it only appears while someone is watching.
    if (state.detection > 0.03 && screen === SCREEN_PLAY) {
      const barWidth = 220;
      const barX = (width - barWidth) / 2;
      const barY = 56;
      context.fillStyle = 'rgba(8, 10, 20, 0.8)';
      context.fillRect(barX - 90, barY - 4, barWidth + 124, 26);
      context.font = 'bold 15px sans-serif';
      context.textAlign = 'right';
      context.fillStyle = state.detection > 0.75 ? '#ff4040' : '#ffd65a';
      context.fillText(state.alert ? 'SPOTTED!' : 'SEEN', barX + 28, barY + 15);
      context.fillStyle = 'rgba(255,255,255,0.2)';
      context.fillRect(barX + 34, barY + 4, barWidth - 34, 10);
      context.fillStyle = state.detection > 0.75 ? '#ff4040' : '#ffd65a';
      context.fillRect(barX + 34, barY + 4, (barWidth - 34) * state.detection, 10);
    }
    // Controls, small, along the bottom.
    context.fillStyle = 'rgba(232, 236, 247, 0.75)';
    context.font = '12px sans-serif';
    context.textAlign = 'center';
    context.fillText('WASD / arrows — move    Shift — sneak    Q / click — throw a pebble    P — pause    R — restart level', width / 2, (canvas.clientHeight || window.innerHeight) - 10);
  }

  function panel(width, height, title, lines, accent) {
    const screenWidth = canvas.clientWidth || window.innerWidth;
    const screenHeight = canvas.clientHeight || window.innerHeight;
    const x = (screenWidth - width) / 2;
    const y = (screenHeight - height) / 2;
    context.setTransform(window.devicePixelRatio || 1, 0, 0, window.devicePixelRatio || 1, 0, 0);
    context.fillStyle = 'rgba(6, 8, 18, 0.78)';
    context.fillRect(0, 0, screenWidth, screenHeight);
    context.fillStyle = '#12141f';
    context.strokeStyle = accent;
    context.lineWidth = 2;
    context.beginPath();
    context.rect(x, y, width, height);
    context.fill();
    context.stroke();
    context.textAlign = 'center';
    context.fillStyle = accent;
    context.font = 'bold 34px Georgia, serif';
    context.fillText(title, screenWidth / 2, y + 62);
    context.fillStyle = '#e8ecf7';
    context.font = '15px sans-serif';
    lines.forEach((line, index) => {
      context.fillText(line, screenWidth / 2, y + 104 + index * 26);
    });
    return { x, y, width, height };
  }

  function draw(state, screen, best, muted, time, hasLineOfSight) {
    resize();
    const ratio = window.devicePixelRatio || 1;
    context.setTransform(ratio * scale, 0, 0, ratio * scale, ratio * offsetX, ratio * offsetY);
    if (staticLevelIndex !== state.levelIndex) {
      drawFloor(state);
      staticLevelIndex = state.levelIndex;
    }
    context.drawImage(staticLayer, 0, 0);
    for (let row = 0; row < ROWS; row += 1) {
      for (let col = 0; col < COLS; col += 1) {
        if (state.grid[row * COLS + col] === 3) drawBush(col * TILE, row * TILE, time);
      }
    }
    for (const relic of state.relics) if (!relic.taken) drawRelic(relic, time);
    drawExit(state.exit, state.exitOpen, time);
    drawDarkness(state);
    for (const guard of state.guards) drawGuard(guard, state.detection, time, hasLineOfSight);
    if (state.pebble !== null) drawPebble(state.pebble);
    drawPlayer(state.player, time);
    drawHud(state, screen, best, muted);

    if (screen === SCREEN_TITLE) {
      panel(620, 380, 'SILENT GALLERY', [
        'A thief in a moonlit museum. Pocket every relic,',
        'slip past the guards, and reach the green exit unseen.',
        '',
        'Hide behind crates. Crouch in the bushes. Mind the dark:',
        'guards spot you slower in shadow, faster when you run.',
        'Throw a pebble (Q or click) to lure a guard away.',
        '',
        'Press SPACE or click to begin.',
        best > 0 ? `Best so far: level ${best} of ${3}.` : 'Three wings. Three nights. One quiet thief.',
      ], '#d8b25a');
    } else if (screen === SCREEN_PAUSED) {
      panel(420, 200, 'PAUSED', ['Press P or SPACE to keep sneaking.', 'R restarts the wing.'], '#8fa8d8');
    } else if (screen === SCREEN_CLEAR) {
      panel(460, 230, 'WING CLEARED', [`Score ${state.score}. The next wing waits.`, '', 'Press SPACE for the next wing.'], '#6effaa');
    } else if (screen === SCREEN_OVER) {
      panel(460, 230, 'CAUGHT!', [`The guards found you. Score ${state.score}.`, '', 'Press SPACE to try again.'], '#ff5f5f');
    } else if (screen === SCREEN_VICTORY) {
      panel(560, 260, 'THE GALLERY IS YOURS', [
        'Every relic pocketed. Every guard outwitted.',
        `Final score ${state.score}.`,
        '',
        'Press SPACE to steal it all over again.',
      ], '#ffd65a');
    }
  }

  return { draw, resize, toField };
}
