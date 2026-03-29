const client = require('prom-client');
const register = new client.Registry();
client.collectDefaultMetrics({ register });

const counters = {
  joins: new client.Counter({
    name: 'game_server_player_joins_total',
    help: 'Total number of players who have joined the game',
    registers: [register]
  }),
  moves: new client.Counter({
    name: 'game_server_player_moves_total',
    help: 'Total movement events processed by the game server',
    registers: [register]
  }),
  shoots: new client.Counter({
    name: 'game_server_player_shoots_total',
    help: 'Total shoot actions processed by the game server',
    registers: [register]
  }),
  deaths: new client.Counter({
    name: 'game_server_player_deaths_total',
    help: 'Total death events recorded by the game server',
    registers: [register]
  }),
  leaves: new client.Counter({
    name: 'game_server_player_leaves_total',
    help: 'Total number of players who have disconnected from the game',
    registers: [register]
  })
};

module.exports = {
  register,
  async getMetrics() {
    return await register.metrics();
  },
  incrementJoin() {
    counters.joins.inc();
  },
  incrementMove() {
    counters.moves.inc();
  },
  incrementShoot() {
    counters.shoots.inc();
  },
  incrementDeath() {
    counters.deaths.inc();
  },
  incrementLeave() {
    counters.leaves.inc();
  }
};
