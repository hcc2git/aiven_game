process.env.NODE_TLS_REJECT_UNAUTHORIZED = '0';
require('dotenv').config();
const express = require('express');
const { WebSocketServer } = require('ws');
const http = require('http');
const path = require('path');





const valkey = require('./lib/valkey');
const kafka = require('./lib/kafka');
const pg = require('./lib/postgres');
const mysql = require('./lib/mysql');
const opensearch = require('./lib/opensearch');
const metrics = require('./lib/metrics');

const app = express();
const server = http.createServer(app);
const wss = new WebSocketServer({ server });

app.use(express.static(path.join(__dirname, 'public')));
app.use(express.json());

// --- Statistics & Dashboards ---
// Start the Kafka consumer to broadcast events to the UI feed
kafka.initConsumer((data) => {
  broadcast({
    type: 'kafka-event',
    event: data.eventType || 'Event',
    data: data
  });
});

app.get('/stats', async (req, res) => {
  try {
    const playCount = await pg.getPlayCount();
    const activePlayers = wss.clients.size;
    res.json({ playCount, activePlayers });
  } catch (e) {
    res.status(500).json({ error: 'Stats error' });
  }
});

app.get('/leaderboard', async (req, res) => {
  try {
    const topPlayers = await pg.getTopPlayers(10);
    res.json({ topPlayers });
  } catch (e) {
    res.status(500).json({ error: 'Leaderboard error' });
  }
});


// --- WebSocket Game Loop ---
// Only one consumer is needed to listen to the 'aiven-game' topic
kafka.initConsumer((payload) => {
  console.log("Kafka message received:", payload.eventType); // Good for debugging!
  broadcast({
    type: 'kafka-event',
    event: payload.eventType || 'System',
    data: payload
  });
});
wss.on('connection', async (ws) => {
  const playerId = 'player_' + Math.random().toString(36).substring(2, 9);

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

  const allPlayers = Array.from(wss.clients)
    .filter(c => c.playerState)
    .map(c => c.playerState);

  ws.send(JSON.stringify({ type: 'init', playerState, allPlayers }));
  broadcast({ type: 'updatePlayer', player: playerState });

  // Metrics & Kafka
  kafka.publishEvent('PlayerJoined', { playerId });
  // BROADCAST TO FRONTEND:
  broadcast({ type: 'kafka-event', event: 'PlayerJoined', data: { playerId } });

  await pg.incrementPlayCount();
  metrics.incrementJoin();

  ws.on('message', async (message) => {
    try {
      const data = JSON.parse(message);

      switch (data.type) {
        case 'sync':
          if (playerState.isDead) return;
          playerState.x = data.state.x;
          playerState.y = data.state.y;
          playerState.name = data.state.name || playerState.name;

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
          metrics.incrementShoot();
          break;

        case 'die':
          if (!playerState.isDead) {
            playerState.isDead = true;
            const deathX = playerState.x;
            const deathY = playerState.y;

            playerState.x = 0;
            playerState.y = 0;

            await pg.incrementDeaths(playerId);

            if (data.killer) {
              wss.clients.forEach(client => {
                if (client.playerId === data.killer && client.playerState) {
                  client.playerState.score++;
                  client.send(JSON.stringify({ type: 'updatePlayer', player: client.playerState }));
                }
              });
              await pg.incrementScore(data.killer);
              broadcast({ type: 'scored', player: data.killer });
            }

            broadcast({
              type: 'playerDied',
              player: playerId,
              killer: data.killer,
              x: deathX,
              y: deathY
            });

            kafka.publishEvent('PlayerDied', { playerId, killer: data.killer });
            // BROADCAST TO FRONTEND:
            broadcast({ type: 'kafka-event', event: 'PlayerDied', data: { playerId, killer: data.killer } });

            metrics.incrementDeath();

            setTimeout(async () => {
              playerState.isDead = false;
              playerState.x = Math.floor(Math.random() * 600) + 100;
              playerState.y = Math.floor(Math.random() * 400) + 100;
              await valkey.setPlayer(playerId, playerState);
              broadcast({ type: 'updatePlayer', player: playerState });
            }, 3000);
          }
          break;
      }
    } catch (e) {
      console.error('Server Logic Error:', e);
    }
  });

  ws.on('close', async () => {
    await valkey.removePlayer(playerId);
    broadcast({ type: 'playerLeft', player: playerId });
    metrics.incrementLeave();
  });
});

function broadcast(msg) {
  const payload = JSON.stringify(msg);
  wss.clients.forEach(client => {
    if (client.readyState === 1) client.send(payload);
  });
}

const PORT = process.env.PORT || 3001;
server.listen(PORT, async () => {
  console.log(`Valkey Game Server running on port ${PORT}`);
  await pg.initTable();
  await mysql.initTable();
});
