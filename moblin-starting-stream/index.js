// ==== CONFIGURATION ====
const CANVAS_WIDTH = 1920; // px
const CANVAS_HEIGHT = 1080; // px
const LOGO_SIZE = 100; // px
const SPEED = 1; // px/frame
const GLOBAL_COOLDOWN_MS = 800; // ms between spawns
const MAX_LOGOS = 30; // max logos on screen
const WALL_BOUNCE_COOLDOWN_MS = 100; // ms between a logo's wall bounces
const PER_LOGO_BOUNCE_FRAMES = 30; // frames before a logo can spawn again
const INVINCIBLE_MIN_LOGOS = 20; // min logos required for invincible chance
const MAX_INVINCIBLE_COUNT = 2; // max simultaneous invincible logos
const INVINCIBLE_DURATION = 30000; // ms invincible lasts
const SPAWN_OFFSET = 10; // px from wall when spawning
const TEXT_BOX_WIDTH = 810; // px
const TEXT_BOX_HEIGHT = 105; // px
// ==== END CONFIGURATION ====

class Box {
  constructor(x, y, width, height) {
    this.x = x;
    this.y = y;
    this.width = width;
    this.height = height;
  }

  left() {
    return this.x;
  }

  right() {
    return this.x + this.width;
  }

  top() {
    return this.y;
  }

  bottom() {
    return this.y + this.height;
  }

  centerX() {
    return this.x + this.width / 2;
  }

  centerY() {
    return this.y + this.height / 2;
  }

  intersects(other) {
    return (
      this.left() < other.right() &&
      this.right() > other.left() &&
      this.top() < other.bottom() &&
      this.bottom() > other.top()
    );
  }
}

const canvas = document.getElementById("canvas");
const ctx = canvas.getContext("2d");
canvas.width = CANVAS_WIDTH;
canvas.height = CANVAS_HEIGHT;

const baseLogoSrc = "moblin-logo.svg";
const variantSources = [
  "logo-millionaire.svg",
  "logo-goblin.svg",
  "logo-goblina.svg",
  "logo-heart.svg",
  "logo-king.svg",
  "logo-looking.svg",
  "logo-party.svg",
  "logo-queen.svg",
];

const allSources = [baseLogoSrc, ...variantSources];
const loadedImages = {};
const logos = [];
const canvasBox = new Box(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
const textBox = new Box(
  (CANVAS_WIDTH - TEXT_BOX_WIDTH) / 2,
  (CANVAS_HEIGHT - TEXT_BOX_HEIGHT) / 2,
  TEXT_BOX_WIDTH,
  TEXT_BOX_HEIGHT
);

function preloadImages(sources, callback) {
  let loaded = 0;
  for (const source of sources) {
    const image = new Image();
    image.src = source;
    image.onload = () => {
      loadedImages[source] = image;
      if (++loaded === sources.length) callback();
    };
  }
}

function getRandomImage() {
  return loadedImages[
    variantSources[Math.floor(Math.random() * variantSources.length)]
  ];
}

class Logo {
  lastWallBounceTime = 0;

  constructor(x, y, dx, dy, image) {
    this.box = new Box(x, y, LOGO_SIZE, LOGO_SIZE);
    this.dx = dx;
    this.dy = dy;
    this.prevDx = dx;
    this.prevDy = dy;
    this.image = image;
    this.bounceCooldown = 0;
    this.lastSpawnTime = 0;
    this.spawnTime = performance.now();
    this.directionFlips = [];
    this.isInvincible = false;
    this.invincibleStart = 0;
  }

  reset() {
    this.box.x = Math.random() * (canvasBox.width - LOGO_SIZE);
    this.box.y = Math.random() * (canvasBox.height - LOGO_SIZE);
    const a = Math.random() * 2 * Math.PI;
    this.dx = Math.cos(a) * SPEED;
    this.dy = Math.sin(a) * SPEED;
    this.directionFlips = [];
    this.spawnTime = performance.now();
  }

  move(currentTime) {
    this.box.x += this.dx;
    this.box.y += this.dy;

    // track rapid flips
    const now = currentTime;
    if (
      Math.sign(this.dx) !== Math.sign(this.prevDx) ||
      Math.sign(this.dy) !== Math.sign(this.prevDy)
    ) {
      this.directionFlips.push(now);
      this.prevDx = this.dx;
      this.prevDy = this.dy;
    }
    this.directionFlips = this.directionFlips.filter((t) => now - t < 1000);
    if (this.directionFlips.length >= 8) {
      this.reset();
      return null;
    }
    if (this.bounceCooldown > 0) this.bounceCooldown--;

    let bounced = false;
    let wallBounce = null;

    if (this.box.left() <= canvasBox.left()) {
      this.box.x = canvasBox.left() + 1;
      this.dx *= -1;
      bounced = true;
      wallBounce = { x: 1, y: 0 };
    } else if (this.box.right() >= canvasBox.right()) {
      this.box.x = canvasBox.right() - this.box.width - 1;
      this.dx *= -1;
      bounced = true;
      wallBounce = { x: 1, y: 0 };
    }

    if (this.box.top() <= canvasBox.top()) {
      this.box.y = canvasBox.top() + 1;
      this.dy *= -1;
      bounced = true;
      wallBounce = { x: 0, y: 1 };
    } else if (this.box.bottom() >= canvasBox.bottom()) {
      this.box.y = canvasBox.bottom() - this.box.height - 1;
      this.dy *= -1;
      bounced = true;
      wallBounce = { x: 0, y: 1 };
    }

    // spawn on bounce if cooldowns allow
    if (
      bounced &&
      this.bounceCooldown === 0 &&
      now - this.lastWallBounceTime > WALL_BOUNCE_COOLDOWN_MS &&
      now - this.lastSpawnTime >= GLOBAL_COOLDOWN_MS
    ) {
      this.bounceCooldown = PER_LOGO_BOUNCE_FRAMES;
      this.lastWallBounceTime = now;
      this.lastSpawnTime = now;
      return wallBounce;
    }

    return null;
  }

  draw() {
    const angle = Math.atan2(this.dy, this.dx);
    ctx.save();
    ctx.translate(this.box.centerX(), this.box.centerY());
    ctx.rotate(angle);
    ctx.drawImage(
      this.image,
      -this.image.width / 2,
      -this.image.height / 2,
      this.image.width,
      this.image.height
    );
    ctx.restore();
  }
}

preloadImages(allSources, () => {
  logos.push(
    new Logo(
      canvasBox.width / 4,
      canvasBox.height / 3,
      SPEED,
      SPEED * 0.7,
      loadedImages[baseLogoSrc]
    )
  );
  requestAnimationFrame(animate);
});

let globalLastSpawnTime = 0;

function animate(timestamp) {
  ctx.clearRect(0, 0, canvasBox.width, canvasBox.height);
  const newLogos = [];

  for (let i = logos.length - 1; i >= 0; i--) {
    const logo = logos[i];
    const wallBounce = logo.move(timestamp);

    // ——— TEXT COLLISION FOR NORMAL LOGOS ———
    if (!logo.isInvincible) {
      if (textBox.intersects(logo.box)) {
        // determine collision side
        const overlapTextLeft = logo.box.right() - textBox.left();
        const overlapTextRight = textBox.right() - logo.box.left();
        const overlapTextTop = logo.box.bottom() - textBox.top();
        const overlapTextBottom = textBox.bottom() - logo.box.top();

        const minOverlapX = Math.min(overlapTextLeft, overlapTextRight);
        const minOverlapY = Math.min(overlapTextTop, overlapTextBottom);

        if (minOverlapX < minOverlapY) {
          if (overlapTextLeft < overlapTextRight) {
            logo.box.x = textBox.left() - logo.box.width - 1;
            logo.dx = -Math.abs(logo.dx);
          } else {
            logo.box.x = textBox.right() + 1;
            logo.dx = Math.abs(logo.dx);
          }
        } else {
          if (overlapTextTop < overlapTextBottom) {
            logo.box.y = textBox.top() - logo.box.height - 1;
            logo.dy = -Math.abs(logo.dy);
          } else {
            logo.box.y = textBox.bottom() + 1;
            logo.dy = Math.abs(logo.dy);
          }
        }
      }
    }

    // ——— DRAW WITH POSSIBLE HUE FILTER ———
    if (logo.isInvincible) {
      const t = (timestamp - logo.invincibleStart) / 1000;
      ctx.filter = `hue-rotate(${(t * 360) % 360}deg)`;
    } else {
      ctx.filter = "none";
    }
    logo.draw();
    ctx.filter = "none";

    // ——— LOGO–LOGO COLLISIONS & INVINCIBLE KILLS ———
    for (const other of logos) {
      if (other === logo) continue;
      if (timestamp - logo.spawnTime < 500 || timestamp - other.spawnTime < 500)
        continue;

      const dx = other.box.x - logo.box.x;
      const dy = other.box.y - logo.box.y;
      const dist = Math.hypot(dx, dy);
      const minDist = (logo.box.width + other.box.width) / 2;

      // invincible destroys
      if (
        logo.isInvincible &&
        !other.isInvincible &&
        dist < minDist &&
        dist > 0
      ) {
        logos.splice(logos.indexOf(other), 1);
        continue;
      }

      // normal bounce
      if (dist < minDist && dist > 0) {
        const overlap = minDist - dist;
        const nx = dx / dist;
        const ny = dy / dist;
        logo.box.x -= (nx * overlap) / 2;
        logo.box.y -= (ny * overlap) / 2;
        other.box.x += (nx * overlap) / 2;
        other.box.y += (ny * overlap) / 2;
        const dot = logo.dx * nx + logo.dy * ny;
        logo.dx -= 2 * dot * nx;
        logo.dy -= 2 * dot * ny;
      }
    }

    // ——— SPAWN NEW ON WALL BOUNCE ———
    if (
      wallBounce &&
      logos.length + newLogos.length < MAX_LOGOS &&
      timestamp - globalLastSpawnTime >= GLOBAL_COOLDOWN_MS
    ) {
      // invincibility logic
      const invCount = logos.filter((l) => l.isInvincible).length;
      const chance = Math.min(logos.length, 100) / 100;
      if (
        !logo.isInvincible &&
        invCount < MAX_INVINCIBLE_COUNT &&
        logos.length >= INVINCIBLE_MIN_LOGOS &&
        Math.random() < chance
      ) {
        logo.isInvincible = true;
        logo.invincibleStart = timestamp;
        setTimeout(() => (logo.isInvincible = false), INVINCIBLE_DURATION);
      }

      globalLastSpawnTime = timestamp;

      // compute spawn angle & pos
      let angle;
      if (wallBounce.x === 1) {
        if (logo.box.centerX() < canvasBox.centerX()) {
          angle = Math.random() * (Math.PI - 0.4) + 0.2;
        } else {
          angle = Math.random() * (Math.PI - 0.4) + 0.2 + Math.PI;
        }
      } else {
        if (logo.box.centerY() < canvasBox.centerY()) {
          angle = Math.random() * (Math.PI - 0.4) + 0.2 + Math.PI / 2;
        } else {
          angle = Math.random() * (Math.PI - 0.4) + 0.2 - Math.PI / 2;
        }
      }
      const dx = Math.cos(angle) * SPEED;
      const dy = Math.sin(angle) * SPEED;

      let x = logo.box.x + dx * SPAWN_OFFSET - LOGO_SIZE / 2;
      let y = logo.box.y + dy * SPAWN_OFFSET - LOGO_SIZE / 2;
      x = Math.max(0, Math.min(canvasBox.width - LOGO_SIZE, x));
      y = Math.max(0, Math.min(canvasBox.height - LOGO_SIZE, y));

      newLogos.push(new Logo(x, y, dx, dy, getRandomImage()));
    }
  }

  logos.push(...newLogos);
  requestAnimationFrame(animate);
}
