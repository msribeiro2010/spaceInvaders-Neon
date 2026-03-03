const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

export class SpaceInvadersGame {
  constructor({ width = 700, height = 520, rng = Math.random } = {}) {
    this.width = width;
    this.height = height;
    this.rng = rng;
    this.reset();
  }

  reset() {
    this.score = 0;
    this.lives = 3;
    this.level = 1;
    this.started = false;
    this.gameOver = false;
    this.win = false;
    this.input = { left: false, right: false, shoot: false };
    this.bullets = [];
    this.explosions = [];
    this.muzzleFlash = 0;
    this.invaderDir = 1;
    this.invaderSpeed = 40;
    this.invaderStepDown = 22;
    this.enemyFireTimer = 1.2;
    this.player = this.createPlayer();
    this.invaders = this.createInvaders();
    return this.state();
  }

  createPlayer() {
    const width = 42;
    const height = 18;
    return {
      x: this.width / 2 - width / 2,
      y: this.height - 54,
      width,
      height,
      cooldown: 0,
      invuln: 0,
    };
  }

  createInvaders() {
    const rows = 5;
    const cols = 11;
    const width = 28;
    const height = 20;
    const gapX = 14;
    const gapY = 14;
    const totalWidth = cols * width + (cols - 1) * gapX;
    const startX = (this.width - totalWidth) / 2;
    const startY = 70;
    const invaders = [];
    for (let row = 0; row < rows; row += 1) {
      for (let col = 0; col < cols; col += 1) {
        invaders.push({
          x: startX + col * (width + gapX),
          y: startY + row * (height + gapY),
          width,
          height,
          row,
          col,
          alive: true,
        });
      }
    }
    return invaders;
  }

  setInput(nextInput) {
    this.input = { ...this.input, ...nextInput };
  }

  spawnPlayerBullet() {
    this.bullets.push({
      x: this.player.x + this.player.width / 2 - 2,
      y: this.player.y - 6,
      width: 4,
      height: 12,
      vy: -460,
      from: 'player',
    });
    this.muzzleFlash = 0.08;
  }

  spawnEnemyBullet(invader) {
    this.bullets.push({
      x: invader.x + invader.width / 2 - 2,
      y: invader.y + invader.height + 2,
      width: 4,
      height: 12,
      vy: 260 + this.level * 20,
      from: 'enemy',
    });
  }

  spawnExplosion(x, y, color) {
    const count = 18;
    for (let i = 0; i < count; i += 1) {
      const angle = this.rng() * Math.PI * 2;
      const speed = 40 + this.rng() * 140;
      this.explosions.push({
        x,
        y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: 0.6 + this.rng() * 0.4,
        color,
      });
    }
  }

  update(dt) {
    if (this.gameOver) return this.state();

    if (!this.started) {
      if (this.input.left || this.input.right || this.input.shoot) {
        this.started = true;
      } else {
        return this.state();
      }
    }

    this.player.invuln = Math.max(0, this.player.invuln - dt);
    this.player.cooldown = Math.max(0, this.player.cooldown - dt);
    this.muzzleFlash = Math.max(0, this.muzzleFlash - dt);

    const moveDir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    const speed = 260;
    this.player.x += moveDir * speed * dt;
    this.player.x = clamp(this.player.x, 16, this.width - this.player.width - 16);

    if (this.input.shoot && this.player.cooldown <= 0) {
      this.spawnPlayerBullet();
      this.player.cooldown = 0.32;
    }

    let activeInvaders = this.invaders.filter((invader) => invader.alive);
    if (!activeInvaders.length) {
      this.level += 1;
      this.invaderSpeed += 10;
      this.invaderDir = 1;
      this.invaders = this.createInvaders();
      this.bullets = [];
      this.enemyFireTimer = Math.max(0.6, 1.2 - this.level * 0.08);
      activeInvaders = this.invaders.filter((invader) => invader.alive);
    }

    const dx = this.invaderDir * this.invaderSpeed * dt;
    let minX = Infinity;
    let maxX = -Infinity;
    activeInvaders.forEach((invader) => {
      invader.x += dx;
      minX = Math.min(minX, invader.x);
      maxX = Math.max(maxX, invader.x + invader.width);
    });

    const margin = 16;
    if (minX <= margin || maxX >= this.width - margin) {
      this.invaderDir *= -1;
      activeInvaders.forEach((invader) => {
        invader.y += this.invaderStepDown;
      });
      this.invaderSpeed += 4;
    }

    this.enemyFireTimer -= dt;
    if (this.enemyFireTimer <= 0 && activeInvaders.length) {
      const shooters = this.getBottomRowInvaders(activeInvaders);
      const shooter = shooters[Math.floor(this.rng() * shooters.length)];
      if (shooter) this.spawnEnemyBullet(shooter);
      const base = Math.max(0.5, 1.3 - this.level * 0.08);
      this.enemyFireTimer = base + this.rng() * 0.5;
    }

    this.bullets.forEach((bullet) => {
      bullet.y += bullet.vy * dt;
    });
    this.bullets = this.bullets.filter(
      (bullet) => bullet.y + bullet.height > 0 && bullet.y < this.height + 10
    );

    this.handleCollisions();
    this.updateExplosions(dt);
    this.checkBottomLine(activeInvaders);

    return this.state();
  }

  getBottomRowInvaders(activeInvaders) {
    const byColumn = new Map();
    activeInvaders.forEach((invader) => {
      const current = byColumn.get(invader.col);
      if (!current || invader.y > current.y) {
        byColumn.set(invader.col, invader);
      }
    });
    return Array.from(byColumn.values());
  }

  handleCollisions() {
    const playerBullets = this.bullets.filter((bullet) => bullet.from === 'player');
    const enemyBullets = this.bullets.filter((bullet) => bullet.from === 'enemy');

    playerBullets.forEach((bullet) => {
      if (bullet.hit) return;
      this.invaders.forEach((invader) => {
        if (bullet.hit) return;
        if (!invader.alive) return;
        if (this.hit(bullet, invader)) {
          invader.alive = false;
          bullet.hit = true;
          const points = 10 + (4 - invader.row) * 5;
          this.score += points;
          this.spawnExplosion(invader.x + invader.width / 2, invader.y + invader.height / 2, '#7cfcff');
        }
      });
    });

    enemyBullets.forEach((bullet) => {
      if (this.player.invuln > 0) return;
      if (this.hit(bullet, this.player)) {
        bullet.hit = true;
        this.lives -= 1;
        this.spawnExplosion(this.player.x + this.player.width / 2, this.player.y, '#f472ff');
        this.player.invuln = 1.2;
        if (this.lives <= 0) {
          this.gameOver = true;
        }
      }
    });

    this.bullets = this.bullets.filter((bullet) => !bullet.hit);
  }

  checkBottomLine(activeInvaders) {
    const dangerLine = this.player.y - 10;
    if (activeInvaders.some((invader) => invader.y + invader.height >= dangerLine)) {
      this.gameOver = true;
    }
  }

  updateExplosions(dt) {
    this.explosions.forEach((particle) => {
      particle.life -= dt;
      particle.x += particle.vx * dt;
      particle.y += particle.vy * dt;
      particle.vx *= 0.98;
      particle.vy *= 0.98;
    });
    this.explosions = this.explosions.filter((particle) => particle.life > 0);
  }

  hit(a, b) {
    return (
      a.x < b.x + b.width &&
      a.x + a.width > b.x &&
      a.y < b.y + b.height &&
      a.y + a.height > b.y
    );
  }

  state() {
    return {
      width: this.width,
      height: this.height,
      score: this.score,
      lives: this.lives,
      level: this.level,
      started: this.started,
      gameOver: this.gameOver,
      player: { ...this.player },
      bullets: this.bullets.map((b) => ({ ...b })),
      invaders: this.invaders.map((i) => ({ ...i })),
      explosions: this.explosions.map((p) => ({ ...p })),
      muzzleFlash: this.muzzleFlash,
    };
  }
}
