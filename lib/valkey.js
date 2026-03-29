const Redis = require('ioredis');
const { getAivenTlsOptions } = require('./ssl');

const valkeyUrl = process.env.VALKEY_URL || '';
const redis = valkeyUrl ? new Redis(valkeyUrl, {
  tls: valkeyUrl.startsWith('rediss://') ? getAivenTlsOptions() : undefined
}) : null;

if (!redis) {
  console.warn('Valkey not configured. Using local memory mock cache.');
}

const mockCache = new Map();

module.exports = {
  async setPlayer(id, data) {
    if (redis) {
      await redis.hset('players', id, JSON.stringify(data));
    } else {
      mockCache.set(id, data);
    }
  },
  async removePlayer(id) {
    if (redis) {
      await redis.hdel('players', id);
    } else {
      mockCache.delete(id);
    }
  },
  async getPlayers() {
    if (redis) {
      const all = await redis.hgetall('players');
      // Redis hgetall returns an object, we need an array of parsed objects
      return Object.values(all).map(JSON.parse);
    } else {
      return Array.from(mockCache.values());
    }
  }
};
