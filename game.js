// ============================================
//   LOST KEY ADVENTURE — GAME.JS
//   Core game engine
// ============================================

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// ---- State ----
let currentLevel = 0; // 0-indexed
let totalScore = 0;
let gameRunning = false;
let animFrameId = null;

// Level runtime state
let player, keyObj, doorObj, items, monsters;
let itemsCollected, keyFound;
let invincibleTimer, playerHP;
let elapsedTime, lastTimestamp;
let levelData;

// Loaded images
const images = {};
let imagesReady = false;

function loadImages(callback) {
  const srcs = {
    player: typeof IMG_PLAYER !== "undefined" ? IMG_PLAYER : null,
    key: typeof IMG_KEY !== "undefined" ? IMG_KEY : null,
    door: typeof IMG_DOOR !== "undefined" ? IMG_DOOR : null,
    item: typeof IMG_ITEM !== "undefined" ? IMG_ITEM : null,
    monster: typeof IMG_MONSTER !== "undefined" ? IMG_MONSTER : null,
  };
  let loaded = 0;
  const total = Object.keys(srcs).length;
  for (const [name, src] of Object.entries(srcs)) {
    const img = new Image();
    if (src) {
      img.onload = () => {
        loaded++;
        if (loaded === total) {
          imagesReady = true;
          callback();
        }
      };
      img.onerror = () => {
        loaded++;
        if (loaded === total) {
          imagesReady = true;
          callback();
        }
      };
      img.src = src;
    } else {
      loaded++;
      if (loaded === total) {
        imagesReady = true;
        callback();
      }
    }
    images[name] = img;
  }
}

// ---- Input ----
const keys = {};
document.addEventListener("keydown", (e) => {
  keys[e.key.toLowerCase()] = true;
  if (["w", "a", "s", "d"].includes(e.key.toLowerCase())) e.preventDefault();
});
document.addEventListener("keyup", (e) => {
  keys[e.key.toLowerCase()] = false;
});

// ---- Helpers ----
function isWall(x, y, map) {
  const gx = Math.floor(x / TILE_SIZE);
  const gy = Math.floor(y / TILE_SIZE);
  if (gy < 0 || gy >= map.length || gx < 0 || gx >= map[0].length) return true;
  return map[gy][gx] === 1;
}

function checkCollision(a, b) {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

function moveObj(obj, dx, dy, map) {
  const nx = obj.x + dx,
    ny = obj.y + dy;
  const m = 3; // margin
  const w = obj.width - m;
  const h = obj.height - m;
  if (!isWall(nx + m, obj.y + m, map) && !isWall(nx + w, obj.y + m, map) && !isWall(nx + m, obj.y + h, map) && !isWall(nx + w, obj.y + h, map)) {
    obj.x = nx;
  }
  if (!isWall(obj.x + m, ny + m, map) && !isWall(obj.x + w, ny + m, map) && !isWall(obj.x + m, ny + h, map) && !isWall(obj.x + w, ny + h, map)) {
    obj.y = ny;
  }
}

// ---- Initialise Level ----
function initLevel(levelIndex) {
  currentLevel = levelIndex;
  levelData = LEVELS[levelIndex];
  itemsCollected = 0;
  keyFound = false;
  invincibleTimer = 0;
  playerHP = 3;
  elapsedTime = 0;
  lastTimestamp = null;

  // Resize canvas to map
  canvas.width = levelData.mapCols * TILE_SIZE;
  canvas.height = levelData.mapRows * TILE_SIZE;

  // Clamp canvas display size
  const maxW = Math.min(window.innerWidth - 20, levelData.mapCols * TILE_SIZE);
  const maxH = Math.min(window.innerHeight - 120, levelData.mapRows * TILE_SIZE);
  const scale = Math.min(maxW / canvas.width, maxH / canvas.height, 1);
  canvas.style.width = canvas.width * scale + "px";
  canvas.style.height = canvas.height * scale + "px";

  const ts = TILE_SIZE;
  player = {
    x: levelData.playerStart.x * ts,
    y: levelData.playerStart.y * ts,
    width: ts,
    height: ts,
  };
  keyObj = {
    x: levelData.keyPos.x * ts,
    y: levelData.keyPos.y * ts,
    width: ts,
    height: ts,
    found: false,
  };
  doorObj = {
    x: levelData.doorPos.x * ts,
    y: levelData.doorPos.y * ts,
    width: ts,
    height: ts,
  };
  items = levelData.items.map((p) => ({
    x: p.x * ts,
    y: p.y * ts,
    width: ts,
    height: ts,
    collected: false,
  }));
  monsters = levelData.monsters.map((m) => ({
    x: m.x * ts,
    y: m.y * ts,
    width: ts,
    height: ts,
    dx: m.dx * levelData.monsterSpeed,
    dy: m.dy * levelData.monsterSpeed,
  }));

  // Update HUD
  document.getElementById("hud-level").textContent = levelIndex + 1;
  document.getElementById("hud-items-total").textContent = levelData.itemsRequired;
  document.getElementById("hud-items").textContent = "0";
  document.getElementById("hud-key").textContent = "❌";
  document.getElementById("hud-score").textContent = totalScore;
  document.getElementById("hud-time").textContent = "0s";
  updateHPDisplay();
}

function updateHPDisplay() {
  const hearts = ["💀", "🖤", "❤️", "❤️❤️", "❤️❤️❤️"];
  document.getElementById("hud-hp").textContent = hearts[Math.max(0, playerHP + 1)] || "❤️❤️❤️";
  // Fix: map 0→💀, 1→❤️, 2→❤️❤️, 3→❤️❤️❤️
  const map = { 0: "💀", 1: "❤️", 2: "❤️❤️", 3: "❤️❤️❤️" };
  document.getElementById("hud-hp").textContent = map[playerHP] || "💀";
}

// ---- Game Loop ----
function gameLoop(ts) {
  if (!gameRunning) return;
  if (!lastTimestamp) lastTimestamp = ts;
  const dt = ts - lastTimestamp;
  lastTimestamp = ts;
  elapsedTime += dt / 1000;
  document.getElementById("hud-time").textContent = Math.floor(elapsedTime) + "s";

  update();
  draw();
  animFrameId = requestAnimationFrame(gameLoop);
}

function startGameLoop() {
  gameRunning = true;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  lastTimestamp = null;
  animFrameId = requestAnimationFrame(gameLoop);
}

function stopGameLoop() {
  gameRunning = false;
  if (animFrameId) cancelAnimationFrame(animFrameId);
  animFrameId = null;
}

// ---- Update ----
function update() {
  const spd = levelData.playerSpeed;
  const map = levelData.map;
  const pdx = (keys["d"] ? spd : 0) - (keys["a"] ? spd : 0);
  const pdy = (keys["s"] ? spd : 0) - (keys["w"] ? spd : 0);
  moveObj(player, pdx, pdy, map);

  if (invincibleTimer > 0) invincibleTimer--;

  // Monsters
  monsters.forEach((m) => {
    const nx = m.x + m.dx;
    const ny = m.y + m.dy;
    const ma = 2,
      mw = m.width - ma,
      mh = m.height - ma;

    if (isWall(nx + ma, m.y + ma, map) || isWall(nx + mw, m.y + ma, map) || isWall(nx + ma, m.y + mh, map) || isWall(nx + mw, m.y + mh, map)) {
      m.dx *= -1;
    } else {
      m.x = nx;
    }

    if (isWall(m.x + ma, ny + ma, map) || isWall(m.x + mw, ny + ma, map) || isWall(m.x + ma, ny + mh, map) || isWall(m.x + mw, ny + mh, map)) {
      m.dy *= -1;
    } else {
      m.y = ny;
    }

    if (invincibleTimer === 0 && checkCollision(player, m)) {
      playerHP--;
      invincibleTimer = levelData.invincibleFrames;
      updateHPDisplay();
      if (playerHP <= 0) {
        stopGameLoop();
        showGameOver();
        return;
      }
    }
  });

  // Collect items
  items.forEach((item) => {
    if (!item.collected && checkCollision(player, item)) {
      item.collected = true;
      itemsCollected++;
      document.getElementById("hud-items").textContent = itemsCollected;
    }
  });

  // Collect key
  if (!keyObj.found && checkCollision(player, keyObj)) {
    keyObj.found = true;
    document.getElementById("hud-key").textContent = "✅";
  }

  // Check win
  if (keyObj.found && itemsCollected >= levelData.itemsRequired && checkCollision(player, doorObj)) {
    stopGameLoop();
    onLevelComplete();
  }
}

// ---- Draw ----
function draw() {
  const map = levelData.map;
  ctx.clearRect(0, 0, canvas.width, canvas.height);

  // Floor
  ctx.fillStyle = levelData.floorColor;
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Floor grid pattern
  ctx.fillStyle = levelData.floorPattern;
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] === 0) {
        if ((r + c) % 2 === 0) ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
      }
    }
  }

  // Walls
  for (let r = 0; r < map.length; r++) {
    for (let c = 0; c < map[r].length; c++) {
      if (map[r][c] === 1) {
        ctx.fillStyle = levelData.wallColor;
        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, TILE_SIZE);
        // Wall highlight top/left
        ctx.fillStyle = "rgba(255,255,255,0.06)";
        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, TILE_SIZE, 3);
        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE, 3, TILE_SIZE);
        // Wall shadow bottom/right
        ctx.fillStyle = "rgba(0,0,0,0.3)";
        ctx.fillRect(c * TILE_SIZE, r * TILE_SIZE + TILE_SIZE - 3, TILE_SIZE, 3);
        ctx.fillRect(c * TILE_SIZE + TILE_SIZE - 3, r * TILE_SIZE, 3, TILE_SIZE);
      }
    }
  }

  const ts = TILE_SIZE;

  // Items
  items.forEach((item) => {
    if (!item.collected) {
      if (imagesReady && images.item.complete && images.item.naturalWidth > 0) {
        ctx.drawImage(images.item, item.x, item.y, ts, ts);
      } else {
        ctx.fillStyle = "#4a80ff";
        ctx.beginPath();
        ctx.arc(item.x + ts / 2, item.y + ts / 2, ts / 3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  });

  // Key
  if (!keyObj.found) {
    if (imagesReady && images.key.complete && images.key.naturalWidth > 0) {
      ctx.drawImage(images.key, keyObj.x, keyObj.y, ts, ts);
    } else {
      ctx.fillStyle = "#f0d020";
      ctx.fillRect(keyObj.x + ts * 0.2, keyObj.y + ts * 0.2, ts * 0.6, ts * 0.6);
    }
  }

  // Door — glow green if unlockable
  const canOpen = keyObj.found && itemsCollected >= levelData.itemsRequired;
  if (canOpen) {
    ctx.save();
    ctx.shadowColor = "#4af0c8";
    ctx.shadowBlur = 16;
    ctx.drawImage(images.door, doorObj.x, doorObj.y, ts, ts);
    ctx.restore();
    ctx.fillStyle = "rgba(74,240,200,0.25)";
    ctx.fillRect(doorObj.x, doorObj.y, ts, ts);
  } else {
    if (imagesReady && images.door.complete && images.door.naturalWidth > 0) {
      ctx.drawImage(images.door, doorObj.x, doorObj.y, ts, ts);
    } else {
      ctx.fillStyle = "#6a3a1a";
      ctx.fillRect(doorObj.x, doorObj.y, ts, ts);
    }
  }

  // Monsters
  monsters.forEach((m) => {
    if (imagesReady && images.monster.complete && images.monster.naturalWidth > 0) {
      ctx.drawImage(images.monster, m.x, m.y, ts, ts);
    } else {
      ctx.fillStyle = "#3a8020";
      ctx.beginPath();
      ctx.arc(m.x + ts / 2, m.y + ts / 2, ts / 2.2, 0, Math.PI * 2);
      ctx.fill();
    }
  });

  // Player (blink when invincible)
  const showPlayer = invincibleTimer === 0 || Math.floor(invincibleTimer / 7) % 2 === 0;
  if (showPlayer) {
    if (imagesReady && images.player.complete && images.player.naturalWidth > 0) {
      ctx.drawImage(images.player, player.x, player.y, ts, ts);
    } else {
      ctx.fillStyle = "#4a9af0";
      ctx.fillRect(player.x + 4, player.y + 4, ts - 8, ts - 8);
    }
  }
}

// ---- Score Calculation ----
function calcLevelScore(time) {
  const base = 1000;
  const timeBonus = Math.max(0, levelData.timeBonus - time);
  return base + Math.floor(timeBonus * 10);
}

function calcStars(time) {
  if (time <= levelData.timeBonus * 0.5) return "⭐⭐⭐";
  if (time <= levelData.timeBonus * 0.8) return "⭐⭐";
  return "⭐";
}

// ---- Level Complete ----
function onLevelComplete() {
  const time = Math.floor(elapsedTime);
  const lvlScore = calcLevelScore(time);
  totalScore += lvlScore;

  // Save best score
  const best = parseInt(localStorage.getItem("lka_best") || "0");
  if (totalScore > best) localStorage.setItem("lka_best", totalScore);

  if (currentLevel >= LEVELS.length - 1) {
    // All clear!
    showAllClear();
  } else {
    showWinScreen(time, lvlScore);
  }
}

// ---- Public API (called by ui.js) ----
window.GameEngine = {
  init(levelIndex) {
    initLevel(levelIndex);
  },
  start() {
    startGameLoop();
  },
  stop: stopGameLoop,
  getCurrentLevel: () => currentLevel,
  getTotalScore: () => totalScore,
  resetTotalScore: () => {
    totalScore = 0;
  },
  getLevelData: () => levelData,
  // called by ui.js buttons
  nextLevel() {
    initLevel(currentLevel + 1);
    startGameLoop();
  },
  retryLevel() {
    initLevel(currentLevel);
    startGameLoop();
  },
};
