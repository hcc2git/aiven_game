const mysql = require('mysql2/promise');

const host = process.env.MYSQL_HOST;

let pool;
if (host || process.env.MYSQL_URI) {
   pool = mysql.createPool({
     uri: process.env.MYSQL_URI || undefined,
     host: host || undefined,
     user: process.env.MYSQL_USER,
     password: process.env.MYSQL_PASSWORD,
     database: process.env.MYSQL_DATABASE || 'defaultdb',
     port: process.env.MYSQL_PORT || 3306, // Aiven MySQL port is usually custom
     ssl: { rejectUnauthorized: false }
   });
} else {
   console.warn('MySQL not configured. Using local mock storage.');
}

const isMock = !pool;

module.exports = {
  async initTable() {
    if (isMock) return;
    try {
      await pool.query(`
        CREATE TABLE IF NOT EXISTS global_highscores (
          player_id VARCHAR(50) PRIMARY KEY,
          top_score INT DEFAULT 0,
          achieved_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
        )
      `);
    } catch(e) { console.error('MySQL Init Error:', e); }
  },
  async saveHighscore(playerId, score) {
    if (isMock) return;
    try {
      await pool.query(`
        INSERT INTO global_highscores (player_id, top_score)
        VALUES (?, ?)
        ON DUPLICATE KEY UPDATE top_score = GREATEST(top_score, ?)
      `, [playerId, score, score]);
    } catch(e) {}
  }
}
