import { SpaceInvadersGame } from './game.mjs';

const board = document.getElementById('board');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const powerEl = document.getElementById('power');
const statusEl = document.getElementById('status');
const restartBtn = document.getElementById('restart');
const ctx = board.getContext('2d');

// Polyfill for ctx.roundRect (not available in older browsers)
if (typeof ctx.roundRect !== 'function') {
  CanvasRenderingContext2D.prototype.roundRect = function (x, y, w, h) {
    this.rect(x, y, w, h);
    return this;
  };
}

const game = new SpaceInvadersGame({ width: 700, height: 520 });
const stars = createStars(130);
const input = { left: false, right: false, shoot: false };

let lastTime = 0;
let animFrameId = null;

function fitCanvas() {
  board.width = game.width;
  board.height = game.height;
}

function setStatus(text) { statusEl.textContent = text; }
function resetStatus() { setStatus('Pressione setas ou ESPACO para comecar. Desvie dos asteroides!'); }

function loop(timestamp) {
  // Schedule FIRST — loop never dies even if game logic throws
  animFrameId = requestAnimationFrame(loop);

  if (!lastTime) lastTime = timestamp;
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  try {
    game.setInput(input);
    const state = game.update(dt);
    draw(state, dt);
    updateHud(state);
    if (state.gameOver) setStatus('FIM DE JOGO! Aperte R ou RESTART.');
  } catch (err) {
    console.error('Game error:', err);
  }
}

function updateHud(state) {
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
  levelEl.textContent = state.level;

  if (powerEl) {
    if (state.player.shield) {
      powerEl.textContent = 'SHIELD';
      powerEl.style.color = '#44aaff';
    } else if (state.player.power) {
      const labels = { spread: '3-WAY', rapid: 'RAPID', laser: 'LASER' };
      const colors = { spread: '#ff9944', rapid: '#aaff44', laser: '#ff5555' };
      powerEl.textContent = labels[state.player.power] || state.player.power.toUpperCase();
      powerEl.style.color = colors[state.player.power] || '#fff';
    } else {
      powerEl.textContent = '—';
      powerEl.style.color = '#9bb0d1';
    }
  }
}

function draw(state, dt) {
  ctx.save();
  // Screen shake
  if (state.shake > 0) {
    ctx.translate(
      (Math.random() - 0.5) * state.shake * 2,
      (Math.random() - 0.5) * state.shake * 2
    );
  }

  drawBackground(dt);
  drawAsteroids(state.asteroids);
  drawUfo(state.ufo);
  drawInvaders(state.invaders);
  drawBullets(state.bullets);
  drawPowerUps(state.powerUps);
  drawExplosions(state.explosions);
  drawScorePopups(state.scorePopups);
  drawPlayer(state.player, state.muzzleFlash, state.player.invuln > 0);
  drawPowerBar(state);
  drawPowerMessage(state);
  drawAsteroidWarning(state.asteroids, state.player);
  drawUfoCountdown(state.ufo, state.ufoSpawnTimer);
  if (state.gameOver) drawGameOver(state);

  ctx.restore();
}

function drawBackground(dt) {
  const gradient = ctx.createLinearGradient(0, 0, 0, board.height);
  gradient.addColorStop(0, '#05040d');
  gradient.addColorStop(0.5, '#070b1f');
  gradient.addColorStop(1, '#040609');
  ctx.fillStyle = gradient;
  ctx.fillRect(-20, -20, board.width + 40, board.height + 40);

  ctx.save();
  ctx.globalAlpha = 0.7;
  stars.forEach(star => {
    star.y += star.speed * dt;
    if (star.y > board.height) { star.y = -10; star.x = Math.random() * board.width; }
    ctx.fillStyle = star.color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  ctx.strokeStyle = 'rgba(64, 209, 255, 0.07)';
  ctx.lineWidth = 1;
  for (let x = 40; x < board.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, board.height);
    ctx.stroke();
  }
}

function drawInvaders(invaders) {
  invaders.forEach(inv => {
    if (!inv.alive) return;
    ctx.save();

    if (inv.isArmored) {
      // Armored: golden, double outline
      ctx.shadowColor = '#ffcc00';
      ctx.shadowBlur = 18;
      ctx.fillStyle = '#997700';
      ctx.fillRect(inv.x - 2, inv.y - 2, inv.width + 4, inv.height + 4);
      ctx.fillStyle = '#ddaa00';
      ctx.fillRect(inv.x, inv.y, inv.width, inv.height);
      ctx.fillStyle = 'rgba(10,8,20,0.75)';
      ctx.fillRect(inv.x + 5, inv.y + 5, inv.width - 10, inv.height - 10);
      // HP bar
      ctx.shadowBlur = 0;
      ctx.fillStyle = '#333';
      ctx.fillRect(inv.x, inv.y + inv.height + 2, inv.width, 3);
      ctx.fillStyle = '#ffcc00';
      ctx.fillRect(inv.x, inv.y + inv.height + 2, inv.width * (inv.hp / inv.maxHp), 3);
    } else {
      const hue = 180 + inv.row * 18;
      ctx.shadowColor = inv.isSpecial ? '#ffee44' : `hsla(${hue}, 100%, 70%, 0.8)`;
      ctx.shadowBlur = inv.isSpecial ? 22 : 12;
      ctx.fillStyle = inv.isSpecial ? '#eecc22' : `hsla(${hue}, 100%, 65%, 0.85)`;
      ctx.fillRect(inv.x, inv.y, inv.width, inv.height);
      ctx.fillStyle = 'rgba(10,8,20,0.8)';
      ctx.fillRect(inv.x + 5, inv.y + 5, inv.width - 10, inv.height - 10);
      // Special star marker
      if (inv.isSpecial) {
        ctx.shadowBlur = 6;
        ctx.fillStyle = '#ffee44';
        ctx.font = '9px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('*', inv.x + inv.width / 2, inv.y + inv.height / 2);
      }
    }
    ctx.restore();
  });
}

function drawAsteroids(asteroids) {
  asteroids.forEach(ast => {
    ctx.save();
    ctx.translate(ast.x, ast.y);
    ctx.rotate(ast.rot);

    const hpRatio = ast.hp / ast.maxHp;
    ctx.shadowColor = hpRatio < 1 ? '#ff6622' : '#ffaa66';
    ctx.shadowBlur = 20;
    ctx.fillStyle = `hsl(25, 55%, ${18 + hpRatio * 16}%)`;
    ctx.strokeStyle = `hsl(30, 100%, ${42 + hpRatio * 22}%)`;
    ctx.lineWidth = 2;

    ctx.beginPath();
    ast.verts.forEach(([vx, vy], i) => {
      const px = vx * ast.size;
      const py = vy * ast.size;
      if (i === 0) ctx.moveTo(px, py);
      else ctx.lineTo(px, py);
    });
    ctx.closePath();
    ctx.fill();
    ctx.stroke();

    // Crack lines for damaged asteroids
    if (hpRatio < 1) {
      ctx.strokeStyle = 'rgba(255,100,30,0.5)';
      ctx.lineWidth = 1;
      ctx.shadowBlur = 5;
      ctx.beginPath();
      ctx.moveTo(-ast.size * 0.3, -ast.size * 0.2);
      ctx.lineTo(ast.size * 0.2, ast.size * 0.3);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(ast.size * 0.1, -ast.size * 0.35);
      ctx.lineTo(-ast.size * 0.15, ast.size * 0.15);
      ctx.stroke();
    }

    // HP dots
    if (ast.maxHp > 1) {
      ctx.shadowBlur = 0;
      for (let i = 0; i < ast.maxHp; i++) {
        ctx.fillStyle = i < ast.hp ? '#ff9944' : '#333';
        ctx.beginPath();
        ctx.arc(-ast.size * 0.5 + i * 8, ast.size * 0.65, 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }

    ctx.restore();
  });
}

function drawUfo(ufo) {
  if (!ufo) return;
  ctx.save();
  const cx = ufo.x + ufo.width / 2;
  const cy = ufo.y + ufo.height / 2;
  const hpRatio = ufo.maxHp ? ufo.hp / ufo.maxHp : 1;
  const rage = hpRatio < 0.33;

  // Rage flicker
  if (rage && Math.random() > 0.55) ctx.globalAlpha = 0.7;

  const glowColor = rage ? '#ff3300' : '#ff79f7';
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = rage ? 35 : 25;

  // Body
  ctx.fillStyle = rage ? '#882200' : '#992299';
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, ufo.width / 2, ufo.height * 0.45, 0, 0, Math.PI * 2);
  ctx.fill();

  // Rim glow
  ctx.strokeStyle = glowColor;
  ctx.lineWidth = rage ? 2.5 : 1.5;
  ctx.beginPath();
  ctx.ellipse(cx, cy + 5, ufo.width / 2, ufo.height * 0.45, 0, 0, Math.PI * 2);
  ctx.stroke();

  // Dome
  ctx.fillStyle = rage ? '#cc2200' : '#dd55dd';
  ctx.shadowBlur = 15;
  ctx.beginPath();
  ctx.ellipse(cx, cy - 1, ufo.width / 3.5, ufo.height * 0.5, 0, Math.PI, 0);
  ctx.fill();

  // Lights
  const spacing = Math.floor(ufo.width / 5);
  [-spacing * 2, -spacing, 0, spacing, spacing * 2].forEach((lx, i) => {
    const colors = ['#ff4444', '#ffff44', '#44ff88', '#4488ff', '#ff4444'];
    ctx.fillStyle = colors[i];
    ctx.shadowColor = colors[i];
    ctx.shadowBlur = 10;
    ctx.beginPath();
    ctx.arc(cx + lx, cy + 7, 3, 0, Math.PI * 2);
    ctx.fill();
  });

  // HP bar
  if (ufo.maxHp) {
    const barW = ufo.width + 20;
    const bx = cx - barW / 2;
    const by = ufo.y + ufo.height + 6;
    ctx.shadowBlur = 0;
    ctx.fillStyle = 'rgba(0,0,0,0.6)';
    ctx.fillRect(bx, by, barW, 5);
    ctx.fillStyle = glowColor;
    ctx.fillRect(bx, by, barW * hpRatio, 5);
  }

  // Boss label
  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 10;
  ctx.fillStyle = glowColor;
  ctx.font = `bold ${rage ? 10 : 8}px monospace`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'bottom';
  ctx.fillText(rage ? '!!! NAVE MÃE - FÚRIA !!!' : 'NAVE MÃE', cx, ufo.y - 3);

  ctx.restore();
}

function drawUfoCountdown(ufo, spawnTimer) {
  if (ufo || spawnTimer <= 0) return;
  const secs = Math.ceil(spawnTimer);
  const blink = spawnTimer < 3 ? Math.sin(Date.now() * 0.02) > 0 : true;
  if (!blink) return;

  ctx.save();
  ctx.shadowColor = '#ff79f7';
  ctx.shadowBlur = 12;
  ctx.fillStyle = spawnTimer < 2 ? '#ff4444' : '#ff79f7';
  ctx.font = 'bold 10px monospace';
  ctx.textAlign = 'right';
  ctx.textBaseline = 'top';
  ctx.fillText(`NAVE MÃE EM: ${secs}s`, board.width - 8, 8);
  ctx.restore();
}

function drawGameOver(state) {
  ctx.save();
  // Dark overlay
  ctx.fillStyle = 'rgba(3,4,14,0.72)';
  ctx.fillRect(0, 0, board.width, board.height);

  // GAME OVER text
  ctx.shadowColor = '#ff5555';
  ctx.shadowBlur = 35;
  ctx.fillStyle = '#ff5555';
  ctx.font = 'bold 48px monospace';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('GAME OVER', board.width / 2, board.height / 2 - 30);

  ctx.shadowColor = '#ff79f7';
  ctx.shadowBlur = 12;
  ctx.fillStyle = '#ff79f7';
  ctx.font = 'bold 18px monospace';
  ctx.fillText(`PONTUAÇÃO: ${state.score}`, board.width / 2, board.height / 2 + 14);

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#9bb0d1';
  ctx.font = '13px monospace';
  ctx.fillText('Aperte R ou RESTART para jogar novamente', board.width / 2, board.height / 2 + 48);
  ctx.restore();
}

function drawPlayer(player, muzzleFlash, flicker) {
  ctx.save();
  if (flicker && Math.random() > 0.5) ctx.globalAlpha = 0.35;

  // Shield bubble
  if (player.shield) {
    const cx = player.x + player.width / 2;
    const cy = player.y + player.height / 2;
    const pulse = 0.85 + Math.sin(Date.now() * 0.008) * 0.15;
    ctx.shadowColor = '#44aaff';
    ctx.shadowBlur = 25 * pulse;
    ctx.strokeStyle = `rgba(68,170,255,${0.7 * pulse})`;
    ctx.lineWidth = 2.5;
    ctx.beginPath();
    ctx.ellipse(cx, cy, player.width / 2 + 12, player.height / 2 + 14, 0, 0, Math.PI * 2);
    ctx.stroke();
    // Inner glow
    ctx.fillStyle = `rgba(68,170,255,${0.07 * pulse})`;
    ctx.fill();
  }

  // Ship color based on power
  const powerColors = { spread: '#ff9944', rapid: '#aaff44', laser: '#ff5555' };
  const shipColor = player.power ? (powerColors[player.power] || '#5bf9ff') : '#5bf9ff';
  const glowColor = player.power ? (powerColors[player.power] || '#63f2ff') : '#63f2ff';

  ctx.shadowColor = glowColor;
  ctx.shadowBlur = 20;
  ctx.fillStyle = shipColor;
  ctx.beginPath();
  ctx.moveTo(player.x, player.y + player.height);
  ctx.lineTo(player.x + player.width / 2, player.y - 6);
  ctx.lineTo(player.x + player.width, player.y + player.height);
  ctx.closePath();
  ctx.fill();

  // Engine glow at base
  const engineGrad = ctx.createLinearGradient(player.x, player.y + player.height, player.x, player.y + player.height + 10);
  engineGrad.addColorStop(0, glowColor + 'aa');
  engineGrad.addColorStop(1, 'transparent');
  ctx.shadowBlur = 0;
  ctx.fillStyle = engineGrad;
  ctx.fillRect(player.x + 8, player.y + player.height, player.width - 16, 8);

  ctx.fillStyle = '#0b1022';
  ctx.fillRect(player.x + 10, player.y + 6, player.width - 20, player.height - 6);

  if (muzzleFlash > 0) {
    ctx.globalAlpha = Math.min(1, muzzleFlash * 14);
    ctx.fillStyle = '#fdf4ff';
    ctx.shadowColor = '#fdf4ff';
    ctx.shadowBlur = 12;
    ctx.fillRect(player.x + player.width / 2 - 3, player.y - 14, 6, 12);
  }
  ctx.restore();
}

function drawBullets(bullets) {
  bullets.forEach(bullet => {
    ctx.save();
    if (bullet.from === 'player') {
      if (bullet.power === 'laser') {
        ctx.shadowColor = '#ff3333';
        ctx.shadowBlur = 18;
        ctx.fillStyle = '#ff7777';
      } else if (bullet.power === 'spread') {
        ctx.shadowColor = '#ff9944';
        ctx.shadowBlur = 14;
        ctx.fillStyle = '#ffcc77';
      } else {
        ctx.shadowColor = '#6af7ff';
        ctx.shadowBlur = 10;
        ctx.fillStyle = '#9efcff';
      }
    } else {
      ctx.shadowColor = '#ff70e0';
      ctx.shadowBlur = 10;
      ctx.fillStyle = '#ff9bed';
    }
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    ctx.restore();
  });
}

function drawPowerUps(powerUps) {
  const colors = { spread: '#ff9944', rapid: '#aaff44', laser: '#ff5555', shield: '#44aaff' };
  const labels = { spread: '3X', rapid: 'RPD', laser: 'LZR', shield: 'SHD' };

  powerUps.forEach(pu => {
    if (!pu.alive) return;
    ctx.save();
    ctx.translate(pu.x + pu.width / 2, pu.y + pu.height / 2);
    ctx.rotate(pu.spin);

    const color = colors[pu.type] || '#ffffff';
    const pulse = 0.8 + Math.sin(Date.now() * 0.01 + pu.spin) * 0.2;

    ctx.shadowColor = color;
    ctx.shadowBlur = 22 * pulse;
    ctx.strokeStyle = color;
    ctx.lineWidth = 2;
    ctx.fillStyle = color + '25';

    const hw = pu.width / 2;
    // Rounded rect approximation
    ctx.beginPath();
    ctx.roundRect(-hw, -hw, pu.width, pu.height, 4);
    ctx.fill();
    ctx.stroke();

    ctx.fillStyle = color;
    ctx.shadowBlur = 5;
    ctx.font = 'bold 7px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(labels[pu.type] || '?', 0, 0);
    ctx.restore();
  });
}

function drawExplosions(explosions) {
  explosions.forEach(particle => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, particle.size || 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
}

function drawScorePopups(popups) {
  if (!popups) return;
  popups.forEach(sp => {
    ctx.save();
    ctx.globalAlpha = Math.min(1, sp.life * 1.5);
    ctx.fillStyle = sp.color;
    ctx.shadowColor = sp.color;
    ctx.shadowBlur = 10;
    ctx.font = 'bold 12px monospace';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(sp.text, sp.x, sp.y);
    ctx.restore();
  });
}

function drawPowerBar(state) {
  const p = state.player;
  if (!p.power || p.powerTimer <= 0) return;

  const barW = 140, barH = 6;
  const bx = board.width / 2 - barW / 2;
  const by = board.height - 16;
  const ratio = p.powerTimer / 10.0;
  const colors = { spread: '#ff9944', rapid: '#aaff44', laser: '#ff5555' };
  const color = colors[p.power] || '#fff';

  ctx.save();
  ctx.fillStyle = 'rgba(0,0,0,0.55)';
  ctx.beginPath();
  ctx.roundRect(bx - 2, by - 2, barW + 4, barH + 4, 3);
  ctx.fill();

  ctx.shadowColor = color;
  ctx.shadowBlur = 10;
  ctx.fillStyle = color;
  ctx.beginPath();
  ctx.roundRect(bx, by, barW * ratio, barH, 2);
  ctx.fill();

  ctx.fillStyle = color + '44';
  ctx.beginPath();
  ctx.roundRect(bx, by, barW, barH, 2);
  ctx.fill();
  ctx.restore();
}

function drawPowerMessage(state) {
  if (!state.powerMessage) return;
  const alpha = Math.min(1, state.powerMessageTimer / 0.6);
  const scale = 1 + (1 - Math.min(1, state.powerMessageTimer)) * 0.15;

  ctx.save();
  ctx.globalAlpha = alpha;
  ctx.translate(board.width / 2, board.height / 2 - 20);
  ctx.scale(scale, scale);

  ctx.font = 'bold 20px monospace';
  const tw = ctx.measureText(state.powerMessage).width + 40;

  // Background
  ctx.fillStyle = 'rgba(0,0,0,0.65)';
  ctx.beginPath();
  ctx.roundRect(-tw / 2, -20, tw, 38, 8);
  ctx.fill();

  ctx.shadowColor = '#ffee44';
  ctx.shadowBlur = 22;
  ctx.fillStyle = '#ffee44';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText(state.powerMessage, 0, 0);
  ctx.restore();
}

function drawAsteroidWarning(asteroids, player) {
  if (!asteroids) return;
  const danger = asteroids.some(a => a.y + a.size > player.y - 90 && a.y < player.y + player.height);
  if (!danger) return;

  const blink = Math.sin(Date.now() * 0.012) > 0;
  if (!blink) return;

  ctx.save();
  ctx.shadowColor = '#ff4400';
  ctx.shadowBlur = 15;
  ctx.fillStyle = '#ff6622';
  ctx.font = 'bold 11px monospace';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'top';
  ctx.fillText('! ASTEROIDE !', 8, board.height - 30);
  ctx.restore();
}

function createStars(count) {
  const palette = ['#ffffff', '#7ef2ff', '#6b6cff', '#ff8ffb'];
  return Array.from({ length: count }, () => ({
    x: Math.random() * game.width,
    y: Math.random() * game.height,
    size: Math.random() * 1.8 + 0.4,
    speed: 10 + Math.random() * 30,
    color: palette[Math.floor(Math.random() * palette.length)],
  }));
}

function handleKeyDown(e) {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') { input.left = true; e.preventDefault(); }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') { input.right = true; e.preventDefault(); }
  if (e.key === ' ' || e.key === 'Spacebar') { input.shoot = true; e.preventDefault(); }
  if (e.key === 'r' || e.key === 'R') restart();
}

function handleKeyUp(e) {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') input.left = false;
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') input.right = false;
  if (e.key === ' ' || e.key === 'Spacebar') input.shoot = false;
}

function attachButtons() {
  document.querySelectorAll('[data-action]').forEach(btn => {
    const action = btn.dataset.action;
    btn.addEventListener('pointerdown', e => {
      e.preventDefault();
      if (action === 'left') input.left = true;
      if (action === 'right') input.right = true;
      if (action === 'shoot') input.shoot = true;
    });
    ['pointerup', 'pointerleave'].forEach(evt => {
      btn.addEventListener(evt, () => {
        if (action === 'left') input.left = false;
        if (action === 'right') input.right = false;
        if (action === 'shoot') input.shoot = false;
      });
    });
  });
}

function restart() {
  game.reset();
  lastTime = 0;
  input.left = false;
  input.right = false;
  input.shoot = false;
  resetStatus();
  // Restart loop if it somehow stopped
  if (!animFrameId) animFrameId = requestAnimationFrame(loop);
}

function init() {
  fitCanvas();
  resetStatus();
  updateHud(game.state());
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  restartBtn.addEventListener('click', restart);
  attachButtons();
  animFrameId = requestAnimationFrame(loop);
}

init();
