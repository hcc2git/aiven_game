const mysql = require('mysql2/promise');
const { getAivenTlsOptions } = require('./ssl');
const { URL } = require('url');

const mysqlSsl = getAivenTlsOptions();

function buildMysqlConfigFromUri(uri) {
  try {
    const parsed = new URL(uri);
    const config = {
      host: parsed.hostname,
      port: parsed.port ? Number(parsed.port) : 3306,
      user: decodeURIComponent(parsed.username),
      password: decodeURIComponent(parsed.password),
      database: parsed.pathname ? parsed.pathname.slice(1) : undefined,
      ssl: mysqlSsl
    };

    parsed.searchParams.forEach((value, key) => {
      if (['ssl-mode', 'sslmode', 'ssl'].includes(key)) return;
      config[key] = value;
    });

    return config;
  } catch (err) {
    console.error('MySQL URI parse error:', err.message);
    return null;
  }
}

const host = process.env.MYSQL_HOST;
const mysqlUri = process.env.MYSQL_URI;
let pool;

if (mysqlUri) {
  const mysqlConfig = buildMysqlConfigFromUri(mysqlUri);
  if (mysqlConfig) {
    pool = mysql.createPool(mysqlConfig);
  }
} else if (host) {
  pool = mysql.createPool({
    host,
    user: process.env.MYSQL_USER,
    password: process.env.MYSQL_PASSWORD,
    database: process.env.MYSQL_DATABASE || 'defaultdb',
    port: process.env.MYSQL_PORT ? Number(process.env.MYSQL_PORT) : 3306,
    ssl: mysqlSsl
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
