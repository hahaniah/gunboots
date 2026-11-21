const W = 160, H = 240;
const DT = 1 / 60;
const C = { bg: '#101018', fg: '#f4f1e8', red: '#ff3d5a', gold: '#ffd23f' };

const canvas = document.getElementById('game');
const ctx = canvas.getContext('2d');
canvas.width = W;
canvas.height = H;
document.fonts.load('8px "Press Start 2P"');


const keys = {};       
let pressed = {};      
const keyMap = {
  ArrowLeft: 'left', KeyA: 'left',
  ArrowRight: 'right', KeyD: 'right',
  Space: 'jump', KeyZ: 'jump', ArrowUp: 'jump', KeyW: 'jump', Enter: 'jump',
};
addEventListener('keydown', e => {
  const a = keyMap[e.code];
  if (!a) return;
  e.preventDefault();
  if (!keys[a]) pressed[a] = true;
  keys[a] = true;
});
addEventListener('keyup', e => {
  const a = keyMap[e.code];
  if (a) keys[a] = false;
});


let last = performance.now(), acc = 0;
function frame(now) {
  acc += Math.min(0.1, (now - last) / 1000);
  last = now;
  while (acc >= DT) { update(DT); acc -= DT; }
  draw();
  requestAnimationFrame(frame);
}


const WALL = 8;
const rand = (a, b) => a + Math.random() * (b - a);
const randInt = (a, b) => Math.floor(rand(a, b + 1));

let state = 'title';   
let player, blocks, bullets, enemies, gems, particles;
let camY, nextGenY, shake, hitstop, gemCount, deadTimer = 0;

function reset() {
  player = {
    x: W / 2 - 3, y: 10, w: 6, h: 8, vx: 0, vy: 0, onGround: false,
    ammo: 8, maxAmmo: 8, hp: 4, maxHp: 4, invuln: 0, shootCd: 0.3, combo: 0,
  };
  blocks = [{ x: WALL + 30, y: 50, w: 90, h: 8 }];   
  bullets = []; enemies = []; gems = []; particles = [];
  camY = 0; nextGenY = 100; shake = 0; hitstop = 0; gemCount = 0;
}


function generateChunk(y) {
  const n = randInt(1, 3);
  for (let i = 0; i < n; i++) {
    const w = randInt(3, 7) * 8;
    const x = WALL + randInt(0, Math.floor((W - 2 * WALL - w) / 8)) * 8;
    blocks.push({ x, y: y + randInt(0, 4) * 8, w, h: 8 });
  }
}

function updateWorld() {
  while (nextGenY < camY + H + 64) {
    generateChunk(nextGenY);
    nextGenY += 48;
  }
  blocks = blocks.filter(b => b.y + b.h > camY - 40);   
}

function drawWalls(cy) {
  ctx.fillStyle = '#23233a';
  ctx.fillRect(0, cy - 10, WALL, H + 20);
  ctx.fillRect(W - WALL, cy - 10, WALL, H + 20);
  ctx.fillStyle = C.fg;                                   
  ctx.fillRect(WALL - 1, cy - 10, 1, H + 20);
  ctx.fillRect(W - WALL, cy - 10, 1, H + 20);
  ctx.fillStyle = '#34344f';                              
  const start = Math.floor(cy / 16) * 16;
  for (let y = start; y < cy + H + 16; y += 16) {
    ctx.fillRect(0, y, WALL - 1, 1);
    ctx.fillRect(W - WALL + 1, y, WALL - 1, 1);
    ctx.fillRect(3, y, 1, 16);
    ctx.fillRect(W - 4, y + 8, 1, 8);
  }
}

function drawBlocks() {
  for (const b of blocks) {
    ctx.fillStyle = C.fg;
    ctx.fillRect(b.x, b.y, b.w, b.h);
    ctx.fillStyle = '#b9b4a2';
    ctx.fillRect(b.x, b.y + b.h - 2, b.w, 2);
  }
}


const GRAVITY = 620, MAX_FALL = 230, MOVE = 75, JUMP = 185;

function overlap(a, b) {
  return a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
}

function updatePlayer(dt) {
  const p = player;
  p.invuln = Math.max(0, p.invuln - dt);
  p.vx = ((keys.right ? 1 : 0) - (keys.left ? 1 : 0)) * MOVE;

  if (pressed.jump && p.onGround) {
    p.vy = -JUMP;
    p.onGround = false;
    p.shootCd = 0.15;          
  }
  p.vy = Math.min(p.vy + GRAVITY * dt, MAX_FALL);  

 
  p.x += p.vx * dt;
  p.x = Math.max(WALL, Math.min(W - WALL - p.w, p.x));
  for (const b of blocks) {
    if (overlap(p, b)) {
      if (p.vx > 0) p.x = b.x - p.w;
      else if (p.vx < 0) p.x = b.x + b.w;
    }
  }

  
  p.y += p.vy * dt;
  p.onGround = false;
  for (const b of blocks) {
    if (overlap(p, b)) {
      if (p.vy > 0) { p.y = b.y - p.h; p.onGround = true; }
      else if (p.vy < 0) { p.y = b.y + b.h; }
      p.vy = 0;
    }
  }
}

function updateCamera() {
  const target = player.y - 90;
  if (target > camY) camY += (target - camY) * 0.15;     
  if (player.y < camY) { player.y = camY; player.vy = Math.max(player.vy, 0); }
}

function drawPlayer() {
  const p = player;
  if (p.invuln > 0 && Math.floor(p.invuln * 20) % 2 === 0) return;  
  const x = Math.floor(p.x), y = Math.floor(p.y);
  ctx.fillStyle = C.fg;  ctx.fillRect(x, y, p.w, 6);                 
  ctx.fillStyle = C.bg;  ctx.fillRect(x + 1, y + 2, 1, 2); ctx.fillRect(x + 4, y + 2, 1, 2); 
  ctx.fillStyle = C.red; ctx.fillRect(x, y + 6, p.w, 2);          
}
// ---------- particles ----------
function burst(x, y, n, color, speed) {
  for (let i = 0; i < n; i++) {
    const a = Math.random() * Math.PI * 2, s = rand(speed * 0.3, speed);
    particles.push({
      x, y,
      vx: Math.cos(a) * s, vy: Math.sin(a) * s,
      life: rand(0.2, 0.5), color, size: randInt(1, 2),
    });
  }
}

function updateParticles(dt) {
  for (const q of particles) {
    q.x += q.vx * dt;
    q.y += q.vy * dt;
    q.vy += 200 * dt;        // gravity
    q.life -= dt;
  }
  particles = particles.filter(q => q.life > 0);   // remove dead ones
}

function drawParticles() {
  for (const q of particles) {
    ctx.fillStyle = q.color;
    ctx.fillRect(Math.floor(q.x), Math.floor(q.y), q.size, q.size);
  }
}
function updateShooting(dt) {
  const p = player;
  p.shootCd -= dt;
  if (p.onGround) { p.ammo = p.maxAmmo; p.combo = 0; return; }   // landing reloads

  if (keys.jump && p.shootCd <= 0 && p.ammo > 0) {
    p.ammo--;
    p.shootCd = 0.11;                                   // about 9 shots per second
    bullets.push({ x: p.x + p.w / 2 - 1, y: p.y + p.h, w: 2, h: 6, vy: 320, life: 0.45 });
    if (p.vy > -60) p.vy = Math.max(p.vy - 45, -60);    // recoil slows your fall
    shake = Math.max(shake, 1);
    }
  }
function updateBullets(dt) {
  for (const b of bullets) {
    b.y += b.vy * dt;
    b.life -= dt;
    for (const bl of blocks) {                  // bullets smash blocks
      if (overlap(b, bl)) {
        bl.dead = true;
        b.life = 0;
        burst(bl.x + bl.w / 2, bl.y + bl.h / 2, 8, C.fg, 70);
        shake = Math.max(shake, 1.5);
      }
    }
  }
  blocks = blocks.filter(b => !b.dead);
  bullets = bullets.filter(b => b.life > 0);
}

function drawBullets() {
  ctx.fillStyle = C.gold;
  for (const b of bullets) ctx.fillRect(Math.floor(b.x), Math.floor(b.y), b.w, b.h);
  
}
reset();

function update(dt) {
  updatePlay(dt);
  pressed = {};
}

function draw() {
  const cy = Math.floor(camY);
  ctx.fillStyle = C.bg;
  ctx.fillRect(0, 0, W, H);
  ctx.save();
  ctx.translate(Math.round(rand(-shake, shake)), Math.round(-cy + rand(-shake, shake)));
  drawWalls(cy);
  drawBlocks();
  drawPlayer();
  drawBullets();
  drawParticles();
  ctx.restore();
}

function updatePlay(dt) {
  updatePlayer(dt);
  updateShooting(dt);
  updateBullets(dt);
  updateParticles(dt);
  updateCamera();
  updateWorld();
}

requestAnimationFrame(frame);   