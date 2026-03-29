# Aiven Game Server Architecture

## System overview

The `aiven-game-server` project is a browser-based multiplayer game built as a single Node.js server with WebSocket-driven gameplay and multiple Aiven service integrations.

### Core components

- `public/` — browser client
  - `index.html` renders the game canvas and event feed.
  - `game.js` manages input, rendering, WebSocket connection, and game state.

- `server.js` — Node.js backend
  - Hosts static assets.
  - Accepts WebSocket connections for live multiplayer state.
  - Routes game events to Aiven data services.

- `lib/` — service adapters
  - `valkey.js` — Redis/Valkey-style player session storage
  - `kafka.js` — event publishing to Kafka
  - `postgres.js` — player stats persistence in PostgreSQL
  - `mysql.js` — highscore persistence in MySQL
  - `opensearch.js` — event indexing and search in OpenSearch
  - `metrics.js` — Prometheus metrics collection

## Data flow

1. Browser user connects to the server via WebSocket.
2. Server assigns a unique player ID and stores player state in Redis.
3. Client sends movement, shoot, and death events.
4. Server broadcasts player updates to connected clients.
5. Server persists events to Aiven services:
   - Kafka publishes event stream messages
   - PostgreSQL updates player stats
   - MySQL saves top highscores
   - OpenSearch indexes activity for search and analytics
   - Prometheus counters expose server metrics

## Aiven product responsibilities

- **Aiven Redis / Valkey**
  - active in-memory player state
  - fast read/write for location / alive state

- **Aiven Kafka**
  - async event stream for joins, shots, deaths, and disconnects
  - useful for analytics, alerts, or event-driven pipelines

- **Aiven PostgreSQL**
  - authoritative player stats: score, kills, deaths
  - serves leaderboard queries

- **Aiven MySQL**
  - persistent global highscores
  - durable and independent backfill storage for score history

- **Aiven OpenSearch**
  - event search and audit log storage
  - supports dashboarding and event replay

- **Grafana / Prometheus**
  - metrics exposure via `/metrics`
  - used for server health, event volume, and player activity dashboards

## Key service endpoints

- `GET /metrics` — Prometheus metrics scrape target
- `GET /leaderboard` — top PostgreSQL player stats
- `GET /events` — recent OpenSearch events

## Deployment recommendations

- Run the Node server behind a TLS-enabled proxy if deploying to production.
- Provide environment variables for each Aiven service and secure credentials.
- Use Grafana to visualize `/metrics` and OpenSearch dashboards for game events.

### Prometheus / Grafana setup

- Add the server's `/metrics` endpoint as a Prometheus scrape target.
- Build Grafana panels for the Prometheus counters exported by `metrics.js`.
- Use OpenSearch to visualize event streams and player activity in dashboards.
- A sample Grafana dashboard is provided in `grafana-game-dashboard.json`.

### Recommended environment settings

```bash
VALKEY_URL=rediss://... 
KAFKA_BROKER=... 
KAFKA_USERNAME=... 
KAFKA_PASSWORD=... 
DATABASE_URL=... 
MYSQL_URI=... 
OPENSEARCH_URL=... 
OPENSEARCH_USERNAME=... 
OPENSEARCH_PASSWORD=... 
```
