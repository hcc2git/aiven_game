const { Pool } = require('pg');
const { getAivenTlsOptions } = require('./ssl');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString || 'postgresql://mock:mock@localhost:5432/mock',
  ssl: {
    rejectUnauthorized: false
  }
});

const isMock = !connectionString;

module.exports = {
  async initTable() {
    if (isMock) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS player_stats (
          id VARCHAR(50) PRIMARY KEY,
          kills INT DEFAULT 0,
          deaths INT DEFAULT 0,
          score INT DEFAULT 0
        )
      `);
      await pool.query(`
        CREATE TABLE IF NOT EXISTS game_metrics (
          metric_name VARCHAR(50) PRIMARY KEY,
          metric_value BIGINT DEFAULT 0
        )
      `);
      await pool.query(`
        INSERT INTO game_metrics (metric_name, metric_value)
        VALUES ('play_count', 0)
        ON CONFLICT (metric_name) DO NOTHING
      `);
    } catch(e) { console.error('PG Init Error:', e); }
  },
  async incrementScore(playerId) {
    if (isMock) return;
    try {
      await pool.query(`
        INSERT INTO player_stats (id, score) VALUES ($1, 1)
        ON CONFLICT (id) DO UPDATE SET score = player_stats.score + 1
      `, [playerId]);
    } catch(e) {}
  },
  async incrementDeaths(playerId) {
    if (isMock) return;
    try {
      await pool.query(`
        INSERT INTO player_stats (id, deaths) VALUES ($1, 1)
        ON CONFLICT (id) DO UPDATE SET deaths = player_stats.deaths + 1
      `, [playerId]);
    } catch(e) {}
  },
  async incrementPlayCount() {
    if (isMock) return;
    try {
      await pool.query(`
        INSERT INTO game_metrics (metric_name, metric_value)
        VALUES ('play_count', 1)
        ON CONFLICT (metric_name) DO UPDATE SET metric_value = game_metrics.metric_value + 1
      `);
    } catch (e) { console.error('PG Metric Error:', e); }
  },
  async getPlayCount() {
    if (isMock) return 0;
    try {
      const result = await pool.query(`
        SELECT metric_value FROM game_metrics WHERE metric_name = 'play_count'
      `);
      return result.rows[0]?.metric_value || 0;
    } catch (e) {
      console.error('PG Metric Query Error:', e);
      return 0;
    }
  },
  async getTopPlayers(limit = 10) {
    if (isMock) return [];
    try {
      const result = await pool.query(`
        SELECT id, kills, deaths, score
        FROM player_stats
        ORDER BY score DESC, kills DESC
        LIMIT $1
      `, [limit]);
      return result.rows;
    } catch(e) {
      console.error('PG Query Error:', e);
      return [];
    }
  }
};
