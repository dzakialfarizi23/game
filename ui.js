// ============================================
//   LOST KEY ADVENTURE — UI.JS
//   Screen management & UI logic
// ============================================

let selectedStartLevel = 0; // 0-indexed

// ---- Screen helpers ----
function showScreen(id) {
  document.querySelectorAll(".screen").forEach((s) => s.classList.remove("active"));
  const el = document.getElementById(id);
  if (el) el.classList.add("active");
}

// ---- Level announce overlay ----
function showLevelAnnounce(text, duration, callback) {
  const overlay = document.getElementById("level-announce");
  const span = document.getElementById("announce-text");
  span.textContent = text;
  overlay.classList.remove("hidden");
  setTimeout(() => {
    overlay.classList.add("hidden");
    if (callback) callback();
  }, duration);
}

// ---- WIN screen ----
window.showWinScreen = function (time, lvlScore) {
  const lv = GameEngine.getCurrentLevel();
  const next = lv + 1;
  const best = parseInt(localStorage.getItem("lka_best") || "0");
  const total = GameEngine.getTotalScore();

  document.getElementById("win-title").textContent = `LEVEL ${lv + 1} SELESAI!`;
  document.getElementById("win-time").textContent = time + "s";
  document.getElementById("win-score").textContent = lvlScore;
  document.getElementById("win-total").textContent = total;
  document.getElementById("win-stars").textContent = calcStarsUI(time, lv);

  const btnNext = document.getElementById("btn-next-level");
  if (next < LEVELS.length) {
    btnNext.textContent = `LEVEL ${next + 1} ▶`;
    btnNext.style.display = "block";
  } else {
    btnNext.style.display = "none";
  }

  showScreen("screen-win");
};

function calcStarsUI(time, lvIdx) {
  const bonus = LEVELS[lvIdx].timeBonus;
  if (time <= bonus * 0.5) return "⭐⭐⭐";
  if (time <= bonus * 0.8) return "⭐⭐";
  return "⭐";
}

// ---- GAME OVER screen ----
window.showGameOver = function () {
  const lv = GameEngine.getCurrentLevel();
  const score = GameEngine.getTotalScore();
  const best = parseInt(localStorage.getItem("lka_best") || "0");

  document.getElementById("go-level").textContent = lv + 1;
  document.getElementById("go-score").textContent = score;
  document.getElementById("go-best").textContent = best;
  document.getElementById("go-message").textContent = "Kamu terkena monster!";

  showScreen("screen-gameover");
};

// ---- ALL CLEAR screen ----
window.showAllClear = function () {
  const score = GameEngine.getTotalScore();
  const best = parseInt(localStorage.getItem("lka_best") || "0");

  document.getElementById("ac-score").textContent = score;
  document.getElementById("ac-best").textContent = Math.max(score, best);

  showScreen("screen-allclear");
};

// ---- Start Game ----
function startGame(levelIndex) {
  // Reset total score only if starting from level 1
  if (levelIndex === 0) GameEngine.resetTotalScore();

  showScreen("screen-game");
  GameEngine.init(levelIndex);

  const ld = LEVELS[levelIndex];
  const text = `LEVEL ${levelIndex + 1}\n${ld.name}\n${ld.difficulty}`;
  showLevelAnnounce(text, 2000, () => {
    GameEngine.start();
  });
}

// ---- Button wiring ----
document.addEventListener("DOMContentLoaded", () => {
  // Best score on menu
  const best = localStorage.getItem("lka_best") || "0";
  document.getElementById("best-score-menu").textContent = best;

  // Main menu buttons
  document.getElementById("btn-play").addEventListener("click", () => {
    startGame(selectedStartLevel);
  });
  document.getElementById("btn-howto").addEventListener("click", () => {
    showScreen("screen-howto");
  });
  document.getElementById("btn-back-howto").addEventListener("click", () => {
    showScreen("screen-menu");
  });

  // Level select buttons
  document.querySelectorAll(".lvl-btn").forEach((btn) => {
    btn.addEventListener("click", () => {
      document.querySelectorAll(".lvl-btn").forEach((b) => b.classList.remove("active"));
      btn.classList.add("active");
      selectedStartLevel = parseInt(btn.dataset.level) - 1;
    });
  });

  // In-game buttons
  document.getElementById("btn-menu-ingame").addEventListener("click", () => {
    GameEngine.stop();
    document.getElementById("best-score-menu").textContent = localStorage.getItem("lka_best") || "0";
    showScreen("screen-menu");
  });
  document.getElementById("btn-restart-ingame").addEventListener("click", () => {
    GameEngine.stop();
    const lv = GameEngine.getCurrentLevel();
    showScreen("screen-game");
    GameEngine.init(lv);
    const ld = LEVELS[lv];
    const text = `LEVEL ${lv + 1}\n${ld.name}\n${ld.difficulty}`;
    showLevelAnnounce(text, 1500, () => GameEngine.start());
  });

  // Win screen buttons
  document.getElementById("btn-next-level").addEventListener("click", () => {
    const next = GameEngine.getCurrentLevel() + 1;
    showScreen("screen-game");
    GameEngine.init(next);
    const ld = LEVELS[next];
    const text = `LEVEL ${next + 1}\n${ld.name}\n${ld.difficulty}`;
    showLevelAnnounce(text, 2000, () => GameEngine.start());
  });
  document.getElementById("btn-menu-win").addEventListener("click", () => {
    document.getElementById("best-score-menu").textContent = localStorage.getItem("lka_best") || "0";
    showScreen("screen-menu");
  });

  // Game Over buttons
  document.getElementById("btn-retry").addEventListener("click", () => {
    const lv = GameEngine.getCurrentLevel();
    showScreen("screen-game");
    GameEngine.init(lv);
    const ld = LEVELS[lv];
    const text = `LEVEL ${lv + 1} — COBA LAGI\n${ld.difficulty}`;
    showLevelAnnounce(text, 1500, () => GameEngine.start());
  });
  document.getElementById("btn-menu-over").addEventListener("click", () => {
    document.getElementById("best-score-menu").textContent = localStorage.getItem("lka_best") || "0";
    showScreen("screen-menu");
  });

  // All Clear buttons
  document.getElementById("btn-play-again").addEventListener("click", () => {
    startGame(0);
  });
  document.getElementById("btn-menu-allclear").addEventListener("click", () => {
    document.getElementById("best-score-menu").textContent = localStorage.getItem("lka_best") || "0";
    showScreen("screen-menu");
  });

  // Load images then show menu
  loadImages(() => {
    showScreen("screen-menu");
  });
});
