const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');

// Aiven services integrations
const valkey = require('./lib/valkey');
const kafka = require('./lib/kafka');
const pg = require('./lib/postgres');
const mysql = require('./lib/mysql');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// Main WebSocket Game Loop
wss.on('connection', async (ws) => {
  const playerId = 'player_' + Math.random().toString(36).substring(2, 9);
  // Default starting position
  let playerState = { 
    id: playerId, 
    name: 'Player',
    x: Math.floor(Math.random() * 600) + 100, 
    y: Math.floor(Math.random() * 400) + 100, 
    isDead: false, 
    score: 0 
  };
  
  ws.playerId = playerId;
  ws.playerState = playerState;
  
  await valkey.setPlayer(playerId, playerState);
  const allPlayers = await valkey.getPlayers();
  
  // Send the player their ID and all existing players
  ws.send(JSON.stringify({ type: 'init', playerState, allPlayers }));
  broadcast({ type: 'updatePlayer', player: playerState });
  
  // Announce join via Kafka
  kafka.publishEvent('PlayerJoined', { playerId });

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);
      
      switch (data.type) {
        case 'sync':
          // The client is the source of truth for its own coordinates and name
          playerState = { ...playerState, ...data.state, id: playerId }; // Protect ID
          await valkey.setPlayer(playerId, playerState);
          broadcast({ type: 'updatePlayer', player: playerState });
          break;
        case 'move':
          playerState.x = data.x;
          playerState.y = data.y;
          await valkey.setPlayer(playerId, playerState);
          broadcast({ type: 'updatePlayer', player: playerState });
          break;
        case 'shoot':
          broadcast({ 
            type: 'shoot', 
            player: playerId, 
            x: playerState.x, 
            y: playerState.y, 
            angle: data.angle 
          });
          kafka.publishEvent('PlayerShot', { playerId });
          break;
        case 'die':
          if (!playerState.isDead) { // Ensures we only announce it once per death
             playerState.isDead = true;
             await pg.incrementDeaths(playerId);
             
             if (data.killer) {
               wss.clients.forEach(client => {
                 if (client.playerId === data.killer && client.playerState) {
                   client.playerState.score++;
                 }
               });
               broadcast({ type: 'scored', player: data.killer });
               await pg.incrementScore(data.killer);
             }
             
             kafka.publishEvent('PlayerDied', { playerId, killer: data.killer });
             broadcast({ type: 'playerDied', player: playerId });
          }
          break;
      }
    } catch (e) {
      console.error(e);
    }
  });

  ws.on('close', async () => {
    await valkey.removePlayer(playerId);
    kafka.publishEvent('PlayerLeft', { playerId });
    broadcast({ type: 'playerLeft', player: playerId });
    
    // Periodically sync top score to MySQL Highscores
    if (playerState.score > 0) {
       await mysql.saveHighscore(playerId, playerState.score);
    }
  });
});

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1) { // WebSocket.OPEN
      client.send(payload);
    }
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`Aiven Game Server running on port ${PORT}`);
  await pg.initTable();
  await mysql.initTable();
});
