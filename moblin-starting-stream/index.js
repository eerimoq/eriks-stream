const CANVAS_WIDTH = 1920; // px
const CANVAS_HEIGHT = 1080; // px
const LOGO_SIZE = 100; // px
const SPEED = 1; // px/frame
const SPAWN_COOLDOWN_MS = 2000; // ms between spawns
const MAX_LOGOS = 20; // max logos on screen
const WALL_BOUNCE_COOLDOWN_MS = 100; // ms between a logo's wall bounces
const INVINCIBLE_DURATION = 20000; // ms invincible lasts
const SPAWN_OFFSET = 10; // px from wall when spawning
const TEXT_BOX_WIDTH = 810; // px
const TEXT_BOX_HEIGHT = 105; // px

class Velocity {
  constructor(x, y) {
    this.x = x;
    this.y = y;
  }

  isSameDirection(other) {
    return (
      Math.sign(this.x) === Math.sign(other.x) &&
      Math.sign(this.y) === Math.sign(other.y)
    );
  }

  clone() {
    return new Velocity(this.x, this.y);
  }
}

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

const baseLogoName = "moblin-logo";
const variantLogoNames = [
  "logo-millionaire",
  "logo-goblin",
  "logo-goblina",
  "logo-heart",
  "logo-king",
  "logo-looking",
  "logo-party",
  "logo-queen",
];

const allLogoNames = [baseLogoName, ...variantLogoNames];
const loadedImages = {};
const logos = [];
const canvasBox = new Box(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
const textBox = new Box(
  (CANVAS_WIDTH - TEXT_BOX_WIDTH) / 2,
  (CANVAS_HEIGHT - TEXT_BOX_HEIGHT) / 2,
  TEXT_BOX_WIDTH,
  TEXT_BOX_HEIGHT
);

function preloadImages(names, callback) {
  let loaded = 0;
  for (const name of names) {
    const image = new Image();
    image.src = `${name}.svg`;
    image.onload = () => {
      const invincibleImage = new Image();
      invincibleImage.src = `${name}-invincible.svg`;
      invincibleImage.onload = () => {
        loadedImages[name] = { normal: image, invincible: invincibleImage };
        if (++loaded === names.length) callback();
      };
    };
  }
}

function getRandomImages() {
  return loadedImages[
    allLogoNames[Math.floor(Math.random() * allLogoNames.length)]
  ];
}

class Logo {
  constructor(x, y, dx, dy, images) {
    this.box = new Box(x, y, LOGO_SIZE, LOGO_SIZE);
    this.velocity = new Velocity(dx, dy);
    this.prevVelocity = new Velocity(dx, dy);
    this.images = images;
    this.spawnTime = performance.now();
    this.directionFlips = [];
    this.isInvincible = false;
    this.invincibleStart = 0;
  }

  reset() {
    this.box.x = Math.random() * (canvasBox.width - LOGO_SIZE);
    this.box.y = Math.random() * (canvasBox.height - LOGO_SIZE);
    const angle = Math.random() * 2 * Math.PI;
    this.velocity.x = Math.cos(angle) * SPEED;
    this.velocity.y = Math.sin(angle) * SPEED;
    this.directionFlips = [];
    this.spawnTime = performance.now();
  }

  move(currentTime) {
    this.box.x += this.velocity.x;
    this.box.y += this.velocity.y;

    // track rapid flips
    const now = currentTime;
    if (!this.velocity.isSameDirection(this.prevVelocity)) {
      this.directionFlips.push(now);
      this.prevVelocity = this.velocity.clone();
    }
    this.directionFlips = this.directionFlips.filter((t) => now - t < 1000);
    if (this.directionFlips.length >= 8) {
      this.reset();
      return null;
    }

    let wallBounce = null;

    if (this.box.left() <= canvasBox.left()) {
      this.box.x = canvasBox.left() + 1;
      this.velocity.x *= -1;
      wallBounce = "x";
    } else if (this.box.right() >= canvasBox.right()) {
      this.box.x = canvasBox.right() - this.box.width - 1;
      this.velocity.x *= -1;
      wallBounce = "x";
    }

    if (this.box.top() <= canvasBox.top()) {
      this.box.y = canvasBox.top() + 1;
      this.velocity.y *= -1;
      wallBounce = "y";
    } else if (this.box.bottom() >= canvasBox.bottom()) {
      this.box.y = canvasBox.bottom() - this.box.height - 1;
      this.velocity.y *= -1;
      wallBounce = "y";
    }

    return wallBounce;
  }

  draw() {
    const angle = Math.atan2(this.velocity.y, this.velocity.x);
    ctx.save();
    let image = this.images.normal;
    if (this.isInvincible) {
      image = this.images.invincible;
    }
    ctx.translate(this.box.centerX(), this.box.centerY());
    ctx.rotate(angle);
    ctx.drawImage(
      image,
      -image.width / 2,
      -image.height / 2,
      image.width,
      image.height
    );
    ctx.restore();
  }
}

preloadImages(allLogoNames, () => {
  logos.push(
    new Logo(
      canvasBox.width / 4,
      canvasBox.height / 3,
      SPEED,
      SPEED * 0.7,
      loadedImages[baseLogoName]
    )
  );
  requestAnimationFrame(animate);
});

let latestSpawnTime = 0;

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
            logo.velocity.x = -Math.abs(logo.velocity.x);
          } else {
            logo.box.x = textBox.right() + 1;
            logo.velocity.x = Math.abs(logo.velocity.x);
          }
        } else {
          if (overlapTextTop < overlapTextBottom) {
            logo.box.y = textBox.top() - logo.box.height - 1;
            logo.velocity.y = -Math.abs(logo.velocity.y);
          } else {
            logo.box.y = textBox.bottom() + 1;
            logo.velocity.y = Math.abs(logo.velocity.y);
          }
        }
      }
    }

    // ——— DRAW WITH POSSIBLE HUE FILTER ———
    logo.draw();

    // ——— LOGO–LOGO COLLISIONS & INVINCIBLE KILLS ———
    for (const other of logos) {
      if (other === logo) {
        continue;
      }

      if (
        timestamp - logo.spawnTime < 500 ||
        timestamp - other.spawnTime < 500
      ) {
        continue;
      }

      const distanceX = other.box.x - logo.box.x;
      const distanceY = other.box.y - logo.box.y;
      const distance = Math.hypot(distanceX, distanceY);

      // invincible destroys
      if (
        logo.isInvincible &&
        !other.isInvincible &&
        distance < LOGO_SIZE &&
        distance > 0
      ) {
        logos.splice(logos.indexOf(other), 1);
        continue;
      }

      // normal bounce
      if (distance < LOGO_SIZE && distance > 0) {
        const overlap = LOGO_SIZE - distance;
        const nx = distanceX / distance;
        const ny = distanceY / distance;
        logo.box.x -= (nx * overlap) / 2;
        logo.box.y -= (ny * overlap) / 2;
        other.box.x += (nx * overlap) / 2;
        other.box.y += (ny * overlap) / 2;
        const dot = logo.velocity.x * nx + logo.velocity.y * ny;
        logo.velocity.x -= 2 * dot * nx;
        logo.velocity.y -= 2 * dot * ny;
      }
    }

    // invincibility logic
    if (wallBounce !== null && !logo.isInvincible && Math.random() < 0.1) {
      logo.isInvincible = true;
      logo.invincibleStart = timestamp;
      setTimeout(() => (logo.isInvincible = false), INVINCIBLE_DURATION);
    }

    // ——— SPAWN NEW ON WALL BOUNCE ———
    if (
      wallBounce !== null &&
      logos.length + newLogos.length < MAX_LOGOS &&
      timestamp - latestSpawnTime >= SPAWN_COOLDOWN_MS
    ) {
      latestSpawnTime = timestamp;

      // compute spawn angle & pos
      let angle = Math.random() * (Math.PI - 0.4) + 0.2;
      if (wallBounce === "x") {
        if (logo.box.centerX() > canvasBox.centerX()) {
          angle += Math.PI;
        }
      } else {
        if (logo.box.centerY() < canvasBox.centerY()) {
          angle += Math.PI / 2;
        } else {
          angle -= Math.PI / 2;
        }
      }
      const dx = Math.cos(angle) * SPEED;
      const dy = Math.sin(angle) * SPEED;

      let x = logo.box.x + dx * SPAWN_OFFSET - LOGO_SIZE / 2;
      let y = logo.box.y + dy * SPAWN_OFFSET - LOGO_SIZE / 2;
      x = Math.max(0, Math.min(canvasBox.width - LOGO_SIZE, x));
      y = Math.max(0, Math.min(canvasBox.height - LOGO_SIZE, y));

      newLogos.push(new Logo(x, y, dx, dy, getRandomImages()));
    }
  }

  logos.push(...newLogos);
  requestAnimationFrame(animate);
}
