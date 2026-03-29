const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// 1. Get name from URL or LocalStorage
const urlParams = new URLSearchParams(window.location.search);
const storedName = localStorage.getItem('aiven-game-player-name');
const playerName = urlParams.get('name') || storedName || "Player";

function resize() {
  canvas.width = window.innerWidth;
  canvas.height = window.innerHeight;
}
window.addEventListener('resize', resize);
resize();

// Game State
let myId = null;
let players = {};
let bullets = [];
let explosions = [];
let isDead = false;

const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
const mouse = { x: 0, y: 0 };
let lastShootTime = 0;

// --- STATISTICS & LEADERBOARD REFRESHER ---
async function refreshStats() {
  try {
    const statsRes = await fetch('/stats');
    if (statsRes.ok) {
      const statsData = await statsRes.json();
      // Updated to match your game.html IDs
      const activeEl = document.getElementById('ui-players');
      const totalEl = document.getElementById('play-count');
      if (activeEl) activeEl.innerText = statsData.activePlayers;
      if (totalEl) totalEl.innerText = statsData.playCount;
    }

    const lbRes = await fetch('/leaderboard');
    if (lbRes.ok) {
      const lbData = await lbRes.json();
      const lbList = document.getElementById('leaderboard-list');
      if (lbList && lbData.topPlayers) {
        lbList.innerHTML = lbData.topPlayers
          .map(p => `<li><strong>${p.username || 'Player'}</strong>: ${p.score}</li>`)
          .join('');
      }
    }
  } catch (e) { console.log("Stats fetch error"); }
}
setInterval(refreshStats, 3000);

// --- INPUT HANDLING ---
window.addEventListener('mousedown', (e) => { if (e.button === 0) fireWeapon(); });
window.addEventListener('keydown', e => {
  const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = true;
  if (e.code === 'Space') fireWeapon();
});
window.addEventListener('keyup', e => { const k = e.key.toLowerCase(); if (keys.hasOwnProperty(k)) keys[k] = false; });
window.addEventListener('mousemove', e => {
  const rect = canvas.getBoundingClientRect();
  mouse.x = e.clientX - rect.left;
  mouse.y = e.clientY - rect.top;
});

function fireWeapon() {
  if (!myId || !players[myId] || isDead) return;
  if (Date.now() - lastShootTime > 200) {
    const p = players[myId];
    ws.send(JSON.stringify({ type: 'shoot', angle: Math.atan2(mouse.y - p.y, mouse.x - p.x) }));
    lastShootTime = Date.now();
  }
}

// --- NETWORKING ---
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  switch (data.type) {

    case 'kafka-event':
      const feed = document.getElementById('feed-list'); // Ensure this ID exists in your HTML
      if (feed) {
        const li = document.createElement('li');
        li.style.color = "#00e676";
        li.innerHTML = `<strong>[${new Date().toLocaleTimeString()}]</strong> ${data.event}`;
        feed.insertBefore(li, feed.firstChild);
        if (feed.children.length > 5) feed.removeChild(feed.lastChild);
      }
      break;


    case 'init':
      myId = data.playerState.id;
      players = {}; // Clear old state
      data.allPlayers.forEach(p => { players[p.id] = p; });

      // Initialize local player correctly before syncing
      players[myId] = data.playerState;
      players[myId].name = playerName;

      // Now sync confirmed state to server
      ws.send(JSON.stringify({ type: 'sync', state: players[myId] }));
      break;

    case 'updatePlayer':
      players[data.player.id] = data.player;
      if (data.player.id === myId && document.getElementById('ui-score')) {
        document.getElementById('ui-score').innerText = data.player.score;
      }
      break;

    case 'shoot':
      bullets.push({ x: data.x, y: data.y, vx: Math.cos(data.angle) * 15, vy: Math.sin(data.angle) * 15, owner: data.player, life: 100 });
      break;

    case 'playerDied':
      if (players[data.player]) {
        players[data.player].isDead = true;
        createExplosion(data.x || players[data.player].x, data.y || players[data.player].y, data.player === myId ? '#ff3366' : '#3d5afe');
      }
      if (data.player === myId) {
        isDead = true;
        setTimeout(() => { isDead = false; }, 3000);
      }
      break;

    case 'playerLeft':
      delete players[data.player];
      break;
  }
};

function createExplosion(x, y, color) {
  for (let i = 0; i < 15; i++) {
    explosions.push({ x, y, vx: (Math.random() - 0.5) * 12, vy: (Math.random() - 0.5) * 12, life: 25, maxLife: 25, color });
  }
}

function update() {
  if (!myId || !players[myId] || isDead) return;
  const p = players[myId];
  let moved = false;
  if (keys.w || keys.arrowup) { p.y -= 5; moved = true; }
  if (keys.s || keys.arrowdown) { p.y += 5; moved = true; }
  if (keys.a || keys.arrowleft) { p.x -= 5; moved = true; }
  if (keys.d || keys.arrowright) { p.x += 5; moved = true; }
  if (moved) ws.send(JSON.stringify({ type: 'sync', state: p }));
}

function draw() {
  ctx.fillStyle = 'rgba(11, 13, 18, 0.4)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  const me = players[myId];

  // Draw Aim Line
  if (me && !isDead) {
    ctx.beginPath(); ctx.setLineDash([5, 5]); ctx.strokeStyle = 'rgba(255,255,255,0.1)';
    ctx.moveTo(me.x, me.y); ctx.lineTo(mouse.x, mouse.y); ctx.stroke(); ctx.setLineDash([]);
  }

  // Draw Explosions
  for (let i = explosions.length - 1; i >= 0; i--) {
    let e = explosions[i]; e.x += e.vx; e.y += e.vy; e.life--;
    if (e.life <= 0) explosions.splice(i, 1);
    else { ctx.globalAlpha = e.life / e.maxLife; ctx.fillStyle = e.color; ctx.beginPath(); ctx.arc(e.x, e.y, 3, 0, Math.PI * 2); ctx.fill(); }
  }
  ctx.globalAlpha = 1;

  // Draw Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i]; b.x += b.vx; b.y += b.vy; b.life--;
    if (!isDead && me && b.owner !== myId) {
      if (Math.hypot(b.x - me.x, b.y - me.y) < 20) {
        ws.send(JSON.stringify({ type: 'die', killer: b.owner }));
        b.life = 0;
      }
    }
    if (b.life <= 0) { bullets.splice(i, 1); continue; }
    ctx.fillStyle = b.owner === myId ? '#ff3366' : '#00e676';
    ctx.beginPath(); ctx.arc(b.x, b.y, 4, 0, Math.PI * 2); ctx.fill();
  }

  // Draw Players
  Object.values(players).forEach(p => {
    // Check if player has valid coordinates before drawing
    if (p.isDead || p.x === 0 || p.x === undefined) return;
    ctx.fillStyle = p.id === myId ? '#7b2cbf' : '#3d5afe';
    ctx.beginPath(); ctx.arc(p.x, p.y, 15, 0, Math.PI * 2); ctx.fill();
    ctx.fillStyle = 'white'; ctx.font = 'bold 14px Inter, Arial'; ctx.textAlign = 'center';
    ctx.fillText(p.name || "Enemy", p.x, p.y - 25);
  });

  requestAnimationFrame(draw);
}

setInterval(update, 1000 / 60);
requestAnimationFrame(draw);
