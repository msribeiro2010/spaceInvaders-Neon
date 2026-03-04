const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

const POWER_TYPES = ['spread', 'rapid', 'laser', 'shield'];

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
    this.input = { left: false, right: false, shoot: false };
    this.bullets = [];
    this.explosions = [];
    this.asteroids = [];
    this.powerUps = [];
    this.scorePopups = [];
    this.ufo = null;
    this.ufoSpawnTimer = 8.0;
    this.muzzleFlash = 0;
    this.invaderDir = 1;
    this.invaderSpeed = 40;
    this.invaderStepDown = 22;
    this.enemyFireTimer = 1.2;
    this.asteroidTimer = 4.0;
    this.shakeTimer = 0;
    this.shakeIntensity = 0;
    this.powerMessage = null;
    this.powerMessageTimer = 0;
    this.player = this.createPlayer();
    this.invaders = this.createInvaders();
    return this.state();
  }

  createPlayer() {
    return {
      x: this.width / 2 - 21,
      y: this.height - 54,
      width: 42,
      height: 18,
      cooldown: 0,
      invuln: 0,
      power: null,
      powerTimer: 0,
      shield: false,
    };
  }

  createInvaders() {
    const rows = Math.min(4 + Math.floor((this.level - 1) / 2), 6);
    const cols = 11;
    const width = 28;
    const height = 20;
    const gapX = 14;
    const gapY = 14;
    const totalWidth = cols * width + (cols - 1) * gapX;
    const startX = (this.width - totalWidth) / 2;
    const startY = 80;
    const invaders = [];
    for (let row = 0; row < rows; row++) {
      const isArmored = this.level >= 3 && row === 0;
      for (let col = 0; col < cols; col++) {
        const isSpecial = this.rng() < 0.12;
        invaders.push({
          x: startX + col * (width + gapX),
          y: startY + row * (height + gapY),
          width,
          height,
          row,
          col,
          alive: true,
          hp: isArmored ? 2 : 1,
          maxHp: isArmored ? 2 : 1,
          isArmored,
          isSpecial,
        });
      }
    }
    return invaders;
  }

  setInput(nextInput) {
    this.input = { ...this.input, ...nextInput };
  }

  getCooldown() {
    return this.player.power === 'rapid' ? 0.14 : 0.32;
  }

  spawnPlayerBullet() {
    const p = this.player;
    const cx = p.x + p.width / 2;
    if (p.power === 'spread') {
      [{ vx: -95, vy: -420 }, { vx: 0, vy: -460 }, { vx: 95, vy: -420 }].forEach(({ vx, vy }) => {
        this.bullets.push({ x: cx - 2, y: p.y - 6, width: 4, height: 12, vy, vx, from: 'player', power: 'spread' });
      });
    } else if (p.power === 'laser') {
      this.bullets.push({ x: cx - 4, y: p.y - 10, width: 8, height: 32, vy: -700, vx: 0, from: 'player', power: 'laser', pierce: true });
    } else {
      this.bullets.push({ x: cx - 2, y: p.y - 6, width: 4, height: 12, vy: -460, vx: 0, from: 'player' });
    }
    this.muzzleFlash = 0.08;
  }

  spawnEnemyBullet(invader) {
    this.bullets.push({
      x: invader.x + invader.width / 2 - 2,
      y: invader.y + invader.height + 2,
      width: 4,
      height: 12,
      vy: 240 + this.level * 16,
      vx: 0,
      from: 'enemy',
    });
  }

  spawnExplosion(x, y, color, big = false) {
    const count = big ? 36 : 18;
    for (let i = 0; i < count; i++) {
      const angle = this.rng() * Math.PI * 2;
      const speed = (big ? 70 : 40) + this.rng() * (big ? 220 : 140);
      this.explosions.push({
        x, y,
        vx: Math.cos(angle) * speed,
        vy: Math.sin(angle) * speed,
        life: (big ? 0.8 : 0.6) + this.rng() * 0.5,
        color,
        size: big ? 3.5 : 2.2,
      });
    }
    if (big) {
      this.shakeTimer = 0.35;
      this.shakeIntensity = 10;
    }
  }

  spawnAsteroid() {
    const size = 16 + this.rng() * 22;
    const x = size + this.rng() * (this.width - size * 2);
    const speed = 55 + this.rng() * 55 + this.level * 7;
    const drift = (this.rng() - 0.5) * 45;
    const hp = size > 30 ? 3 : size > 22 ? 2 : 1;
    const numVerts = 8 + Math.floor(this.rng() * 5);
    const verts = [];
    for (let i = 0; i < numVerts; i++) {
      const angle = (i / numVerts) * Math.PI * 2;
      const r = 0.62 + this.rng() * 0.38;
      verts.push([Math.cos(angle) * r, Math.sin(angle) * r]);
    }
    this.asteroids.push({
      x, y: -size * 2,
      size, vx: drift, vy: speed,
      rot: this.rng() * Math.PI * 2,
      rotSpeed: (this.rng() - 0.5) * 2.8,
      hp, maxHp: hp, verts,
    });
  }

  // ── NAVE MÃE (UFO boss) ──────────────────────────────────────────────────────

  spawnUfo() {
    const lvl = this.level;
    const goRight = this.rng() < 0.5;
    const w = Math.min(80, 52 + lvl * 4);
    this.ufo = {
      x: this.width / 2 - w / 2,
      y: -50,
      width: w,
      height: 28,
      vx: (75 + lvl * 14) * (goRight ? 1 : -1),
      hp: 2 + lvl * 2,
      maxHp: 2 + lvl * 2,
      entering: true,
      targetY: 26,
      fireTimer: 2.0,
      fireRate: Math.max(0.55, 2.2 - lvl * 0.2),
    };
  }

  updateUfo(dt) {
    const u = this.ufo;
    // Slide in from top
    if (u.entering) {
      u.y += 90 * dt;
      if (u.y >= u.targetY) { u.y = u.targetY; u.entering = false; }
      return;
    }
    // Horizontal bounce
    u.x += u.vx * dt;
    if (u.x <= 6) { u.x = 6; u.vx = Math.abs(u.vx); }
    if (u.x + u.width >= this.width - 6) { u.x = this.width - 6 - u.width; u.vx = -Math.abs(u.vx); }
    // Rage speed bonus below 33% HP
    if (u.hp / u.maxHp < 0.33) u.x += u.vx * 0.5 * dt;
    // Fire
    u.fireTimer -= dt;
    if (u.fireTimer <= 0) {
      this.fireUfo();
      const rage = u.hp / u.maxHp < 0.33;
      u.fireTimer = rage ? u.fireRate * 0.6 : u.fireRate;
    }
  }

  fireUfo() {
    const u = this.ufo;
    const cx = u.x + u.width / 2;
    const cy = u.y + u.height + 2;
    const px = this.player.x + this.player.width / 2;
    const py = this.player.y;
    const spd = 165 + this.level * 15;
    const dist = Math.hypot(px - cx, py - cy) || 1;
    const vxA = ((px - cx) / dist) * spd;
    const vyA = ((py - cy) / dist) * spd;
    const hpR = u.hp / u.maxHp;

    const mk = (vx, vy) => ({ x: cx - 3, y: cy, width: 6, height: 14, vx, vy, from: 'enemy' });

    if (hpR > 0.66) {
      this.bullets.push(mk(vxA, vyA));
    } else if (hpR > 0.33) {
      const angle = Math.atan2(vyA, vxA);
      [-0.3, 0, 0.3].forEach(off => {
        const a = angle + off;
        this.bullets.push(mk(Math.cos(a) * spd, Math.sin(a) * spd));
      });
    } else {
      const angle = Math.atan2(vyA, vxA);
      [-0.45, -0.22, 0, 0.22, 0.45].forEach(off => {
        const a = angle + off;
        this.bullets.push(mk(Math.cos(a) * spd * 1.2, Math.sin(a) * spd * 1.2));
      });
    }
  }

  killUfo() {
    const u = this.ufo;
    const cx = u.x + u.width / 2;
    const cy = u.y + u.height / 2;
    const pts = 300 + this.level * 100;

    this.spawnExplosion(cx,      cy,      '#ff79f7', true);
    this.spawnExplosion(cx - 25, cy,      '#ffcc44', true);
    this.spawnExplosion(cx + 25, cy,      '#44ffff', true);

    this.score += pts;
    this.spawnScorePopup(cx, cy - 30, `+${pts} NAVE MÃE!`, '#ff79f7');
    this.spawnPowerUp(cx - 20, cy + 20);
    this.spawnPowerUp(cx + 20, cy + 20);

    this.ufo = null;

    // Advance level
    this.level++;
    this.invaderSpeed = 38 + this.level * 5;
    this.invaderDir = 1;
    this.invaders = this.createInvaders();
    this.bullets = this.bullets.filter(b => b.from === 'player');
    this.asteroids = [];
    this.enemyFireTimer = Math.max(0.4, 1.2 - this.level * 0.07);
    this.asteroidTimer = Math.max(0.9, 4.0 - this.level * 0.25);
    this.ufoSpawnTimer = 8.0;

    this.powerMessage = `*** NÍVEL ${this.level} — PREPARE-SE! ***`;
    this.powerMessageTimer = 3.0;
  }

  // ────────────────────────────────────────────────────────────────────────────

  spawnPowerUp(x, y) {
    const type = POWER_TYPES[Math.floor(this.rng() * POWER_TYPES.length)];
    this.powerUps.push({ x: x - 11, y, width: 22, height: 22, vy: 85, type, spin: 0, alive: true });
  }

  spawnScorePopup(x, y, text, color) {
    this.scorePopups.push({ x, y, text, color, life: 1.5, vy: -55 });
  }

  activatePower(type) {
    if (type === 'shield') {
      this.player.shield = true;
      this.powerMessage = '>>> ESCUDO ATIVADO! <<<';
    } else {
      this.player.power = type;
      this.player.powerTimer = 10.0;
      const names = { spread: '>>> TIRO TRIPLO! <<<', rapid: '>>> TIRO RAPIDO! <<<', laser: '>>> LASER! <<<' };
      this.powerMessage = names[type] || 'POWER UP!';
    }
    this.powerMessageTimer = 2.5;
  }

  update(dt) {
    if (this.gameOver) {
      this.shakeTimer  = Math.max(0, this.shakeTimer - dt);
      this.player.invuln = Math.max(0, this.player.invuln - dt);
      return this.state();
    }

    if (!this.started) {
      if (this.input.left || this.input.right || this.input.shoot) {
        this.started = true;
      } else {
        return this.state();
      }
    }

    // Timers
    this.player.invuln     = Math.max(0, this.player.invuln - dt);
    this.player.cooldown   = Math.max(0, this.player.cooldown - dt);
    this.muzzleFlash       = Math.max(0, this.muzzleFlash - dt);
    this.shakeTimer        = Math.max(0, this.shakeTimer - dt);
    this.powerMessageTimer = Math.max(0, this.powerMessageTimer - dt);

    if (this.player.powerTimer > 0) {
      this.player.powerTimer -= dt;
      if (this.player.powerTimer <= 0) {
        this.player.power = null;
        this.powerMessage = '--- POWER EXPIRADO ---';
        this.powerMessageTimer = 1.5;
      }
    }

    // Player movement
    const moveDir = (this.input.right ? 1 : 0) - (this.input.left ? 1 : 0);
    this.player.x += moveDir * 270 * dt;
    this.player.x = clamp(this.player.x, 16, this.width - this.player.width - 16);

    if (this.input.shoot && this.player.cooldown <= 0) {
      this.spawnPlayerBullet();
      this.player.cooldown = this.getCooldown();
    }

    // UFO (Nave Mãe) boss spawn countdown
    if (!this.ufo) {
      this.ufoSpawnTimer -= dt;
      if (this.ufoSpawnTimer <= 0) {
        this.spawnUfo();
        this.powerMessage = '!!! NAVE MÃE DETECTADA !!!';
        this.powerMessageTimer = 2.5;
      }
    }

    // UFO update
    if (this.ufo) this.updateUfo(dt);

    // Invaders
    const activeInvaders = this.invaders.filter(inv => inv.alive);

    if (activeInvaders.length) {
      const dx = this.invaderDir * this.invaderSpeed * dt;
      let minX = Infinity, maxX = -Infinity;
      activeInvaders.forEach(inv => {
        inv.x += dx;
        minX = Math.min(minX, inv.x);
        maxX = Math.max(maxX, inv.x + inv.width);
      });
      if (minX <= 16 || maxX >= this.width - 16) {
        this.invaderDir *= -1;
        activeInvaders.forEach(inv => { inv.y += this.invaderStepDown; });
        this.invaderSpeed += 3;
      }

      this.enemyFireTimer -= dt;
      if (this.enemyFireTimer <= 0) {
        const shooters = this.getBottomRowInvaders(activeInvaders);
        const shooter = shooters[Math.floor(this.rng() * shooters.length)];
        if (shooter) this.spawnEnemyBullet(shooter);
        this.enemyFireTimer = Math.max(0.35, 1.3 - this.level * 0.08) + this.rng() * 0.4;
      }
    }

    // Asteroid spawning
    this.asteroidTimer -= dt;
    if (this.asteroidTimer <= 0) {
      this.spawnAsteroid();
      this.asteroidTimer = Math.max(0.9, 4.0 - this.level * 0.28) + this.rng() * 1.5;
    }

    // Move bullets
    this.bullets.forEach(b => {
      b.y += b.vy * dt;
      if (b.vx) b.x += b.vx * dt;
    });
    this.bullets = this.bullets.filter(b =>
      b.y + b.height > 0 && b.y < this.height + 10 && b.x > -80 && b.x < this.width + 80
    );

    // Move asteroids
    this.asteroids.forEach(a => {
      a.x += a.vx * dt;
      a.y += a.vy * dt;
      a.rot += a.rotSpeed * dt;
    });
    this.asteroids = this.asteroids.filter(a => a.y - a.size < this.height + 60 && a.hp > 0);

    // Move power-ups
    this.powerUps.forEach(p => { p.y += p.vy * dt; p.spin += 1.8 * dt; });
    this.powerUps = this.powerUps.filter(p => p.y < this.height + 30 && p.alive);

    // Score popups
    this.scorePopups.forEach(sp => { sp.y += sp.vy * dt; sp.life -= dt; });
    this.scorePopups = this.scorePopups.filter(sp => sp.life > 0);

    this.handleCollisions();
    this.updateExplosions(dt);
    this.checkBottomLine(activeInvaders);

    return this.state();
  }

  getBottomRowInvaders(activeInvaders) {
    const byColumn = new Map();
    activeInvaders.forEach(inv => {
      const cur = byColumn.get(inv.col);
      if (!cur || inv.y > cur.y) byColumn.set(inv.col, inv);
    });
    return Array.from(byColumn.values());
  }

  handleCollisions() {
    const playerBullets = this.bullets.filter(b => b.from === 'player');
    const enemyBullets  = this.bullets.filter(b => b.from === 'enemy');

    // Player bullets vs invaders
    playerBullets.forEach(bullet => {
      if (bullet.hit && !bullet.pierce) return;
      this.invaders.forEach(inv => {
        if (!inv.alive) return;
        if (this.hit(bullet, inv)) {
          if (!bullet.pierce) bullet.hit = true;
          inv.hp--;
          if (inv.hp <= 0) {
            inv.alive = false;
            const pts = 10 + (4 - inv.row) * 5 + (inv.isArmored ? 20 : 0) + (inv.isSpecial ? 15 : 0);
            this.score += pts;
            this.spawnExplosion(inv.x + inv.width / 2, inv.y + inv.height / 2, '#7cfcff');
            this.spawnScorePopup(inv.x + inv.width / 2, inv.y, `+${pts}`, '#7cfcff');
            if (inv.isSpecial) this.spawnPowerUp(inv.x + inv.width / 2, inv.y + inv.height / 2);
          } else {
            this.spawnExplosion(inv.x + inv.width / 2, inv.y + inv.height / 2, '#ffcc44');
          }
        }
      });
    });

    // Player bullets vs UFO (Nave Mãe)
    if (this.ufo && !this.ufo.entering) {
      playerBullets.forEach(bullet => {
        if (bullet.hit && !bullet.pierce) return;
        if (this.hit(bullet, this.ufo)) {
          if (!bullet.pierce) bullet.hit = true;
          this.ufo.hp--;
          if (this.ufo.hp <= 0) {
            this.killUfo();
          } else {
            const cx = this.ufo.x + this.rng() * this.ufo.width;
            const cy = this.ufo.y + this.ufo.height / 2;
            this.spawnExplosion(cx, cy, '#ffcc44');
          }
        }
      });
    }

    // Player bullets vs asteroids
    playerBullets.forEach(bullet => {
      if (bullet.hit && !bullet.pierce) return;
      this.asteroids.forEach(ast => {
        if (ast.hp <= 0) return;
        if (this.hitBulletCircle(bullet, ast)) {
          if (!bullet.pierce) bullet.hit = true;
          ast.hp--;
          if (ast.hp <= 0) {
            const pts = Math.floor(ast.maxHp * 15);
            this.score += pts;
            this.spawnExplosion(ast.x, ast.y, '#ff9944', ast.size > 26);
            this.spawnScorePopup(ast.x, ast.y, `+${pts}`, '#ff9944');
            if (ast.size > 26 && this.rng() < 0.45) this.spawnPowerUp(ast.x, ast.y);
          } else {
            this.spawnExplosion(ast.x, ast.y, '#ffcc44');
          }
        }
      });
    });

    // Enemy bullets vs player
    enemyBullets.forEach(bullet => {
      if (this.player.invuln > 0) return;
      if (this.hit(bullet, this.player)) {
        bullet.hit = true;
        this.damagePlayer();
      }
    });

    // Asteroids vs player
    this.asteroids.forEach(ast => {
      if (this.player.invuln > 0) return;
      if (ast.hp <= 0) return;
      if (this.hitCircleRect(ast, this.player)) {
        ast.hp = 0;
        this.spawnExplosion(ast.x, ast.y, '#ff9944', true);
        this.damagePlayer();
      }
    });

    // Power-up collection
    this.powerUps.forEach(pu => {
      if (!pu.alive) return;
      if (this.hit(pu, this.player)) {
        pu.alive = false;
        this.activatePower(pu.type);
      }
    });

    this.bullets = this.bullets.filter(b => !b.hit);
  }

  damagePlayer() {
    if (this.player.shield) {
      this.player.shield = false;
      this.spawnExplosion(this.player.x + this.player.width / 2, this.player.y, '#44aaff');
      this.player.invuln = 0.8;
      this.powerMessage = '!!! ESCUDO QUEBRADO !!!';
      this.powerMessageTimer = 1.5;
      return;
    }
    this.lives--;
    this.spawnExplosion(this.player.x + this.player.width / 2, this.player.y, '#f472ff', true);
    this.player.invuln = 1.5;
    if (this.lives <= 0) this.gameOver = true;
  }

  checkBottomLine(activeInvaders) {
    if (activeInvaders.some(inv => inv.y + inv.height >= this.player.y - 10)) {
      this.gameOver = true;
    }
  }

  updateExplosions(dt) {
    this.explosions.forEach(p => {
      p.life -= dt;
      p.x += p.vx * dt;
      p.y += p.vy * dt;
      p.vx *= 0.97;
      p.vy *= 0.97;
    });
    this.explosions = this.explosions.filter(p => p.life > 0);
  }

  hit(a, b) {
    return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
  }

  hitBulletCircle(bullet, circle) {
    const bx = bullet.x + bullet.width / 2;
    const by = bullet.y + bullet.height / 2;
    return Math.hypot(bx - circle.x, by - circle.y) < circle.size + bullet.width / 2;
  }

  hitCircleRect(circle, rect) {
    const nearX = clamp(circle.x, rect.x, rect.x + rect.width);
    const nearY = clamp(circle.y, rect.y, rect.y + rect.height);
    return Math.hypot(circle.x - nearX, circle.y - nearY) < circle.size * 0.75;
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
      bullets: this.bullets.map(b => ({ ...b })),
      invaders: this.invaders.map(i => ({ ...i })),
      explosions: this.explosions.map(p => ({ ...p })),
      asteroids: this.asteroids.map(a => ({ ...a })),
      powerUps: this.powerUps.map(p => ({ ...p })),
      scorePopups: this.scorePopups.map(sp => ({ ...sp })),
      ufo: this.ufo ? { ...this.ufo } : null,
      ufoSpawnTimer: this.ufoSpawnTimer,
      muzzleFlash: this.muzzleFlash,
      shake: this.shakeTimer > 0 ? this.shakeIntensity * (this.shakeTimer / 0.35) : 0,
      powerMessage: this.powerMessageTimer > 0 ? this.powerMessage : null,
      powerMessageTimer: this.powerMessageTimer,
    };
  }
}
