const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

const playerName = prompt("Enter your Name:") || "Player";

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
let myScore = 0;
let isDead = false;

// Input State: added arrow keys for robust movement
const keys = { w: false, a: false, s: false, d: false, arrowup: false, arrowdown: false, arrowleft: false, arrowright: false };
const mouse = { x: 0, y: 0, clicked: false };

window.addEventListener('keydown', e => { 
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = true; 
});
window.addEventListener('keyup', e => { 
  const k = e.key.toLowerCase();
  if (keys.hasOwnProperty(k)) keys[k] = false; 
});
canvas.addEventListener('mousemove', e => { mouse.x = e.clientX; mouse.y = e.clientY; });
canvas.addEventListener('mousedown', e => { mouse.clicked = true; });

// WebSocket Connection
const wsProtocol = window.location.protocol === 'https:' ? 'wss:' : 'ws:';
const ws = new WebSocket(`${wsProtocol}//${window.location.host}`);

ws.onopen = () => { logEvent('System', 'Connected to Valkey Game Server'); };

ws.onmessage = (msg) => {
  const data = JSON.parse(msg.data);
  switch(data.type) {
    case 'init':
      myId = data.playerState.id;
      players = {};
      if (data.allPlayers) {
        data.allPlayers.forEach(p => { players[p.id] = p; });
      }
      players[myId] = data.playerState;
      players[myId].name = playerName; // local assign
      ws.send(JSON.stringify({ type: 'sync', state: players[myId] })); // Send immediately
      logEvent('User Auth', `Assigned ID ${players[myId].name}. Stored in PostgreSQL.`);
      break;
    case 'updatePlayer':
      if (data.player.id !== myId) {
        players[data.player.id] = data.player;
      }
      break;
    case 'shoot':
      // Spawn bullet from server event
      bullets.push({
        x: data.x, y: data.y,
        vx: Math.cos(data.angle) * 15,
        vy: Math.sin(data.angle) * 15,
        owner: data.player,
        life: 100
      });
      const shooterName = players[data.player] ? (players[data.player].name || data.player) : data.player;
      if (data.player !== myId) logEvent('Action', `${shooterName} fired a shot (Kafka Event)`);
      break;
    case 'playerLeft':
      delete players[data.player];
      logEvent('Network', `${data.player} disconnected`);
      break;
    case 'playerDied':
      if (players[data.player]) players[data.player].isDead = true;
      const victimName = players[data.player] ? (players[data.player].name || data.player) : data.player;
      logEvent('Combat', `💀 ${victimName} died! Logged to PostgreSQL & MySQL`);
      break;
    case 'scored':
      if (data.player === myId) {
        myScore++;
        document.getElementById('ui-score').innerText = myScore;
      }
      if (players[data.player]) players[data.player].score++;
      break;
  }
};

function logEvent(category, text) {
  const list = document.getElementById('feed-list');
  const li = document.createElement('li');
  // Safe simple injection, not prone to script errors here
  li.innerHTML = `<span>[${category}]</span> ${text.replace(/</g, "&lt;")}`;
  list.prepend(li);
  if (list.children.length > 6) list.lastChild.remove();
}

// Game Loop
let lastShootTime = 0;

function update() {
  if (!myId) return;

  const speed = 5;
  let moved = false;
  const p = players[myId];
  if (!p) return;

  if (!isDead) { // We only allow movement if NOT dead
    if (keys.w || keys.arrowup) { p.y -= speed; moved = true; }
    if (keys.s || keys.arrowdown) { p.y += speed; moved = true; }
    if (keys.a || keys.arrowleft) { p.x -= speed; moved = true; }
    if (keys.d || keys.arrowright) { p.x += speed; moved = true; }
  }

  // Sync to server via explicitly syncing the robust state
  if (moved) ws.send(JSON.stringify({ type: 'sync', state: p }));

  // Shooting
  if (!isDead && mouse.clicked && Date.now() - lastShootTime > 200) {
    const angle = Math.atan2(mouse.y - p.y, mouse.x - p.x);
    ws.send(JSON.stringify({ type: 'shoot', angle }));
    lastShootTime = Date.now();
    mouse.clicked = false;
  }
}

function draw() {
  // Clear trace
  ctx.fillStyle = 'rgba(11, 13, 18, 0.3)';
  ctx.fillRect(0, 0, canvas.width, canvas.height);

  // Draw Grid
  ctx.strokeStyle = '#1e2430';
  ctx.lineWidth = 1;
  for(let x=0; x<canvas.width; x+=50) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,canvas.height); ctx.stroke(); }
  for(let y=0; y<canvas.height; y+=50) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(canvas.width,y); ctx.stroke(); }

  // Update & Draw Bullets
  for (let i = bullets.length - 1; i >= 0; i--) {
    let b = bullets[i];
    b.x += b.vx;
    b.y += b.vy;
    b.life--;

    // Collision detection with MY player
    if (!isDead && b.owner !== myId) {
      const p = players[myId];
      if (p) {
        const dx = b.x - p.x;
        const dy = b.y - p.y;
        if (Math.sqrt(dx*dx + dy*dy) < 20) {
          die(b.owner);
        }
      }
    }

    if (b.life <= 0 || b.x < 0 || b.y < 0 || b.x > canvas.width || b.y > canvas.height) {
      bullets.splice(i, 1);
      continue;
    }

    ctx.fillStyle = b.owner === myId ? '#ff3366' : '#00e676';
    ctx.beginPath();
    ctx.arc(b.x, b.y, 4, 0, Math.PI * 2);
    ctx.fill();
    // Glowing trail
    ctx.shadowBlur = 10;
    ctx.shadowColor = ctx.fillStyle;
    ctx.fill();
    ctx.shadowBlur = 0;
  }

  // Draw Players
  Object.values(players).forEach(p => {
    if (p.isDead) return;
    
    // Player body
    ctx.fillStyle = p.id === myId ? '#7b2cbf' : '#3d5afe';
    ctx.beginPath();
    ctx.arc(p.x, p.y, 15, 0, Math.PI * 2);
    ctx.fill();
    
    // Outline glow
    ctx.strokeStyle = '#ffffff';
    ctx.lineWidth = 2;
    ctx.stroke();

    // ID Tag
    ctx.fillStyle = '#fff';
    ctx.font = '12px Inter';
    ctx.textAlign = 'center';
    ctx.fillText(p.name || p.id, p.x, p.y - 25);
  });
}

function die(killerId) {
  if (isDead) return;
  isDead = true;
  if(players[myId]) players[myId].isDead = true;
  ws.send(JSON.stringify({ type: 'die', killer: killerId }));
  ws.send(JSON.stringify({ type: 'sync', state: players[myId] })); // Force sync death
  
  document.getElementById('respawn-screen').classList.remove('hidden');
  
  let timer = 3;
  const countdown = setInterval(() => {
    timer--;
    document.getElementById('respawn-timer').innerText = timer;
    if (timer <= 0) {
      clearInterval(countdown);
      isDead = false;
      document.getElementById('respawn-screen').classList.add('hidden');
      if(players[myId]) {
         players[myId].x = Math.floor(Math.random() * 600) + 100;
         players[myId].y = Math.floor(Math.random() * 400) + 100;
         players[myId].isDead = false;
         ws.send(JSON.stringify({ type: 'sync', state: players[myId] })); // Force sync life
      }
    }
  }, 1000);
}

function loop() {
  update();
  draw();
  requestAnimationFrame(loop);
}
requestAnimationFrame(loop);
