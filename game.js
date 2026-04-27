/**
 * SPACE INVADERS: ZAYD EDITION 🚀
 * Full game engine — canvas-based, mobile-friendly
 */

// ─── STATE & CONFIG ──────────────────────────────────────────────────────────

const CONFIG = {
  maxLevels:     5,
  rows:          4,
  cols:          10,
  playerSpeed:   5,
  bulletSpeed:   9,
  enemyBulletSpd:4,
  baseFireRate:  0.008,   // probability per enemy per frame
  marchInterval: 60,      // frames between march steps (decreases per level)
  ufoChance:     0.0008,  // probability per frame
};

const COLORS = {
  player:    '#00ff88',
  bullet:    '#ffe600',
  eBullet:   '#ff2d78',
  shield:    '#00cfff',
  ufo:       '#ff2d78',
  score10:   '#00cfff',
  score20:   '#00ff88',
  score30:   '#ffe600',
  score50:   '#ff2d78',
  explosion: '#ff8c00',
  trail:     'rgba(255,230,0,0.4)',
};

const ALIEN_EMOJIS = [
  ['👾', '👾'],   // row 0 (bottom – 10pts)
  ['🛸', '🛸'],   // row 1 (20pts)
  ['🤖', '🤖'],   // row 2 (30pts)
  ['👻', '👻'],   // row 3 (top – 50pts)
];
const ALIEN_PTS = [10, 20, 30, 50];

// ─── DOM ELEMENTS ────────────────────────────────────────────────────────────

const starCanvas  = document.getElementById('starCanvas');
const starCtx     = starCanvas.getContext('2d');
const gameCanvas  = document.getElementById('gameCanvas');
const ctx         = gameCanvas.getContext('2d');

const titleScreen   = document.getElementById('titleScreen');
const gameScreen    = document.getElementById('gameScreen');
const levelUpScreen = document.getElementById('levelUpScreen');
const gameOverScreen= document.getElementById('gameOverScreen');
const winScreen     = document.getElementById('winScreen');

const scoreEl    = document.getElementById('score');
const levelEl    = document.getElementById('level');
const livesEl    = document.getElementById('lives');
const finalScore = document.getElementById('finalScore');
const winScore   = document.getElementById('winScore');
const levelUpTxt = document.getElementById('levelUpText');
const newHiMsg   = document.getElementById('newHighScoreMsg');
const titleHi    = document.getElementById('titleHighScore');

// ─── STAR BACKGROUND ─────────────────────────────────────────────────────────

let stars = [];
function initStars() {
  starCanvas.width  = window.innerWidth;
  starCanvas.height = window.innerHeight;
  stars = [];
  for (let i = 0; i < 180; i++) {
    stars.push({
      x:    Math.random() * starCanvas.width,
      y:    Math.random() * starCanvas.height,
      r:    Math.random() * 1.8 + 0.3,
      spd:  Math.random() * 0.3 + 0.05,
      alpha:Math.random() * 0.7 + 0.3,
      flicker: Math.random() * 100,
    });
  }
}

function drawStars(ts) {
  starCtx.clearRect(0, 0, starCanvas.width, starCanvas.height);
  for (const s of stars) {
    s.y += s.spd;
    if (s.y > starCanvas.height) { s.y = 0; s.x = Math.random() * starCanvas.width; }
    const flicker = 0.7 + 0.3 * Math.sin((ts + s.flicker) * 0.004);
    starCtx.beginPath();
    starCtx.arc(s.x, s.y, s.r, 0, Math.PI * 2);
    starCtx.fillStyle = `rgba(255,255,255,${s.alpha * flicker})`;
    starCtx.fill();
  }
}

// ─── GAME STATE ───────────────────────────────────────────────────────────────

let state = {};
let keys  = {};
let touchLeft = false, touchRight = false, touchFire = false;
let animId = null;
let marchTimer = 0;
let marchPhase = 0;
let marchDir = 1;
let ufo = null;
let particles = [];
let bulletTrails = [];
let frameCount = 0;

function freshState(level = 1) {
  return {
    phase:      'playing',
    level,
    score:      state.score || 0,
    lives:      3,
    player: {
      x: gameCanvas.width / 2,
      y: gameCanvas.height - 60,
      w: 48, h: 36,
      shoot: false,
      shootCool: 0,
      invincible: 0,
    },
    bullets:       [],   // player bullets
    eBullets:      [],   // enemy bullets
    aliens:        buildAliens(level),
    alienVelX:     1.2 + level * 0.3,
    shields:       buildShields(),
    explosions:    [],
  };
}

function buildAliens(level) {
  const aliens = [];
  const gw = gameCanvas.width;
  const colW  = Math.min(60, (gw - 40) / CONFIG.cols);
  const startX = (gw - colW * CONFIG.cols) / 2 + colW / 2;
  const startY = 80;

  for (let r = 0; r < CONFIG.rows; r++) {
    for (let c = 0; c < CONFIG.cols; c++) {
      aliens.push({
        row: r, col: c,
        x: startX + c * colW,
        y: startY + r * 52,
        w: 40, h: 36,
        alive: true,
        frame: 0,
        emoji: ALIEN_EMOJIS[CONFIG.rows - 1 - r][0],
        pts: ALIEN_PTS[CONFIG.rows - 1 - r],
        hitFlash: 0,
      });
    }
  }
  return aliens;
}

function buildShields() {
  const shields = [];
  const count = 4;
  const gw = gameCanvas.width;
  const gap = gw / (count + 1);
  const brickW = 14, brickH = 10;
  const cols = 5, rows = 3;

  for (let s = 0; s < count; s++) {
    const baseX = gap * (s + 1) - (cols * brickW) / 2;
    const baseY = gameCanvas.height - 130;
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        shields.push({
          x: baseX + c * brickW,
          y: baseY + r * brickH,
          w: brickW - 2, h: brickH - 2,
          hp: 3,
        });
      }
    }
  }
  return shields;
}

// ─── CANVAS RESIZE ────────────────────────────────────────────────────────────

function resizeCanvas() {
  const rect = gameCanvas.parentElement.getBoundingClientRect();
  // Find available height (subtract HUD + touch controls)
  const hudH   = document.getElementById('hud').offsetHeight || 50;
  const touchH = document.getElementById('touchControls').offsetHeight || 0;
  const avH    = rect.height - hudH - touchH;

  gameCanvas.width  = rect.width;
  gameCanvas.height = Math.max(avH, 200);
}

// ─── INPUT ────────────────────────────────────────────────────────────────────

document.addEventListener('keydown', e => {
  keys[e.code] = true;
  if (['Space','ArrowLeft','ArrowRight','ArrowUp','ArrowDown'].includes(e.code))
    e.preventDefault();
  SFX.resume();
});
document.addEventListener('keyup',   e => { keys[e.code] = false; });

function bindTouch(btn, setLeft, setRight, setFire) {
  function on(l,r,f) { touchLeft=l; touchRight=r; touchFire=f; SFX.resume(); }
  document.getElementById('leftBtn').addEventListener('touchstart',  e=>{e.preventDefault();touchLeft=true;SFX.resume();},{passive:false});
  document.getElementById('leftBtn').addEventListener('touchend',    e=>{e.preventDefault();touchLeft=false;},{passive:false});
  document.getElementById('rightBtn').addEventListener('touchstart', e=>{e.preventDefault();touchRight=true;SFX.resume();},{passive:false});
  document.getElementById('rightBtn').addEventListener('touchend',   e=>{e.preventDefault();touchRight=false;},{passive:false});
  document.getElementById('fireBtn').addEventListener('touchstart',  e=>{e.preventDefault();touchFire=true;SFX.resume();},{passive:false});
  document.getElementById('fireBtn').addEventListener('touchend',    e=>{e.preventDefault();touchFire=false;},{passive:false});
}
bindTouch();

// ─── SCREEN MANAGER ───────────────────────────────────────────────────────────

function showScreen(id) {
  [titleScreen, gameScreen, levelUpScreen, gameOverScreen, winScreen].forEach(s => s.classList.remove('active'));
  document.getElementById(id).classList.add('active');
}

// ─── START BUTTON ─────────────────────────────────────────────────────────────

document.getElementById('startBtn').addEventListener('click', () => {
  SFX.resume();
  startGame(1, 0);
});
document.getElementById('playAgainBtn').addEventListener('click', () => startGame(1, 0));
document.getElementById('menuBtn').addEventListener('click', () => { showScreen('titleScreen'); });
document.getElementById('winPlayAgainBtn').addEventListener('click', () => startGame(1, 0));

function startGame(level, score) {
  showScreen('gameScreen');
  resizeCanvas();
  state = freshState(level);
  if (score) state.score = score;
  marchTimer = 0;
  marchPhase = 0;
  marchDir = 1;
  ufo = null;
  particles = [];
  bulletTrails = [];
  frameCount = 0;
  updateHUD();
  if (animId) cancelAnimationFrame(animId);
  animId = requestAnimationFrame(loop);
}

// ─── HUD UPDATE ───────────────────────────────────────────────────────────────

function updateHUD() {
  scoreEl.textContent = state.score;
  levelEl.textContent = state.level;
  livesEl.textContent = '❤️'.repeat(Math.max(0, state.lives));
}

// ─── HIGH SCORE ───────────────────────────────────────────────────────────────

function getHi() { return parseInt(localStorage.getItem('zayd_hi') || '0'); }
function setHi(s) { if (s > getHi()) localStorage.setItem('zayd_hi', s); }

// ─── MAIN LOOP ────────────────────────────────────────────────────────────────

let lastTs = 0;
function loop(ts) {
  const dt = Math.min((ts - lastTs) / 16.67, 3);
  lastTs = ts;
  frameCount++;

  drawStars(ts);
  ctx.clearRect(0, 0, gameCanvas.width, gameCanvas.height);

  if (state.phase === 'playing') {
    update(dt, ts);
  }
  render(ts);

  animId = requestAnimationFrame(loop);
}

// ─── UPDATE ───────────────────────────────────────────────────────────────────

function update(dt, ts) {
  movePlayer(dt);
  movePlayerBullets(dt);
  moveEnemyBullets(dt);
  marchAliens(dt);
  spawnUFO(ts);
  moveUFO(dt);
  checkCollisions();
  updateParticles(dt);
  enemyFire();
  updateCooldowns(dt);
}

function movePlayer(dt) {
  const p = state.player;
  const spd = CONFIG.playerSpeed * dt;
  if ((keys['ArrowLeft'] || keys['KeyA'] || touchLeft) && p.x - p.w/2 > 8)
    p.x -= spd;
  if ((keys['ArrowRight'] || keys['KeyD'] || touchRight) && p.x + p.w/2 < gameCanvas.width - 8)
    p.x += spd;

  // Shoot
  if (p.shootCool <= 0 && (keys['Space'] || keys['ArrowUp'] || keys['KeyW'] || touchFire)) {
    state.bullets.push({ x: p.x, y: p.y - 16, w: 4, h: 14, vy: -CONFIG.bulletSpeed });
    p.shootCool = 18;
    SFX.shoot();
  }
  if (p.shootCool > 0) p.shootCool -= dt;
  if (p.invincible > 0) p.invincible -= dt;
}

function movePlayerBullets(dt) {
  for (const b of state.bullets) b.y += b.vy * dt;
  state.bullets = state.bullets.filter(b => b.y > -20);
}

function moveEnemyBullets(dt) {
  for (const b of state.eBullets) {
    b.x += (b.vx || 0) * dt;
    b.y += CONFIG.enemyBulletSpd * dt;
    bulletTrails.push({ x: b.x, y: b.y, alpha: 0.6, col: COLORS.eBullet });
  }
  state.eBullets = state.eBullets.filter(b => b.y < gameCanvas.height + 20);
  // trail fade
  for (const t of bulletTrails) t.alpha -= 0.06;
  bulletTrails = bulletTrails.filter(t => t.alpha > 0);
}

function marchAliens(dt) {
  marchTimer += dt;
  const liveCount = state.aliens.filter(a => a.alive).length;
  const interval = Math.max(8, CONFIG.marchInterval - (state.level - 1) * 6 - (40 - liveCount) * 0.8);

  if (marchTimer < interval) return;
  marchTimer = 0;
  SFX.marchTick(marchPhase++);

  // Check if need to reverse
  const live = state.aliens.filter(a => a.alive);
  if (!live.length) return;

  const rightmost = Math.max(...live.map(a => a.x + a.w / 2));
  const leftmost  = Math.min(...live.map(a => a.x - a.w / 2));

  if (marchDir === 1 && rightmost >= gameCanvas.width - 8) {
    marchDir = -1;
    for (const a of live) a.y += 20;
  } else if (marchDir === -1 && leftmost <= 8) {
    marchDir = 1;
    for (const a of live) a.y += 20;
  } else {
    for (const a of live) {
      a.x += marchDir * (5 + state.level * 1.2);
      a.frame ^= 1;
    }
  }

  // Check if aliens reached the player line
  const playerY = state.player.y - state.player.h / 2;
  if (live.some(a => a.y + a.h >= playerY - 10)) {
    triggerGameOver();
  }
}

function enemyFire() {
  const live = state.aliens.filter(a => a.alive);
  if (!live.length) return;
  const rate = CONFIG.baseFireRate * (1 + state.level * 0.4);
  for (const a of live) {
    if (Math.random() < rate / live.length) {
      state.eBullets.push({ x: a.x, y: a.y + a.h / 2 + 4, w: 4, h: 12, vx: (Math.random()-0.5)*1.5 });
      SFX.enemyShoot();
      break; // one bullet per frame max
    }
  }
}

function spawnUFO(ts) {
  if (!ufo && Math.random() < CONFIG.ufoChance) {
    const dir = Math.random() < 0.5 ? 1 : -1;
    ufo = { x: dir === 1 ? -40 : gameCanvas.width + 40, y: 45, vx: dir * 2.8, w: 48, h: 24 };
    SFX.ufoPass();
  }
}

function moveUFO(dt) {
  if (!ufo) return;
  ufo.x += ufo.vx * dt;
  if (ufo.x < -80 || ufo.x > gameCanvas.width + 80) ufo = null;
}

function checkCollisions() {
  // Player bullets vs aliens
  for (const b of state.bullets) {
    for (const a of state.aliens) {
      if (!a.alive) continue;
      if (rectHit(b, { x: a.x - a.w/2, y: a.y - a.h/2, w: a.w, h: a.h })) {
        b.dead = true;
        a.alive = false;
        state.score += a.pts;
        spawnParticles(a.x, a.y, '#' + ['ff8c00','ffe600','ff2d78'][a.row % 3], 12);
        SFX.hit();
        flashScreen('flash-green');
        updateHUD();
        checkWin();
      }
    }
  }
  state.bullets = state.bullets.filter(b => !b.dead);

  // Player bullets vs UFO
  for (const b of state.bullets) {
    if (ufo && rectHit(b, { x: ufo.x - ufo.w/2, y: ufo.y - ufo.h/2, w: ufo.w, h: ufo.h })) {
      b.dead = true;
      const bonus = [50, 100, 150, 200][Math.floor(Math.random() * 4)];
      state.score += bonus;
      spawnParticles(ufo.x, ufo.y, COLORS.ufo, 20);
      spawnScorePopup(ufo.x, ufo.y, bonus);
      SFX.bigExplosion();
      ufo = null;
      updateHUD();
    }
  }
  state.bullets = state.bullets.filter(b => !b.dead);

  // Player bullets vs shields
  for (const b of state.bullets) {
    for (const s of state.shields) {
      if (s.hp <= 0) continue;
      if (rectHit(b, s)) {
        b.dead = true;
        s.hp--;
        SFX.shieldHit();
      }
    }
  }
  state.bullets = state.bullets.filter(b => !b.dead);

  // Enemy bullets vs shields
  for (const b of state.eBullets) {
    for (const s of state.shields) {
      if (s.hp <= 0) continue;
      if (rectHit(b, s)) {
        b.dead = true;
        s.hp--;
        SFX.shieldHit();
      }
    }
  }
  state.eBullets = state.eBullets.filter(b => !b.dead);

  // Enemy bullets vs player
  const p = state.player;
  if (p.invincible <= 0) {
    for (const b of state.eBullets) {
      if (rectHit(b, { x: p.x - p.w/2, y: p.y - p.h/2, w: p.w, h: p.h })) {
        b.dead = true;
        playerHurt();
      }
    }
    state.eBullets = state.eBullets.filter(b => !b.dead);
  }

  // Aliens touch player
  for (const a of state.aliens) {
    if (!a.alive) continue;
    if (rectHit({ x: a.x-a.w/2, y: a.y-a.h/2, w: a.w, h: a.h },
                { x: p.x-p.w/2, y: p.y-p.h/2, w: p.w, h: p.h })) {
      playerHurt();
    }
  }
}

function rectHit(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x &&
         a.y < b.y + b.h && a.y + a.h > b.y;
}

function playerHurt() {
  state.lives--;
  state.player.invincible = 90;
  spawnParticles(state.player.x, state.player.y, COLORS.player, 16);
  SFX.playerHit();
  flashScreen('flash-red');
  updateHUD();
  if (state.lives <= 0) triggerGameOver();
}

function checkWin() {
  if (state.aliens.every(a => !a.alive)) {
    cancelAnimationFrame(animId);
    if (state.level >= CONFIG.maxLevels) {
      triggerWin();
    } else {
      SFX.levelUp();
      showLevelUp(state.level + 1);
    }
  }
}

function triggerGameOver() {
  state.phase = 'dead';
  cancelAnimationFrame(animId);
  SFX.gameOver();
  setHi(state.score);
  setTimeout(() => {
    finalScore.textContent = state.score;
    const hi = getHi();
    newHiMsg.classList.toggle('hidden', state.score < hi || state.score === 0);
    showScreen('gameOverScreen');
  }, 1200);
}

function triggerWin() {
  SFX.win();
  setHi(state.score);
  winScore.textContent = state.score;
  setTimeout(() => showScreen('winScreen'), 800);
}

function showLevelUp(nextLevel) {
  levelUpTxt.textContent = `Get Ready for Level ${nextLevel}!`;
  showScreen('levelUpScreen');
  setTimeout(() => startGame(nextLevel, state.score), 2200);
}

// ─── PARTICLES ────────────────────────────────────────────────────────────────

let scorePopups = [];

function spawnParticles(x, y, color, count) {
  for (let i = 0; i < count; i++) {
    const angle = (Math.PI * 2 * i) / count + Math.random() * 0.5;
    const spd   = 2 + Math.random() * 4;
    particles.push({
      x, y,
      vx: Math.cos(angle) * spd,
      vy: Math.sin(angle) * spd,
      r: 3 + Math.random() * 3,
      alpha: 1,
      color,
    });
  }
}

function spawnScorePopup(x, y, pts) {
  scorePopups.push({ x, y, pts, vy: -1.5, alpha: 1 });
}

function updateParticles(dt) {
  for (const p of particles) {
    p.x += p.vx * dt;
    p.y += p.vy * dt;
    p.vy += 0.12 * dt;
    p.alpha -= 0.025 * dt;
    p.r *= 0.97;
  }
  particles = particles.filter(p => p.alpha > 0);

  for (const p of scorePopups) {
    p.y += p.vy;
    p.alpha -= 0.018;
  }
  scorePopups = scorePopups.filter(p => p.alpha > 0);
}

function updateCooldowns(dt) {
  // nothing extra needed
}

// ─── RENDER ───────────────────────────────────────────────────────────────────

function render(ts) {
  // Nebula background glow on canvas
  const grad = ctx.createRadialGradient(
    gameCanvas.width/2, gameCanvas.height/2, 50,
    gameCanvas.width/2, gameCanvas.height/2, gameCanvas.height * 0.8
  );
  grad.addColorStop(0, 'rgba(10,10,60,0.4)');
  grad.addColorStop(1, 'rgba(4,4,16,0)');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, gameCanvas.width, gameCanvas.height);

  drawShields();
  drawAliens(ts);
  drawUFO(ts);
  drawPlayer(ts);
  drawBullets(ts);
  drawParticles();
  drawScorePopups();
}

function drawPlayer(ts) {
  const p = state.player;
  if (p.invincible > 0 && Math.floor(p.invincible / 6) % 2 === 0) return; // blink when hit

  ctx.save();
  ctx.translate(p.x, p.y);

  // Engine glow
  const grd = ctx.createRadialGradient(0, p.h/2 + 4, 2, 0, p.h/2 + 4, 20);
  grd.addColorStop(0, 'rgba(0,255,136,0.8)');
  grd.addColorStop(1, 'rgba(0,255,136,0)');
  ctx.fillStyle = grd;
  ctx.fillRect(-12, p.h/2, 24, 16);

  // Draw ship using font emoji
  ctx.font = `${p.h}px serif`;
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🚀', 0, 0);

  // Neon outline
  ctx.shadowColor = COLORS.player;
  ctx.shadowBlur = 14;
  ctx.strokeStyle = COLORS.player;
  ctx.lineWidth = 1.5;
  // Draw a subtle capsule outline
  ctx.beginPath();
  ctx.roundRect(-p.w/2, -p.h/2, p.w, p.h, 8);
  ctx.stroke();
  ctx.shadowBlur = 0;

  ctx.restore();
}

function drawAliens(ts) {
  for (const a of state.aliens) {
    if (!a.alive) continue;
    ctx.save();
    ctx.translate(a.x, a.y);
    if (a.hitFlash > 0) {
      ctx.globalAlpha = 0.5 + Math.sin(ts * 0.05) * 0.5;
      a.hitFlash--;
    }
    const sz = a.h + 2;
    ctx.font = `${sz}px serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    // Slight scale bob
    const scale = 1 + 0.04 * Math.sin(ts * 0.003 + a.col * 0.5);
    ctx.scale(scale, scale);
    ctx.fillText(a.emoji, 0, 0);

    // Neon glow ring on bottom two rows
    if (a.row <= 1) {
      ctx.shadowColor = a.pts === 20 ? COLORS.score20 : COLORS.score10;
      ctx.shadowBlur = 10;
      ctx.font = `${sz}px serif`;
      ctx.fillText(a.emoji, 0, 0);
      ctx.shadowBlur = 0;
    }

    ctx.restore();
  }
}

function drawUFO(ts) {
  if (!ufo) return;
  ctx.save();
  ctx.translate(ufo.x, ufo.y);
  // Pulsing glow
  ctx.shadowColor = COLORS.ufo;
  ctx.shadowBlur  = 12 + 8 * Math.sin(ts * 0.01);
  ctx.font = '36px serif';
  ctx.textAlign = 'center';
  ctx.textBaseline = 'middle';
  ctx.fillText('🛸', 0, 0);
  ctx.shadowBlur = 0;

  // UFO label
  ctx.fillStyle = COLORS.ufo;
  ctx.font = 'bold 10px Orbitron, sans-serif';
  ctx.fillText('??? PTS', 0, -28);
  ctx.restore();
}

function drawBullets(ts) {
  // Trails
  for (const t of bulletTrails) {
    ctx.beginPath();
    ctx.arc(t.x, t.y, 2, 0, Math.PI*2);
    ctx.fillStyle = `rgba(255,45,120,${t.alpha})`;
    ctx.fill();
  }

  // Player bullets
  for (const b of state.bullets) {
    ctx.save();
    ctx.shadowColor = COLORS.bullet;
    ctx.shadowBlur  = 10;
    const grad = ctx.createLinearGradient(b.x, b.y, b.x, b.y + b.h);
    grad.addColorStop(0, '#fff');
    grad.addColorStop(1, COLORS.bullet);
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.roundRect(b.x - b.w/2, b.y, b.w, b.h, 3);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }

  // Enemy bullets
  for (const b of state.eBullets) {
    ctx.save();
    ctx.shadowColor = COLORS.eBullet;
    ctx.shadowBlur  = 10;
    ctx.fillStyle = COLORS.eBullet;
    // Zigzag shape
    ctx.beginPath();
    ctx.moveTo(b.x, b.y);
    ctx.lineTo(b.x + 4, b.y + 4);
    ctx.lineTo(b.x, b.y + 8);
    ctx.lineTo(b.x - 4, b.y + 4);
    ctx.closePath();
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawShields() {
  for (const s of state.shields) {
    if (s.hp <= 0) continue;
    const alpha = s.hp / 3;
    ctx.save();
    ctx.shadowColor = COLORS.shield;
    ctx.shadowBlur  = 6;
    ctx.fillStyle = `rgba(0,207,255,${alpha * 0.85})`;
    ctx.beginPath();
    ctx.roundRect(s.x, s.y, s.w, s.h, 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawParticles() {
  for (const p of particles) {
    ctx.save();
    ctx.globalAlpha = Math.max(0, p.alpha);
    ctx.shadowColor = p.color;
    ctx.shadowBlur  = 8;
    ctx.fillStyle   = p.color;
    ctx.beginPath();
    ctx.arc(p.x, p.y, Math.max(0.1, p.r), 0, Math.PI * 2);
    ctx.fill();
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

function drawScorePopups() {
  for (const p of scorePopups) {
    ctx.save();
    ctx.globalAlpha = p.alpha;
    ctx.fillStyle   = COLORS.bullet;
    ctx.shadowColor = COLORS.bullet;
    ctx.shadowBlur  = 8;
    ctx.font        = 'bold 13px "Press Start 2P", monospace';
    ctx.textAlign   = 'center';
    ctx.fillText(`+${p.pts}`, p.x, p.y);
    ctx.shadowBlur = 0;
    ctx.restore();
  }
}

// ─── UTILS ────────────────────────────────────────────────────────────────────

function flashScreen(cls) {
  document.body.classList.remove('flash-red', 'flash-green');
  void document.body.offsetWidth;
  document.body.classList.add(cls);
  setTimeout(() => document.body.classList.remove(cls), 180);
}

// ─── RESIZE HANDLING ──────────────────────────────────────────────────────────

window.addEventListener('resize', () => {
  initStars();
  if (gameScreen.classList.contains('active')) {
    resizeCanvas();
    state.player.x = gameCanvas.width / 2;
    state.player.y = gameCanvas.height - 60;
  }
});

// ─── INIT ─────────────────────────────────────────────────────────────────────

initStars();
requestAnimationFrame(function starLoop(ts) {
  if (!gameScreen.classList.contains('active')) {
    drawStars(ts);
  }
  requestAnimationFrame(starLoop);
});

// Load high score on title
titleHi.textContent = getHi();

// ─── CONTEXT MENU BLOCK ───────────────────────────────────────────────────────
document.addEventListener('contextmenu', e => e.preventDefault());
