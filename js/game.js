(function(){
"use strict";

// ============================================================
// Rolling Sky — Web Port (Three.js)
// Ported gameplay concepts + real assets from the original Unity
// project: world backgrounds, ball skin, and sound effects.
// Obstacle names/behaviors are modeled after the original's
// SegmentType / PrefabName enums (Riser, Crusher, Slasher, Roller,
// Binary, Laser, Turbine, Pyramid, TallTree, Fragile, ...).
// ============================================================

const canvas = document.getElementById('c');
const renderer = new THREE.WebGLRenderer({canvas, antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio,2));
const scene = new THREE.Scene();
const camera = new THREE.PerspectiveCamera(62, innerWidth/innerHeight, 0.1, 300);

function resize(){
  renderer.setSize(innerWidth, innerHeight);
  camera.aspect = innerWidth/innerHeight;
  camera.updateProjectionMatrix();
}
addEventListener('resize', resize); resize();

scene.add(new THREE.HemisphereLight(0xffffff, 0x445577, 1.05));
const sun = new THREE.DirectionalLight(0xffffff, 0.9);
sun.position.set(-4,10,6);
scene.add(sun);

// ---------------- real asset loading ----------------
renderer.outputEncoding = THREE.sRGBEncoding;
const texLoader = new THREE.TextureLoader();
const WORLD_IMAGES = ['world1.png','world2.png','world3.png','world4.png','world5.png'];
const worldTextures = WORLD_IMAGES.map(f=>{
  const t = texLoader.load('assets/textures/'+f);
  t.encoding = THREE.sRGBEncoding;
  return t;
});
const ballTexture = texLoader.load('assets/textures/ball.png');
ballTexture.encoding = THREE.sRGBEncoding;

const SFX = {
  jump:   new Audio('assets/audio/jump.wav'),
  pickup: new Audio('assets/audio/pickup.wav'),
  crash:  new Audio('assets/audio/crash.wav'),
  boom:   new Audio('assets/audio/boom.wav'),
  laser:  new Audio('assets/audio/laser.wav'),
};
Object.values(SFX).forEach(a=>{ a.volume = 0.55; });
const MUSIC = [new Audio('assets/audio/music1.mp3'), new Audio('assets/audio/music3.mp3')];
MUSIC.forEach(m=>{ m.loop = true; m.volume = 0.35; });
let musicOn = true;
function playSfx(name){
  if(!musicOn) return;
  try{ const a = SFX[name]; a.currentTime = 0; a.play().catch(()=>{}); }catch(e){}
}
let curMusic = null;
function startMusic(idx){
  MUSIC.forEach(m=>m.pause());
  if(!musicOn) return;
  curMusic = MUSIC[idx % MUSIC.length];
  curMusic.currentTime = 0;
  curMusic.play().catch(()=>{});
}
document.getElementById('muteBtn').addEventListener('click', function(){
  musicOn = !musicOn;
  this.textContent = musicOn ? '🔊 사운드' : '🔇 음소거';
  if(!musicOn){ MUSIC.forEach(m=>m.pause()); } else if(curMusic){ curMusic.play().catch(()=>{}); }
});

// ---------------- world themes ----------------
const THEMES = [
  {sky:[0x8ec9ff,0xeaf7ff], track:0xffffff, accent:0xff8fa3, name:'VALEA'},
  {sky:[0xffd08a,0xfff4e0], track:0xfff1e6, accent:0xff5f6d, name:'APERTA'},
  {sky:[0xb9ffcf,0xf0fff6], track:0xf3fff6, accent:0x2ec4b6, name:'GARDENEA'},
  {sky:[0xd9b8ff,0xf3e9ff], track:0xf7f0ff, accent:0x9b5de5, name:'ZIGAZA'},
  {sky:[0xffd6e8,0xfff0f6], track:0xfff3f8, accent:0xff477e, name:'RODROM'},
];
let themeIdx = 0;
function skyColor(t, idx){
  const th = THEMES[idx % THEMES.length];
  const top = new THREE.Color(th.sky[0]);
  const bot = new THREE.Color(th.sky[1]);
  return top.lerp(bot, t);
}
scene.background = skyColor(0,0);
scene.fog = new THREE.Fog(skyColor(0.6,0).getHex(), 34, 95);

// backdrop billboard using the real world artwork
const backdropGeo = new THREE.PlaneGeometry(60, 34);
const backdropMats = worldTextures.map(t=>new THREE.MeshBasicMaterial({map:t, transparent:true, opacity:0.55, depthWrite:false}));
const backdrop = new THREE.Mesh(backdropGeo, backdropMats[0]);
backdrop.position.set(0, 10, -40);
scene.add(backdrop);

// ---------------- constants ----------------
const TILE_LEN = 4;
const TRACK_HALF_W = 3.4;
const BALL_R = 0.42;
const GRAVITY = -22;
const JUMP_V = 8.6;
const BASE_SPEED = 6.4;

// ---------------- ball ----------------
const ballGeo = new THREE.SphereGeometry(BALL_R, 28, 28);
const ballMat = new THREE.MeshStandardMaterial({map:ballTexture, roughness:0.3, metalness:0.05});
const ball = new THREE.Mesh(ballGeo, ballMat);
scene.add(ball);
const ring = new THREE.Mesh(new THREE.TorusGeometry(BALL_R*1.15,0.03,8,24), new THREE.MeshBasicMaterial({color:0xffe66d}));
ring.rotation.x = Math.PI/2;
ball.add(ring);

// ---------------- shared materials ----------------
const M = {
  hazard: new THREE.MeshStandardMaterial({color:0xff4757, roughness:0.4}),
  hazard2: new THREE.MeshStandardMaterial({color:0xffb703, roughness:0.3}),
  metal: new THREE.MeshStandardMaterial({color:0x8d99ae, roughness:0.5, metalness:0.4}),
  boost: new THREE.MeshStandardMaterial({color:0x2ec4b6, emissive:0x0a5c53}),
  gem: new THREE.MeshStandardMaterial({color:0x5ef1ff, emissive:0x1188aa, roughness:0.2, metalness:0.4}),
  wood: new THREE.MeshStandardMaterial({color:0x7a5230, roughness:0.8}),
  leaf: new THREE.MeshStandardMaterial({color:0x3fa34d, roughness:0.7}),
  laserBeam: new THREE.MeshBasicMaterial({color:0xff1744, transparent:true, opacity:0.85}),
  laserOff: new THREE.MeshBasicMaterial({color:0xff1744, transparent:true, opacity:0.12}),
  crack: new THREE.MeshStandardMaterial({color:0xd8d8d8, roughness:0.9}),
};

const gemGeo = new THREE.OctahedronGeometry(0.22,0);

// ---------------- world/track group ----------------
const world = new THREE.Group();
scene.add(world);
let tiles = [];
let nextGuaranteedSafe = 3;
let worldTime = 0; // seconds since run start, drives periodic obstacle phases

function groundMesh(theme){
  const g = new THREE.Mesh(new THREE.BoxGeometry(TRACK_HALF_W*2, 0.4, TILE_LEN),
    new THREE.MeshStandardMaterial({color:theme.track, roughness:0.75}));
  return g;
}

// ============================================================
// Obstacle generators. Each returns:
//  { kind, objs:[Object3D,...], collide(ctx)->bool(hit), fall(ctx)->bool(fell), update(dt) }
// ctx = { x, y, localZ, jumping }  (localZ in [-2,2], tile-local)
// ============================================================

function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
function rand(a,b){ return a + Math.random()*(b-a); }

function genPlain(){ return {kind:'plain', objs:[]}; }

function genGap(){
  const gapCenter = rand(-1,1)*TRACK_HALF_W*0.5;
  const gapWidth = rand(1.4,2.2);
  const marker = new THREE.Mesh(new THREE.PlaneGeometry(gapWidth, TILE_LEN*0.9),
     new THREE.MeshBasicMaterial({color:0x223344, transparent:true, opacity:0.85}));
  marker.rotation.x = -Math.PI/2;
  marker.position.set(gapCenter, -0.05, 0);
  return {kind:'gap', objs:[marker], gapCenter, gapWidth,
    fall(ctx){ return Math.abs(ctx.x-gapCenter) < gapWidth/2 && ctx.y<=BALL_R+0.02 && !ctx.jumping; }};
}

function wallHalves(gapCenter, gapW, height, mat){
  const totalW = TRACK_HALF_W*2;
  const leftW = (totalW/2 + gapCenter) - gapW/2;
  const rightW = totalW - leftW - gapW;
  const objs = [];
  if(leftW>0.15){ const wl = new THREE.Mesh(new THREE.BoxGeometry(leftW,height,0.35), mat); wl.position.set(-totalW/2+leftW/2, height/2+0.2, 0); objs.push(wl); }
  if(rightW>0.15){ const wr = new THREE.Mesh(new THREE.BoxGeometry(rightW,height,0.35), mat); wr.position.set(totalW/2-rightW/2, height/2+0.2, 0); objs.push(wr); }
  return objs;
}

function genWall(){
  const gapCenter = rand(-1,1)*TRACK_HALF_W*0.55;
  const gapW = 1.3;
  const objs = wallHalves(gapCenter, gapW, 1.1, M.hazard2);
  return {kind:'wall', objs, gapCenter, gapW,
    collide(ctx){ return Math.abs(ctx.x-gapCenter) > gapW/2 - BALL_R*0.6; }};
}

function genPyramid(){
  // narrow central wedge: must be jumped, dodging around it is not possible (spans center fully)
  const w = rand(1.6,2.4);
  const h = rand(0.7,1.0);
  const geo = new THREE.CylinderGeometry(0, w*0.72, h, 4);
  const mesh = new THREE.Mesh(geo, M.hazard2);
  mesh.rotation.y = Math.PI/4;
  mesh.position.set(0, h/2, 0);
  return {kind:'pyramid', objs:[mesh], h,
    collide(ctx){ return Math.abs(ctx.x) < w/2 && ctx.y < h+BALL_R*0.6; }};
}

function genSpikes(){
  const objs = []; const positions = [];
  const count = 1+Math.floor(Math.random()*3);
  for(let i=0;i<count;i++){
    let x, tries=0;
    do{ x = rand(-1,1)*(TRACK_HALF_W-0.6); tries++; }while(positions.some(p=>Math.abs(p-x)<0.7)&&tries<10);
    positions.push(x);
    const s = new THREE.Mesh(new THREE.ConeGeometry(0.28,0.5,5), M.hazard);
    s.position.set(x, 0.45, rand(-1,1)*TILE_LEN*0.3);
    s.rotation.y = Math.random()*Math.PI;
    objs.push(s);
  }
  return {kind:'spikes', objs, positions,
    collide(ctx){ if(ctx.y>0.75) return false; return positions.some(p=>Math.abs(ctx.x-p)<BALL_R+0.32); }};
}

function genTallTree(){
  const x = rand(-1,1)*(TRACK_HALF_W-0.7);
  const grp = new THREE.Group();
  const trunk = new THREE.Mesh(new THREE.CylinderGeometry(0.16,0.2,1.1,8), M.wood);
  trunk.position.y = 0.55;
  const leaves = new THREE.Mesh(new THREE.ConeGeometry(0.55,1.2,8), M.leaf);
  leaves.position.y = 1.35;
  grp.add(trunk, leaves);
  grp.position.set(x,0,0);
  return {kind:'tallTree', objs:[grp], x,
    collide(ctx){ return Math.abs(ctx.x-x) < BALL_R+0.45; }}; // not jumpable, must dodge
}

function genBoost(){
  const x = rand(-1,1)*TRACK_HALF_W*0.5;
  const pad = new THREE.Mesh(new THREE.CylinderGeometry(0.5,0.5,0.06,16), M.boost);
  pad.position.set(x,0.23,0);
  let used = false;
  return {kind:'boost', objs:[pad], x,
    update(dt){ pad.rotation.y += dt*1.5; },
    activate(ctx){ if(!used && Math.abs(ctx.x-x)<0.55 && ctx.y<0.5){ used = true; pad.visible=false; return true; } return false; }};
}

// ---- timed / periodic obstacles (use worldTime + random phase offset) ----

function genRiser(){
  const x = rand(-1,1)*(TRACK_HALF_W-0.6);
  const period = rand(1.6,2.2);
  const phase = Math.random()*period;
  const col = new THREE.Mesh(new THREE.CylinderGeometry(0.4,0.4,1.0,16), M.metal);
  col.position.set(x, -0.5, 0);
  return {kind:'riser', objs:[col], x, period, phase,
    update(dt){
      const t = ((worldTime+phase)%period)/period;
      const h = Math.max(0, Math.sin(t*Math.PI*2)) * 0.85; // 0..0.85
      col.position.y = -0.5 + h;
      this._h = h;
    },
    collide(ctx){ return Math.abs(ctx.x-x) < 0.55 && ctx.y < this._h+BALL_R*0.8 && this._h>0.18; }};
}

function genCrusher(){
  // overhead hammer slams the center strip; sides always stay open
  const half = 1.1;
  const period = rand(1.5,2.0);
  const phase = Math.random()*period;
  const hammer = new THREE.Mesh(new THREE.BoxGeometry(half*2,0.4,0.9), M.metal);
  const shadow = new THREE.Mesh(new THREE.PlaneGeometry(half*2,0.9), new THREE.MeshBasicMaterial({color:0x000000, transparent:true, opacity:0.0}));
  shadow.rotation.x = -Math.PI/2; shadow.position.set(0,0.01,0);
  hammer.position.set(0, 3.2, 0);
  return {kind:'crusher', objs:[hammer, shadow], half, period, phase, _down:false,
    update(dt){
      const t = ((worldTime+phase)%period)/period;
      // fast slam down around t=0.55..0.75, otherwise raised
      let y;
      if(t<0.5){ y = 3.2; shadow.material.opacity = 0; this._down=false; }
      else if(t<0.62){ const k=(t-0.5)/0.12; y = 3.2 - k*(3.2-0.25); shadow.material.opacity = k*0.4; if(k>0.9) this._down=true; }
      else if(t<0.72){ y = 0.25; shadow.material.opacity = 0.4; this._down=true; }
      else { const k=(t-0.72)/0.28; y = 0.25 + k*(3.2-0.25); shadow.material.opacity = 0.4*(1-k); this._down = k<0.15; }
      hammer.position.y = y;
    },
    collide(ctx){ return this._down && Math.abs(ctx.x) < half+BALL_R*0.5; }};
}

function genSlasher(){
  // fast spinning blade bar whose height bobs — jump timing required
  const bar = new THREE.Mesh(new THREE.BoxGeometry(TRACK_HALF_W*2*0.62,0.32,0.32), M.hazard2);
  const pivot = new THREE.Group(); pivot.add(bar);
  const speed = rand(2.6,3.6);
  const phase = Math.random()*Math.PI*2;
  return {kind:'slasher', objs:[pivot], speed, phase, _y:0.42,
    update(dt){
      const y = 0.42 + Math.max(0,Math.sin(worldTime*speed+phase))*0.55;
      bar.position.y = y; pivot.rotation.z = Math.sin(worldTime*speed*0.5+phase)*0.12;
      this._y = y;
    },
    collide(ctx){ return Math.abs(ctx.y - this._y) < 0.3; }};
}

function genRoller(){
  // barrel rolling side to side across the track
  const barrel = new THREE.Mesh(new THREE.CylinderGeometry(0.42,0.42,0.7,16), M.hazard2);
  barrel.rotation.z = Math.PI/2;
  const period = rand(1.8,2.6);
  const phase = Math.random()*period;
  return {kind:'roller', objs:[barrel], period, phase, _x:0,
    update(dt){
      const t = ((worldTime+phase)%period)/period;
      const x = Math.sin(t*Math.PI*2) * (TRACK_HALF_W-0.6);
      barrel.position.set(x, 0.42, 0);
      barrel.rotation.x += dt*4;
      this._x = x;
    },
    collide(ctx){ return Math.abs(ctx.x-this._x) < BALL_R+0.42 && ctx.y < 0.9; }};
}

function genBinary(){
  // two half-width blocks alternate open/closed
  const period = rand(1.4,1.9);
  const phase = Math.random()*period;
  const half = TRACK_HALF_W;
  const left = new THREE.Mesh(new THREE.BoxGeometry(half,0.8,0.9), M.hazard2);
  left.position.set(-half/2, 0.4, 0);
  const right = new THREE.Mesh(new THREE.BoxGeometry(half,0.8,0.9), M.hazard2);
  right.position.set(half/2, 0.4, 0);
  return {kind:'binary', objs:[left,right], period, phase, _leftUp:true,
    update(dt){
      const t = ((worldTime+phase)%period)/period;
      const leftUp = t<0.5;
      left.visible = leftUp; right.visible = !leftUp;
      this._leftUp = leftUp;
    },
    collide(ctx){
      const onLeft = ctx.x < 0;
      const blocked = this._leftUp ? onLeft : !onLeft;
      return blocked && ctx.y < 0.85;
    }};
}

function genLaser(){
  const period = rand(1.6,2.2);
  const onFrac = 0.42;
  const phase = Math.random()*period;
  const beamMat = M.laserOff.clone();
  const beam = new THREE.Mesh(new THREE.BoxGeometry(TRACK_HALF_W*2, 0.9, 0.12), beamMat);
  beam.position.set(0, 0.55, 0);
  return {kind:'laser', objs:[beam], period, phase, _on:false,
    update(dt){
      const t = ((worldTime+phase)%period)/period;
      const priming = t> (1-onFrac-0.15) && t<(1-onFrac);
      const on = t > (1-onFrac);
      this._on = on;
      beamMat.color.setHex(0xff1744);
      beamMat.opacity = on?0.9:(priming?0.45:0.12);
      if(on && !this._played){ playSfx('laser'); this._played=true; }
      if(!on) this._played=false;
    },
    collide(ctx){ return this._on && ctx.y < 1.0; }};
}

function genTurbine(){
  // spinning fan: non-lethal but pushes the ball sideways
  const x = rand(-1,1)*TRACK_HALF_W*0.5;
  const grp = new THREE.Group();
  const hub = new THREE.Mesh(new THREE.CylinderGeometry(0.18,0.18,0.5,10), M.metal);
  hub.rotation.z = Math.PI/2;
  const blade = new THREE.Mesh(new THREE.BoxGeometry(1.1,0.08,0.3), M.metal);
  grp.add(hub, blade);
  grp.position.set(x, 0.6, 0);
  const dir = Math.random()<0.5?-1:1;
  return {kind:'turbine', objs:[grp], x, dir, push:0,
    update(dt){ blade.rotation.x += dt*10; },
    force(ctx){ if(Math.abs(ctx.x-x)<1.0){ return dir*3.0; } return 0; }};
}

function genFragile(theme){
  const ground = groundMesh(theme);
  ground.material = M.crack.clone();
  const traverseTime = TILE_LEN/BASE_SPEED;
  let t = 0, broken = false;
  return {kind:'fragile', objs:[], groundOverride:ground, _t:0,
    update(dt){
      t += dt;
      if(!broken && t > traverseTime*0.85){ broken=true; ground.visible=false; }
    },
    fall(ctx){ return broken && ctx.y<=BALL_R+0.05; }};
}

const GEN_TABLE = [
  genPlain, genPlain, genGap, genWall, genPyramid, genSpikes, genTallTree,
  genBoost, genRiser, genCrusher, genSlasher, genRoller, genBinary, genLaser, genTurbine, genFragile
];

function spawnGems(tileGroup, avoidX, avoidR){
  const gems = [];
  if(Math.random()<0.55){
    const count = 1+Math.floor(Math.random()*4);
    const lineX = rand(-1,1)*TRACK_HALF_W*0.55;
    for(let i=0;i<count;i++){
      if(avoidX!==undefined && Math.abs(lineX-avoidX)<avoidR) continue;
      const g = new THREE.Mesh(gemGeo, M.gem);
      g.position.set(lineX, 0.55, -TILE_LEN*0.35 + i*(TILE_LEN*0.7/Math.max(1,count-1||1)));
      tileGroup.add(g);
      gems.push(g);
    }
  }
  return gems;
}

function addTile(index){
  const z = -index*TILE_LEN - TILE_LEN/2;
  const group = new THREE.Group();
  group.position.z = z;
  const theme = THEMES[Math.floor(index/12)%THEMES.length];

  let gen;
  if(index < nextGuaranteedSafe){ gen = genPlain(); }
  else { gen = pick(GEN_TABLE)(theme); }

  const ground = gen.groundOverride || groundMesh(theme);
  group.add(ground);
  gen.objs.forEach(o=>group.add(o));

  let avoidX, avoidR;
  if(gen.kind==='gap'){ avoidX=gen.gapCenter; avoidR=gen.gapWidth*0.7; }
  if(gen.kind==='wall'){ avoidX=gen.gapCenter; avoidR=gen.gapW*0.6; }
  const gems = spawnGems(group, avoidX, avoidR);

  world.add(group);
  tiles.push({group, z, index, gen, gems, theme});
}

function clearTrack(){ tiles.forEach(t=>world.remove(t.group)); tiles = []; }

function ensureTiles(currentIndex){
  const target = currentIndex+10;
  while(tiles.length===0 || tiles[tiles.length-1].index<target) addTile(tiles.length? tiles[tiles.length-1].index+1 : 0);
  while(tiles.length && tiles[0].index < currentIndex-3){ world.remove(tiles[0].group); tiles.shift(); }
}

// ---------------- game state ----------------
let state = 'menu';
let ballX=0, ballVX=0, ballY=BALL_R, ballVY=0, jumping=false;
let distance=0, speed=BASE_SPEED, boostTimer=0;
let lives=3, gems=0, checkpointDist=0, checkpointGems=0, invuln=0, best=0;

try{ best = parseFloat(localStorage.getItem('rs_best')||'0')||0; }catch(e){}
document.getElementById('best').textContent = best>0 ? ('BEST '+Math.floor(best)+'m') : '';

let moveDir=0, touchStartX=null;
const keys={};
addEventListener('keydown', e=>{ keys[e.code]=true; if(e.code==='Space') tryJump(); });
addEventListener('keyup', e=>{ keys[e.code]=false; });
function tryJump(){ if(state!=='playing') return; if(!jumping){ ballVY=JUMP_V; jumping=true; playSfx('jump'); } }
canvas.addEventListener('pointerdown', e=>{ if(state!=='playing') return; touchStartX=e.clientX; tryJump(); });
canvas.addEventListener('pointermove', e=>{ if(state!=='playing'||touchStartX===null) return; const dx=e.clientX-touchStartX; moveDir=Math.max(-1,Math.min(1,dx/60)); });
canvas.addEventListener('pointerup', ()=>{ touchStartX=null; moveDir=0; });
canvas.addEventListener('pointercancel', ()=>{ touchStartX=null; moveDir=0; });
function updateKeyMove(){
  let d=0;
  if(keys.ArrowLeft||keys.KeyA) d-=1;
  if(keys.ArrowRight||keys.KeyD) d+=1;
  if(d!==0) moveDir=d; else if(touchStartX===null) moveDir*=0.8;
}

const gemCountEl=document.getElementById('gemCount'), lifeCountEl=document.getElementById('lifeCount');
const progressBar=document.getElementById('progressBar'), overlay=document.getElementById('overlay');
const titleEl=document.getElementById('title'), subtitleEl=document.getElementById('subtitle');
const statsEl=document.getElementById('stats'), startBtn=document.getElementById('startBtn');
const worldLabel=document.getElementById('worldLabel');
const TOTAL_GOAL=400;

function updateHud(){
  gemCountEl.textContent=gems; lifeCountEl.textContent=lives;
  progressBar.style.width = Math.min(100,(distance%TOTAL_GOAL)/TOTAL_GOAL*100)+'%';
  worldLabel.textContent = THEMES[themeIdx%THEMES.length].name;
}

function resetRun(fromCheckpoint){
  ballX=0; ballVX=0; ballY=BALL_R; ballVY=0; jumping=false;
  speed=BASE_SPEED; boostTimer=0; invuln=1.2; worldTime=0;
  if(fromCheckpoint){ distance=checkpointDist; gems=checkpointGems; }
  else { distance=0; gems=0; lives=3; checkpointDist=0; checkpointGems=0; }
  clearTrack();
  const startIndex = Math.max(0, Math.floor(distance/TILE_LEN)-2);
  nextGuaranteedSafe = startIndex+3;
  for(let i=startIndex;i<startIndex+12;i++) addTile(i);
  updateHud();
  startMusic(Math.floor(distance/(TILE_LEN*12))%MUSIC.length);
}

function gameOver(dead){
  state='dead';
  if(distance>best){ best=distance; try{ localStorage.setItem('rs_best', String(best)); }catch(e){} }
  document.getElementById('best').textContent = best>0 ? ('BEST '+Math.floor(best)+'m') : '';
  const outOfLives = lives<=0;
  titleEl.textContent = outOfLives ? 'GAME OVER' : '체크포인트에서 재시작';
  subtitleEl.textContent = '거리 '+Math.floor(distance)+'m · 젬 '+gems+'개';
  statsEl.textContent = outOfLives ? '' : ('남은 목숨: '+lives);
  startBtn.textContent = outOfLives ? '다시 시작' : '계속하기';
  overlay.style.display='flex';
  MUSIC.forEach(m=>m.pause());
}

startBtn.addEventListener('click', ()=>{
  overlay.style.display='none';
  if(state==='menu'||lives<=0) resetRun(false); else resetRun(true);
  state='playing';
});

function currentTileFor(zDist){ const idx=Math.floor(zDist/TILE_LEN); return tiles.find(t=>t.index===idx); }

function handleCollisions(dt){
  const tile = currentTileFor(distance);
  if(!tile) return;
  const localZ = (distance - tile.index*TILE_LEN) - TILE_LEN/2 <= 0 ? 0 : 0; // reserved (obstacles treated whole-tile)
  const gen = tile.gen;
  const ctx = {x:ballX, y:ballY, localZ, jumping};

  if(gen.update) gen.update(dt);

  if(gen.fall && gen.fall(ctx)){ triggerFall(); return; }
  if(gen.collide && invuln<=0 && gen.collide(ctx)){ triggerHit(gen.kind); return; }
  if(gen.force){
    const f = gen.force(ctx);
    if(f){
      ballX += f*dt;
      ballX = Math.max(-TRACK_HALF_W+BALL_R, Math.min(TRACK_HALF_W-BALL_R, ballX));
      ball.position.x = ballX;
    }
  }
  if(gen.kind==='boost' && gen.activate && gen.activate(ctx)){ boostTimer=1.4; }

  if(tile.gems){
    for(const g of tile.gems){
      if(!g.visible) continue;
      const worldZ = tile.z + g.position.z;
      const dz = worldZ - (-distance);
      if(Math.abs(dz)<0.4 && Math.abs(ballX-g.position.x)<0.4 && Math.abs(ballY-g.position.y)<0.5){
        g.visible=false; gems++; playSfx('pickup');
      }
    }
  }

  const cpEvery=40;
  if(distance-checkpointDist>cpEvery){ checkpointDist=Math.floor(distance/cpEvery)*cpEvery; checkpointGems=gems; }
}

function triggerFall(){ if(invuln>0) return; state='falling'; lives--; ballVY=-2; playSfx('crash'); setTimeout(()=>gameOver(true), 500); }
function triggerHit(kind){ if(invuln>0) return; state='falling'; lives--; playSfx(kind==='laser'?'boom':'crash'); setTimeout(()=>gameOver(true), 350); }

const camOffset = new THREE.Vector3(0,3.4,6.2);
function updateCamera(dt){
  const targetPos = new THREE.Vector3(ball.position.x*0.5, ball.position.y+camOffset.y, ball.position.z+camOffset.z);
  camera.position.lerp(targetPos, 1-Math.pow(0.001, dt));
  camera.lookAt(new THREE.Vector3(ball.position.x*0.5, ball.position.y+0.3, ball.position.z-4));
  backdrop.position.set(camera.position.x*0.3, 10, camera.position.z-40);
}

let last = performance.now();
function frame(now){
  const dt = Math.min(0.05,(now-last)/1000); last=now;

  if(state==='playing'){
    worldTime += dt;
    updateKeyMove();
    if(boostTimer>0) boostTimer -= dt;
    const curSpeed = speed*(boostTimer>0?1.8:1)*(1+Math.min(0.6, distance/600));
    distance += curSpeed*dt;

    ballVX = moveDir*5.5;
    ballX += ballVX*dt;
    ballX = Math.max(-TRACK_HALF_W+BALL_R, Math.min(TRACK_HALF_W-BALL_R, ballX));

    ballVY += GRAVITY*dt; ballY += ballVY*dt;
    if(ballY<=BALL_R){ ballY=BALL_R; ballVY=0; jumping=false; }
    if(invuln>0) invuln -= dt;

    ball.position.set(ballX, ballY, -distance);
    ball.rotation.x -= curSpeed*dt/BALL_R;
    ball.rotation.z = -ballX*0.3;

    const themeN = Math.floor(distance/(TILE_LEN*12));
    if(themeN!==themeIdx){ themeIdx=themeN; backdrop.material = backdropMats[themeIdx%backdropMats.length]; startMusic(themeIdx); }
    scene.background = skyColor((Math.sin(distance*0.02)+1)/2, themeIdx);
    scene.fog.color = scene.background;

    ensureTiles(Math.floor(distance/TILE_LEN));
    handleCollisions(dt);
    updateHud();

    tiles.forEach(t=>{ if(t.gems) t.gems.forEach(g=>{ if(g.visible) g.rotation.y += dt*3; }); });
  } else if(state==='falling'){
    ballVY += GRAVITY*dt; ballY += ballVY*dt;
    ball.position.set(ballX, ballY, -distance);
    ball.rotation.x -= 4*dt/BALL_R;
  }

  updateCamera(dt);
  renderer.render(scene, camera);
  requestAnimationFrame(frame);
}
requestAnimationFrame(frame);

resetRun(false);
state='menu';

})();
