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

function getRandomVariant() {
  return loadedImages[
    variantSources[Math.floor(Math.random() * variantSources.length)]
  ];
}

class Logo {
  lastWallBounceTime = 0;

  constructor(x, y, dx, dy, image) {
    this.x = x;
    this.y = y;
    this.dx = dx;
    this.dy = dy;
    this.prevDx = dx;
    this.prevDy = dy;
    this.image = image;
    this.size = LOGO_SIZE;
    this.bounceCooldown = 0;
    this.lastSpawnTime = 0;
    this.spawnTime = performance.now();
    this.directionFlips = [];
    this.isInvincible = false;
    this.invincibleStart = 0;
  }

  move(currentTime) {
    this.x += this.dx;
    this.y += this.dy;

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
    if (this.directionFlips.length >= 8) return "glitched";
    if (this.bounceCooldown > 0) this.bounceCooldown--;

    let bounced = false;
    let wallNormal = null;

    // left wall
    if (this.x <= 0) {
      this.x = 1;
      this.dx *= -1;
      bounced = true;
      wallNormal = { x: 1, y: 0 };
    }
    // right wall
    else if (this.x + this.size >= CANVAS_WIDTH) {
      this.x = CANVAS_WIDTH - this.size - 1;
      this.dx *= -1;
      bounced = true;
      wallNormal = { x: 1, y: 0 };
    }

    // top wall
    if (this.y <= 0) {
      this.y = 1;
      this.dy *= -1;
      bounced = true;
      wallNormal = { x: 0, y: 1 };
    }
    // bottom wall
    else if (this.y + this.size >= CANVAS_HEIGHT) {
      this.y = CANVAS_HEIGHT - this.size - 1;
      this.dy *= -1;
      bounced = true;
      wallNormal = { x: 0, y: 1 };
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
      return wallNormal;
    }
    return null;
  }

  draw() {
    const angle = Math.atan2(this.dy, this.dx);
    ctx.save();
    ctx.translate(
      this.x + this.image.width / 2,
      this.y + this.image.height / 2
    );
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
      CANVAS_WIDTH / 4,
      CANVAS_HEIGHT / 3,
      SPEED,
      SPEED * 0.7,
      loadedImages[baseLogoSrc]
    )
  );
  requestAnimationFrame(animate);
});

let globalLastSpawnTime = 0;

function animate(timestamp) {
  ctx.clearRect(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
  const newLogos = [];

  for (let i = logos.length - 1; i >= 0; i--) {
    const logo = logos[i];
    const result = logo.move(timestamp);

    // reset glitched logos
    if (result === "glitched") {
      logo.x = Math.random() * (CANVAS_WIDTH - LOGO_SIZE);
      logo.y = Math.random() * (CANVAS_HEIGHT - LOGO_SIZE);
      const a = Math.random() * 2 * Math.PI;
      logo.dx = Math.cos(a) * SPEED;
      logo.dy = Math.sin(a) * SPEED;
      logo.directionFlips = [];
      logo.spawnTime = performance.now();
      continue;
    }

    // ——— TEXT COLLISION FOR NORMAL LOGOS ———
    if (!logo.isInvincible) {
      const textX = (CANVAS_WIDTH - TEXT_BOX_WIDTH) / 2;
      const textY = (CANVAS_HEIGHT - TEXT_BOX_HEIGHT) / 2;
      if (
        logo.x < textX + TEXT_BOX_WIDTH &&
        logo.x + logo.size > textX &&
        logo.y < textY + TEXT_BOX_HEIGHT &&
        logo.y + logo.size > textY
      ) {
        // determine collision side
        const centerX = logo.x + logo.size / 2;
        const centerY = logo.y + logo.size / 2;
        const overlapX = Math.min(
          centerX - textX,
          textX + TEXT_BOX_WIDTH - centerX
        );
        const overlapY = Math.min(
          centerY - textY,
          textY + TEXT_BOX_HEIGHT - centerY
        );

        if (overlapX < overlapY) {
          // horizontal side
          if (centerX < textX + TEXT_BOX_WIDTH / 2) {
            logo.x = textX - logo.size - 1;
            logo.dx = -Math.abs(logo.dx);
          } else {
            logo.x = textX + TEXT_BOX_WIDTH + 1;
            logo.dx = Math.abs(logo.dx);
          }
        } else {
          // vertical side
          if (centerY < textY + TEXT_BOX_HEIGHT / 2) {
            logo.y = textY - logo.size - 1;
            logo.dy = -Math.abs(logo.dy);
          } else {
            logo.y = textY + TEXT_BOX_HEIGHT + 1;
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

      const dx = other.x - logo.x;
      const dy = other.y - logo.y;
      const dist = Math.hypot(dx, dy);
      const minDist = (logo.size + other.size) / 2;

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
        logo.x -= (nx * overlap) / 2;
        logo.y -= (ny * overlap) / 2;
        other.x += (nx * overlap) / 2;
        other.y += (ny * overlap) / 2;
        const dot = logo.dx * nx + logo.dy * ny;
        logo.dx -= 2 * dot * nx;
        logo.dy -= 2 * dot * ny;
      }
    }

    // ——— SPAWN NEW ON WALL BOUNCE ———
    if (
      result &&
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
      if (result.x === 1) {
        angle =
          logo.x < CANVAS_WIDTH / 2
            ? Math.random() * (Math.PI - 0.4) + 0.2
            : Math.random() * (Math.PI - 0.4) + 0.2 + Math.PI;
      } else {
        angle =
          logo.y < CANVAS_HEIGHT / 2
            ? Math.random() * (Math.PI - 0.4) + 0.2 + Math.PI / 2
            : Math.random() * (Math.PI - 0.4) + 0.2 - Math.PI / 2;
      }
      const dx = Math.cos(angle) * SPEED;
      const dy = Math.sin(angle) * SPEED;
      const img = getRandomVariant();

      let sx = logo.x + dx * SPAWN_OFFSET - LOGO_SIZE / 2;
      let sy = logo.y + dy * SPAWN_OFFSET - LOGO_SIZE / 2;
      sx = Math.max(0, Math.min(CANVAS_WIDTH - LOGO_SIZE, sx));
      sy = Math.max(0, Math.min(CANVAS_HEIGHT - LOGO_SIZE, sy));

      newLogos.push(new Logo(sx, sy, dx, dy, img));
    }
  }

  logos.push(...newLogos);
  requestAnimationFrame(animate);
}
