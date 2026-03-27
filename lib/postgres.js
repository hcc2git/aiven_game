const { Pool } = require('pg');

const connectionString = process.env.DATABASE_URL;
const pool = new Pool({
  connectionString: connectionString || 'postgresql://mock:mock@localhost:5432/mock',
  ssl: connectionString && connectionString.includes('sslmode=require') ? { rejectUnauthorized: false } : undefined
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
  }
};
