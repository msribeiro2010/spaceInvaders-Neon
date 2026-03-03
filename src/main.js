import { SpaceInvadersGame } from './game.mjs';

const board = document.getElementById('board');
const scoreEl = document.getElementById('score');
const livesEl = document.getElementById('lives');
const levelEl = document.getElementById('level');
const statusEl = document.getElementById('status');
const restartBtn = document.getElementById('restart');
const ctx = board.getContext('2d');

const game = new SpaceInvadersGame({ width: 700, height: 520 });
const stars = createStars(120);

const input = {
  left: false,
  right: false,
  shoot: false,
};

let lastTime = 0;
let rafId = null;

function fitCanvas() {
  board.width = game.width;
  board.height = game.height;
}

function setStatus(text) {
  statusEl.textContent = text;
}

function resetStatus() {
  setStatus('Pressione setas ou ESPACO para comecar.');
}

function loop(timestamp) {
  if (!lastTime) lastTime = timestamp;
  const dt = Math.min(0.033, (timestamp - lastTime) / 1000);
  lastTime = timestamp;

  game.setInput(input);
  const state = game.update(dt);
  draw(state, dt);
  updateHud(state);

  if (state.gameOver) {
    setStatus('Fim de jogo. Aperte R ou reiniciar.');
  }

  rafId = requestAnimationFrame(loop);
}

function updateHud(state) {
  scoreEl.textContent = state.score;
  livesEl.textContent = state.lives;
  levelEl.textContent = state.level;
}

function draw(state, dt) {
  drawBackground(dt);
  drawInvaders(state.invaders);
  drawBullets(state.bullets);
  drawExplosions(state.explosions);
  drawPlayer(state.player, state.muzzleFlash, state.player.invuln > 0);
}

function drawBackground(dt) {
  const gradient = ctx.createLinearGradient(0, 0, 0, board.height);
  gradient.addColorStop(0, '#05040d');
  gradient.addColorStop(0.5, '#070b1f');
  gradient.addColorStop(1, '#040609');
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, board.width, board.height);

  ctx.save();
  ctx.globalAlpha = 0.7;
  stars.forEach((star) => {
    star.y += star.speed * dt;
    if (star.y > board.height) {
      star.y = -10;
      star.x = Math.random() * board.width;
    }
    ctx.fillStyle = star.color;
    ctx.beginPath();
    ctx.arc(star.x, star.y, star.size, 0, Math.PI * 2);
    ctx.fill();
  });
  ctx.restore();

  ctx.strokeStyle = 'rgba(64, 209, 255, 0.12)';
  ctx.lineWidth = 1;
  for (let x = 40; x < board.width; x += 60) {
    ctx.beginPath();
    ctx.moveTo(x, 0);
    ctx.lineTo(x, board.height);
    ctx.stroke();
  }
}

function drawInvaders(invaders) {
  invaders.forEach((invader) => {
    if (!invader.alive) return;
    const hue = 180 + invader.row * 18;
    ctx.save();
    ctx.shadowColor = `hsla(${hue}, 100%, 70%, 0.8)`;
    ctx.shadowBlur = 12;
    ctx.fillStyle = `hsla(${hue}, 100%, 65%, 0.85)`;
    ctx.fillRect(invader.x, invader.y, invader.width, invader.height);
    ctx.fillStyle = 'rgba(10, 8, 20, 0.8)';
    ctx.fillRect(invader.x + 5, invader.y + 5, invader.width - 10, invader.height - 10);
    ctx.restore();
  });
}

function drawPlayer(player, muzzleFlash, flicker) {
  ctx.save();
  if (flicker && Math.random() > 0.5) {
    ctx.globalAlpha = 0.35;
  }

  ctx.shadowColor = '#63f2ff';
  ctx.shadowBlur = 18;
  ctx.fillStyle = '#5bf9ff';
  ctx.beginPath();
  ctx.moveTo(player.x, player.y + player.height);
  ctx.lineTo(player.x + player.width / 2, player.y - 6);
  ctx.lineTo(player.x + player.width, player.y + player.height);
  ctx.closePath();
  ctx.fill();

  ctx.shadowBlur = 0;
  ctx.fillStyle = '#0b1022';
  ctx.fillRect(player.x + 10, player.y + 6, player.width - 20, player.height - 6);

  if (muzzleFlash > 0) {
    ctx.globalAlpha = Math.min(1, muzzleFlash * 14);
    ctx.fillStyle = '#fdf4ff';
    ctx.fillRect(player.x + player.width / 2 - 3, player.y - 12, 6, 10);
  }
  ctx.restore();
}

function drawBullets(bullets) {
  bullets.forEach((bullet) => {
    ctx.save();
    const isPlayer = bullet.from === 'player';
    ctx.shadowColor = isPlayer ? '#6af7ff' : '#ff70e0';
    ctx.shadowBlur = 10;
    ctx.fillStyle = isPlayer ? '#9efcff' : '#ff9bed';
    ctx.fillRect(bullet.x, bullet.y, bullet.width, bullet.height);
    ctx.restore();
  });
}

function drawExplosions(explosions) {
  explosions.forEach((particle) => {
    ctx.save();
    ctx.globalAlpha = Math.max(0, particle.life);
    ctx.shadowColor = particle.color;
    ctx.shadowBlur = 10;
    ctx.fillStyle = particle.color;
    ctx.beginPath();
    ctx.arc(particle.x, particle.y, 2.2, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  });
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
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    input.left = true;
    e.preventDefault();
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    input.right = true;
    e.preventDefault();
  }
  if (e.key === ' ' || e.key === 'Spacebar') {
    input.shoot = true;
    e.preventDefault();
  }
  if (e.key === 'r' || e.key === 'R') {
    restart();
  }
}

function handleKeyUp(e) {
  if (e.key === 'ArrowLeft' || e.key === 'a' || e.key === 'A') {
    input.left = false;
    e.preventDefault();
  }
  if (e.key === 'ArrowRight' || e.key === 'd' || e.key === 'D') {
    input.right = false;
    e.preventDefault();
  }
  if (e.key === ' ' || e.key === 'Spacebar') {
    input.shoot = false;
    e.preventDefault();
  }
}

function attachButtons() {
  document.querySelectorAll('[data-action]').forEach((btn) => {
    const action = btn.dataset.action;
    btn.addEventListener('pointerdown', (e) => {
      e.preventDefault();
      if (action === 'left') input.left = true;
      if (action === 'right') input.right = true;
      if (action === 'shoot') input.shoot = true;
    });
    btn.addEventListener('pointerup', () => {
      if (action === 'left') input.left = false;
      if (action === 'right') input.right = false;
      if (action === 'shoot') input.shoot = false;
    });
    btn.addEventListener('pointerleave', () => {
      if (action === 'left') input.left = false;
      if (action === 'right') input.right = false;
      if (action === 'shoot') input.shoot = false;
    });
  });
}

function restart() {
  game.reset();
  input.left = false;
  input.right = false;
  input.shoot = false;
  resetStatus();
}

function init() {
  fitCanvas();
  resetStatus();
  updateHud(game.state());
  window.addEventListener('keydown', handleKeyDown);
  window.addEventListener('keyup', handleKeyUp);
  restartBtn.addEventListener('click', () => restart());
  attachButtons();
  rafId = requestAnimationFrame(loop);
}

init();
