# Aiven Game Server

A live multiplayer browser game powered by Aiven-managed services.

## Overview

- `server.js` serves the browser game and WebSocket game loop.
- `public/` contains the player client and HTML frontend.
- `lib/` contains Aiven service adapters for Redis/Valkey, Kafka, PostgreSQL, MySQL, OpenSearch, and Prometheus metrics.

## Run locally

1. Install dependencies:
   ```bash
   npm install
   ```
2. Create a `.env` file in `aiven-game-server/` and add your Aiven connection variables.
3. Start the server:
   ```bash
   npm start
   ```
   The app will automatically load `.env` using `dotenv`.
4. Open `http://localhost:3001` in a browser.

## Environment variables

General:
- `PORT` - port for the server (default: `3001`)

Redis / Valkey:
- `VALKEY_URL` - e.g. `rediss://username:password@hostname:port`

Kafka:
- `KAFKA_BROKER` - broker URI or host
- `KAFKA_USERNAME`
- `KAFKA_PASSWORD`

PostgreSQL:
- `DATABASE_URL` - e.g. `postgresql://user:pass@host:port/dbname?sslmode=require`

MySQL:
- `MYSQL_HOST` or `MYSQL_URI`
- `MYSQL_USER`
- `MYSQL_PASSWORD`
- `MYSQL_DATABASE`
- `MYSQL_PORT`

OpenSearch:
- `OPENSEARCH_URL` or `OPENSEARCH_URI`
- `OPENSEARCH_USERNAME` / `OPENSEARCH_USER`
- `OPENSEARCH_PASSWORD` / `OPENSEARCH_PASS`
- `OPENSEARCH_INDEX`

SSL / Aiven CA:
- `AIVEN_CA_PATH` - path to the downloaded Aiven CA certificate. Defaults to `./aiven-ca.pem` relative to the project root.
- `AIVEN_CA_CERT` - optional raw PEM certificate content if you want to inject the certificate directly from env.
- If your Aiven service uses a publicly trusted certificate chain (for example `*.l.aivencloud.com`), you can omit `AIVEN_CA_PATH` and rely on the system trust store.
- When a custom CA is configured, the helper now merges it with Node’s default trusted roots so public Aiven endpoints still validate correctly.

Prometheus / Grafana:
- No additional server variables are required for Prometheus scraping.
- Use the `/metrics` endpoint as a scrape target in Grafana or Prometheus.

### Example local environment

```bash
PORT=3001
VALKEY_URL=rediss://username:password@redis.example.com:12345
KAFKA_BROKER=b-1.kafka.example.com:9092
KAFKA_USERNAME=gameuser
KAFKA_PASSWORD=supersecret
DATABASE_URL=postgresql://pguser:pgpass@pg.example.com:5432/game?sslmode=require
MYSQL_URI=mysql://mysqluser:mysqlpass@mysql.example.com:3306/game
OPENSEARCH_URL=https://opensearch.example.com:9200
OPENSEARCH_USERNAME=search-user
OPENSEARCH_PASSWORD=searchpass
OPENSEARCH_INDEX=game-events
AIVEN_CA_PATH=./aiven-ca.pem
#AIVEN_CA_CERT="-----BEGIN CERTIFICATE-----..."```

## Useful endpoints

- `/` - landing page for the game
- `/game.html` - actual game client
- `/health` - health check endpoint
- `/health.html` - health dashboard page
- `/stats` - play count and active players
- `/metrics` - Prometheus metrics endpoint
- `/leaderboard` - top player stats from PostgreSQL
- `/events` - recent indexed game events from OpenSearch

## Grafana integration

The dashboard template is available in `grafana-game-dashboard.json`.

1. Configure a Prometheus scrape job for `http://<server-host>:<port>/metrics`.
2. Create dashboards for counters such as:
   - `game_server_player_joins_total`
   - `game_server_player_moves_total`
   - `game_server_player_shoots_total`
   - `game_server_player_deaths_total`
   - `game_server_player_leaves_total`
3. Use OpenSearch dashboards or Kibana-compatible visuals to inspect `game-events` activity.

## Aiven products used

- Aiven Redis / Valkey: real-time player state
- Aiven Kafka: game event stream
- Aiven PostgreSQL: player stats and scoring
- Aiven MySQL: highscore persistence
- Aiven OpenSearch: game event logging and search
- Grafana / Prometheus: metrics scraping and dashboards
