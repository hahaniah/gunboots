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
    if (Math.random() < 0.7) spawnEnemy(y + randInt(0,5) * 8);  }


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
  const wasGround = p.onGround;
  p.onGround = false;
  for (const b of blocks) {
    if (overlap(p, b)) {
      if (p.vy > 0) { p.y = b.y - p.h; p.onGround = true; }
      else if (p.vy < 0) { p.y = b.y + b.h; }
      p.vy = 0;
    }
  }
     if (p.onGround && !wasGround) burst(p.x + 3, p.y + 8, 5, C.fg, 30);
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
   
   if (keys.jump && !p.onGround && p.ammo > 0 && p.shootCd > 0.04) {
    ctx.fillStyle = C.gold;
    ctx.fillRect(x+ 2, y+ 8,2,3);
}
}

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
    q.vy += 200 * dt;        
    q.life -= dt;
  }
  particles = particles.filter(q => q.life > 0);   
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
  if (p.onGround) { p.ammo = p.maxAmmo; p.combo = 0; return; }   

  if (keys.jump && p.shootCd <= 0 && p.ammo > 0) {
    p.ammo--;
    p.shootCd = 0.11;                                   
    bullets.push({ x: p.x + p.w / 2 - 1, y: p.y + p.h, w: 2, h: 6, vy: 320, life: 0.45 });
    if (p.vy > -60) p.vy = Math.max(p.vy - 45, -60);   
    shake = Math.max(shake, 1);
    }
  }
function updateBullets(dt) {
  for (const b of bullets) {
    b.y += b.vy * dt;
    b.life -= dt;
    for (const bl of blocks) {                  
      if (overlap(b, bl)) {
        bl.dead = true;
        b.life = 0;
        burst(bl.x + bl.w / 2, bl.y + bl.h / 2, 8, C.fg, 70);
        shake = Math.max(shake, 1.5);
      }
    }
     for (const e of enemies) {
      if (!e.dead && overlap (b, e)) {
        b.life = 0;
        e.hp--;
        e.flash = 0.1;
        burst (b.x, b.y + b.h, 4, C.gold, 50);
        if (e.hp <= 0) killEnemy(e);
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
function dropGems(x, y, n) {
  for (let i = 0; i < n; i++) {
    gems.push({ x, y, w: 4, h: 4, vx: rand(-40, 40), vy: rand(-90, -30) });
  }
}

function updateGems(dt) {
  const p = player;
  for (const g of gems) {
    g.vy = Math.min(g.vy+ 300 * dt, 90);     
    g.x += g.vx * dt;
    g.y += g.vy* dt;
    g.vx *= 0.98;
    g.x = Math.max(WALL, Math.min(W - WALL- g.w, g.x));

    const dx = (p.x + p.w / 2) - (g.x + 2);
    const dy = (p.y + p.h / 2) - (g.y + 2);
    if (dx * dx + dy * dy < 100) {          
      g.dead = true;
      gemCount++;
      burst(g.x + 2, g.y + 2, 3, C.gold, 30);
    }
  }
  gems = gems.filter(g => !g.dead && g.y < camY + H + 20);
}

function drawGems() {
  ctx.fillStyle = C.gold;
  for (const g of gems) {
    const x = Math.floor(g.x), y = Math.floor(g.y);
    ctx.fillRect(x + 1, y, 2, 4);             
    ctx.fillRect(x, y + 1, 4, 2);
  }
}

function drawCombo() {
  if (state === 'play' && player.combo >= 2) {
    text('x' + player.combo, W / 2, 30, C.gold, 'center');
  }
}
    
function updatePlay(dt) {
  updatePlayer(dt);
  updateShooting(dt);
  updateBullets(dt);
  updateEnemies(dt);
  updateGems(dt);
  updateParticles(dt);
  updateCamera();
  updateWorld();
}
reset();
const dots = Array.from({ length: 30 }, () => ({
  x: rand(WALL, W - WALL),
  y: rand(0, H),
  s: randInt(1, 2),
}));

function drawDots(cy) {
  ctx.fillStyle = '#2c2c44';
  for (const d of dots) {
   const y = (((d.y - cy * 0.3 * d.s) % H) + H) % H;   // moves slower than the world
    ctx.fillRect(Math.floor(d.x), Math.floor(y), 1, d.s);
  }
}


function update(dt) {
  if (state === 'title') {
    if (pressed.jump) { reset(); state = 'play'; }
  } else if (state === 'play') {
    if (hitstop > 0) hitstop -= dt;      
    else updatePlay(dt);
  } else if (state === 'dead') {
    deadTimer += dt;
    updateParticles(dt);
    if (deadTimer > 0.7 && pressed.jump) { reset(); state = 'play'; }
  }
  shake = Math.max(0, shake - 30 * dt); 
  pressed = {};
}
function draw() {

  const cy = Math.floor(camY);
  ctx.fillStyle = C.bg;
   ctx.fillRect(0, 0, W, H);
   drawDots(cy);
  ctx.save();
    ctx.translate(Math.round(rand(-shake, shake)), Math.round(-cy + rand(-shake, shake)));
  drawWalls(cy);
  drawBlocks();
   drawGems();
   drawEnemies();
   if (state !== 'dead') drawPlayer();
  drawBullets();
  drawParticles();
  ctx.restore();
   if (state !== 'title') drawHUD();
   drawCombo();
  if (state === 'title') drawTitle();
   if (state === 'dead') drawGameOver();
}



let best = 0;
try { best = Number(localStorage.getItem('gunboots_best')) || 0; } catch (e) {}

const depth = () => Math.max(0, Math.floor(player.y / 10));

function text(str, x, y, color = C.fg, align = 'left') {
  ctx.fillStyle = color;
   ctx.textAlign = align;
   ctx.textBaseline = 'top';
  ctx.font = '8px "Press Start 2P", monospace';
  ctx.fillText(str, x, y);
}

function hurtPlayer() {
  const p = player;
  if (p.invuln > 0) return;      
  p.hp--;
   p.invuln = 1.2;                
  p.vy = -120;   
  p.combo = 0;    
  shake = 6;
  hitstop = 0.1;                
   burst(p.x + 3, p.y + 4, 10, C.red, 80);
  if (p.hp <= 0) die();
}

function die() {
  state = 'dead';
  deadTimer = 0;
  shake = 8;
  burst(player.x + 3, player.y + 4, 30, C.fg, 120);
  if (depth() > best) {
    best = depth();
    try { localStorage.setItem('gunboots_best', best); } catch (e) {}
  }
}
  function drawHUD() {
  const p = player;
  for (let i = 0; i < p.maxHp; i++) {                    // hearts
    ctx.fillStyle = i < p.hp ? C.red : '#33334d';
    ctx.fillRect(WALL + 4 + i * 8, 4, 6, 6);
  }
  for (let i = 0; i < p.maxAmmo; i++) {                  // ammo pips
    ctx.fillStyle = i < p.ammo ? C.gold : '#33334d';
    ctx.fillRect(WALL + 4 + i * 5, 14, 3, 5);
  }
  text(depth() + 'm', W - WALL - 4, 4, C.fg, 'right');
  text(gemCount + 'g', W - WALL - 4, 14, C.gold, 'right');
}

function drawTitle() {
  ctx.fillStyle = 'rgba(16,16,24,0.75)';
   ctx.fillRect(WALL, 0, W - 2 * WALL, H);
  text('GUNBOOTS', W / 2, 70, C.red, 'center');
   text('ARROWS: MOVE', W / 2, 110, C.fg, 'center');
   text('SPACE: JUMP', W / 2, 124, C.fg, 'center');
   text('HOLD IN AIR:', W / 2, 138, C.fg, 'center');
  text('SHOOT', W / 2, 150, C.gold, 'center');
  
  if (Math.floor(performance.now() / 500) % 2) text('PRESS SPACE', W / 2, 190, C.fg, 'center');
   if (best) text('BEST ' + best + 'm', W / 2, 210, C.gold, 'center');
}

function drawGameOver() {
   ctx.fillStyle = 'rgba(16,16,24,0.7)';

   ctx.fillRect(0, 0, W, H);
    text('YOU DIED', W / 2, 80, C.red, 'center');
   text('DEPTH ' + depth() + 'm', W / 2, 105, C.fg, 'center');
  text('GEMS ' + gemCount, W / 2, 119, C.gold, 'center');
  text('BEST ' + best + 'm', W / 2, 133, C.fg, 'center');
   if (deadTimer > 0.7) text('SPACE: RETRY', W / 2, 170, C.fg, 'center');
}
function spawnEnemy(y) {
   const spiked = Math.random() < 0.3;           
  enemies.push({
     type: spiked ? 'spike' : 'blob',
    x : rand(WALL + 4, W - WALL - 12),
    y,  y0: y,  w: 8, h: 8,
    hp: spiked ? 2 : 1,
    vx : (Math.random() < 0.5 ? -1 : 1) * rand(15, 30),
    t:  rand(0, 6),   
    flash: 0,
  });
}

function killEnemy(e) {
   e.dead = true;
  player.combo++;
  dropGems(e.x + 4, e.y + 4, 1 + Math.floor(player.combo / 3));   // bigger combo = more gems
  if (player.combo % 6 === 0 && player.hp < player.maxHp) player.hp++;   // every 6th kill heals
  burst(e.x + 4, e.y + 4, 14, C.red, 90);
  shake = Math.max(shake, 3);
  hitstop = 0.05;
}

function updateEnemies(dt) {
   const p = player;
  for (const e of enemies) {
    if (e.dead) continue;
     e.t += dt;
    e.flash = Math.max(0, e.flash - dt);

    e.x += e.vx * dt;                                        // patrol sideways
     if (e.x < WALL)  { e.x = WALL; e.vx *= -1; }
    if (e.x + e.w > W - WALL) { e.x = W - WALL - e.w; e.vx *= -1; }
      e.y = e.y0 + Math.sin(e.t * 2.5) * 6;                    // bob up and down

    if (overlap(p, e)) {
      const stomping = p.vy > 0 && (p.y + p.h - e.y) < 7 && e.type !== 'spike';
      if (stomping) {
         killEnemy(e);
        p.vy = -170;                                         // bounce off it
        p.ammo = p.maxAmmo;                                  // stomping reloads
      } else {
        hurtPlayer();
      }
    }
  }
  enemies = enemies.filter(e => !e.dead && e.y0 > camY - 60);
}

function drawEnemies() {
  for (const e of enemies) {
    const x = Math.floor(e.x), y = Math.floor(e.y);
    ctx.fillStyle  = e.flash > 0 ? C.fg : C.red;              // flashes white when hit
    ctx.fillRect(x, y, 8, 8) ;
    ctx.fillStyle = C.fg;
     ctx.fillRect(x + 1, y + 3, 2, 2);                        // eyes
    ctx.fillRect(x + 5, y + 3, 2, 2);
    if (e.type === 'spike') {                                // spikes on top
      ctx.fillRect(x, y - 2, 2, 2) ;
       ctx.fillRect(x + 3, y - 2, 2, 2);
      ctx.fillRect(x + 6, y - 2, 2, 2);
    }
  }
}


requestAnimationFrame(frame);   