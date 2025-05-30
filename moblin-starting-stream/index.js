const CANVAS_WIDTH = 1920; // px
const CANVAS_HEIGHT = 1080; // px
const LOGO_SIZE = 100; // px
const SPEED = 0.04; // px/ms
const SPAWN_COOLDOWN_MS = 2000; // ms between spawns
const MAX_LOGOS = 20; // max logos on screen
const WALL_BOUNCE_COOLDOWN_MS = 100; // ms between a logo's wall bounces
const INVINCIBLE_DURATION = 20000; // ms invincible lasts
const SPAWN_OFFSET = 10; // px from wall when spawning
const TEXT_BOX_WIDTH = 810; // px
const TEXT_BOX_HEIGHT = 105; // px
const MIN_FRAME_INTERVAL = 1000 / 40; // cap at FPS
const MAKE_INVINCIBLE_CHANCE = 0.1;

class Velocity {
  constructor(angle) {
    this.x = Math.cos(angle) * SPEED;
    this.y = Math.sin(angle) * SPEED;
  }

  isSameDirection(other) {
    return (
      Math.sign(this.x) === Math.sign(other.x) &&
      Math.sign(this.y) === Math.sign(other.y)
    );
  }

  directionAngle() {
    return Math.atan2(this.y, this.x);
  }

  clone() {
    return new Velocity(this.directionAngle());
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

  distanceTo(other) {
    const distanceX = other.x - this.x;
    const distanceY = other.y - this.y;
    const distance = Math.hypot(distanceX, distanceY);
    return [distanceX, distanceY, distance];
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
let logos = [];
const canvasBox = new Box(0, 0, CANVAS_WIDTH, CANVAS_HEIGHT);
const textBox = new Box(
  (CANVAS_WIDTH - TEXT_BOX_WIDTH) / 2,
  (CANVAS_HEIGHT - TEXT_BOX_HEIGHT) / 2,
  TEXT_BOX_WIDTH,
  TEXT_BOX_HEIGHT
);

function preloadImages(names, onLoaded) {
  let loaded = 0;
  for (const name of names) {
    const image = new Image();
    image.src = `logos/${name}.svg`;
    image.onload = () => {
      const invincibleImage = new Image();
      invincibleImage.src = `logos/${name}-invincible.svg`;
      invincibleImage.onload = () => {
        loadedImages[name] = { normal: image, invincible: invincibleImage };
        if (++loaded === names.length) {
          onLoaded();
        }
      };
    };
  }
}

function getRandomImages() {
  const nameIndex = Math.floor(Math.random() * allLogoNames.length);
  return loadedImages[allLogoNames[nameIndex]];
}

class Logo {
  constructor(x, y, velocity, images, name) {
    this.box = new Box(x, y, LOGO_SIZE, LOGO_SIZE);
    this.velocity = velocity;
    this.prevVelocity = velocity.clone();
    this.images = images;
    this.name = name;
    this.spawnTime = performance.now();
    this.directionFlips = [];
    this.isInvincible = false;
    this.scale = 1.0;
  }

  addKill() {
    this.scale = Math.min(this.scale * 1.2, 5.0);
  }

  reset() {
    this.box.x = Math.random() * (canvasBox.width - LOGO_SIZE);
    this.box.y = Math.random() * (canvasBox.height - LOGO_SIZE);
    const angle = Math.random() * 2 * Math.PI;
    this.velocity.x = Math.cos(angle) * SPEED;
    this.velocity.y = Math.sin(angle) * SPEED;
    this.directionFlips = [];
  }

  move(now, elapsedTime) {
    this.box.x += this.velocity.x * elapsedTime;
    this.box.y += this.velocity.y * elapsedTime;

    // track rapid flips
    if (!this.velocity.isSameDirection(this.prevVelocity)) {
      this.directionFlips.push(now);
      this.prevVelocity = this.velocity.clone();
      this.directionFlips = this.directionFlips.filter((t) => now - t < 1000);
      if (this.directionFlips.length >= 8) {
        this.reset();
        return null;
      }
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

    this.processTextBoxCollision();

    return wallBounce;
  }

  processTextBoxCollision() {
    if (this.isInvincible || !this.box.intersects(textBox)) {
      return;
    }

    const overlapTextLeft = this.box.right() - textBox.left();
    const overlapTextRight = textBox.right() - this.box.left();
    const overlapTextTop = this.box.bottom() - textBox.top();
    const overlapTextBottom = textBox.bottom() - this.box.top();

    const minOverlapX = Math.min(overlapTextLeft, overlapTextRight);
    const minOverlapY = Math.min(overlapTextTop, overlapTextBottom);

    if (minOverlapX < minOverlapY) {
      if (overlapTextLeft < overlapTextRight) {
        this.box.x = textBox.left() - this.box.width - 1;
        this.velocity.x = -Math.abs(this.velocity.x);
      } else {
        this.box.x = textBox.right() + 1;
        this.velocity.x = Math.abs(this.velocity.x);
      }
    } else {
      if (overlapTextTop < overlapTextBottom) {
        this.box.y = textBox.top() - this.box.height - 1;
        this.velocity.y = -Math.abs(this.velocity.y);
      } else {
        this.box.y = textBox.bottom() + 1;
        this.velocity.y = Math.abs(this.velocity.y);
      }
    }
  }

  draw() {
    ctx.save();
    let image;
    let scale = this.scale;
    if (this.isInvincible) {
      image = this.images.invincible;
      scale *= 1.2;
    } else {
      image = this.images.normal;
    }
    const width = image.width * scale;
    const height = image.height * scale;
    ctx.translate(this.box.centerX(), this.box.centerY());
    ctx.rotate(this.velocity.directionAngle());
    ctx.drawImage(image, -width / 2, -height / 2, width, height);
    if (this.name !== undefined) {
      const fontSize = Math.round(32 * scale);
      ctx.font = `${fontSize}px serif`;
      ctx.fillStyle = "white";
      ctx.textAlign = "center";
      ctx.fillText(this.name, 0, height / 2);
    }
    ctx.restore();
  }

  distanceTo(other) {
    return other.box.distanceTo(this.box);
  }

  isRecentlyCreated(now) {
    return now - this.spawnTime < 1500;
  }

  makeInvincible() {
    if (this.isInvincible) {
      return;
    }
    this.isInvincible = true;
    setTimeout(() => {
      this.isInvincible = false;
    }, INVINCIBLE_DURATION);
  }
}

preloadImages(allLogoNames, () => {
  logos.push(
    new Logo(
      canvasBox.width / 4,
      canvasBox.height / 3,
      new Velocity(0.5),
      loadedImages[baseLogoName],
      undefined
    )
  );
  requestAnimationFrame(animate);
});

let latestSpawnTime = 0;
let latestAnimateTimestamp = 0;

function processLogoKills(now, logo, killedLogos) {
  for (const other of logos) {
    if (other === logo) {
      continue;
    }

    if (logo.isRecentlyCreated(now) || other.isRecentlyCreated(now)) {
      continue;
    }

    const distance = other.distanceTo(logo)[2];

    if (logo.isInvincible && !other.isInvincible && distance < LOGO_SIZE) {
      killedLogos.push(other);
      logo.addKill();
    }
  }
}

function processLogoLogoBounces(now, logo) {
  let pairsThatBounced = new Set();
  for (const logo of logos) {
    for (const other of logos) {
      if (other === logo) {
        continue;
      }

      if (logo.isRecentlyCreated(now) || other.isRecentlyCreated(now)) {
        continue;
      }

      if (
        pairsThatBounced.has([other, logo]) ||
        pairsThatBounced.has([logo, other])
      ) {
        continue;
      }

      const [distanceX, distanceY, distance] = other.distanceTo(logo);

      if (distance < LOGO_SIZE && distance > 0) {
        const overlap = LOGO_SIZE - distance;
        const nx = distanceX / distance;
        const ny = distanceY / distance;
        logo.box.x -= (nx * overlap) / 2;
        logo.box.y -= (ny * overlap) / 2;
        other.box.x += (nx * overlap) / 2;
        other.box.y += (ny * overlap) / 2;
        let dot = logo.velocity.x * nx + logo.velocity.y * ny;
        logo.velocity.x -= 2 * dot * nx;
        logo.velocity.y -= 2 * dot * ny;
        dot = other.velocity.x * nx + other.velocity.y * ny;
        other.velocity.x -= 2 * dot * nx;
        other.velocity.y -= 2 * dot * ny;
        pairsThatBounced.add([logo, other]);
      }
    }
  }
}

function processMakeLogoInvincible(logo, wallBounce) {
  if (wallBounce !== null && Math.random() < MAKE_INVINCIBLE_CHANCE) {
    logo.makeInvincible();
  }
}

function processSpawnAtWallBounce(logo, wallBounce, now, newLogos) {
  if (
    wallBounce !== null &&
    logos.length + newLogos.length < MAX_LOGOS &&
    now - latestSpawnTime >= SPAWN_COOLDOWN_MS
  ) {
    latestSpawnTime = now;

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
    const velocity = new Velocity(angle);

    let x = logo.box.x + velocity.x * SPAWN_OFFSET - LOGO_SIZE / 2;
    let y = logo.box.y + velocity.y * SPAWN_OFFSET - LOGO_SIZE / 2;
    x = Math.max(0, Math.min(canvasBox.width - LOGO_SIZE, x));
    y = Math.max(0, Math.min(canvasBox.height - LOGO_SIZE, y));

    newLogos.push(new Logo(x, y, velocity, getRandomImages(), getLogoName()));
  }
}

function updateLogosList(newLogos, killedLogos) {
  logos = logos.filter((logo) => killedLogos.indexOf(logo) === -1);
  logos.push(...newLogos);
  logos.sort((first, second) => second.scale - first.scale);
}

function draw() {
  ctx.clearRect(0, 0, canvasBox.width, canvasBox.height);
  for (const logo of logos) {
    logo.draw();
  }
}

function animate(now) {
  const elapsedTime = now - latestAnimateTimestamp;
  if (elapsedTime >= MIN_FRAME_INTERVAL) {
    latestAnimateTimestamp = now;
    const newLogos = [];
    const killedLogos = [];
    for (const logo of logos) {
      const wallBounce = logo.move(now, elapsedTime);
      processMakeLogoInvincible(logo, wallBounce);
      processSpawnAtWallBounce(logo, wallBounce, now, newLogos);
    }
    for (const logo of logos) {
      processLogoKills(now, logo, killedLogos);
    }
    updateLogosList(newLogos, killedLogos);
    processLogoLogoBounces(now);
    draw();
  }

  requestAnimationFrame(animate);
}

let stop = false;
const logoNameWaitList = [];

function getLogoName() {
  while (true) {
    const name = logoNameWaitList.shift();
    if (name === undefined) {
      return undefined;
    }
    if (logos.find((logo) => logo.name === name) === undefined) {
      return name;
    }
  }
}

function nameLogo(user) {
  if (logos.find((logo) => logo.name === user) !== undefined) {
    return;
  }
  const logo = logos.find((logo) => logo.name === undefined);
  if (logo === undefined) {
    logoNameWaitList.push(user);
  } else {
    logo.name = user;
  }
}

function teleportLogo(user) {
  const logo = logos.find((logo) => logo.name === user);
  if (logo !== undefined) {
    logo.reset();
  }
}

function handleChatMessage(message) {
  const command = message.segments[0]?.text?.trim();
  if (command === "!join") {
    nameLogo(message.user);
  } else if (command === "!teleport") {
    teleportLogo(message.user);
  }
}

try {
  moblin.subscribe({ chat: { prefix: "!" } });
  moblin.onmessage = (message) => {
    if (message.chat !== undefined) {
      handleChatMessage(message.chat.message);
    }
  };
} catch {}
