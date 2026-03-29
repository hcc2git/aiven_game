# Aiven Run & Shoot — Game Instructions

## Objective

Survive longer than other players and earn points by shooting opponents. Each kill increments your score, and the game records kills, deaths, and high scores using Aiven services.

## Controls

- Move: `W`, `A`, `S`, `D` or arrow keys
- Aim: move the mouse
- Shoot: click the mouse button

## Gameplay

- When you connect, the server assigns a unique player ID and shares all active players.
- Your browser sends position updates to the server whenever you move.
- Shooting creates a bullet that travels in the aimed direction.
- If a bullet hits another player, that player dies and must respawn.
- Respawn happens automatically after a brief countdown.

## Scoring

- You earn a point when another player dies because of your shot.
- Your current score is displayed in the top bar.
- The server synchronizes score updates in real time.

## Death and respawn

- When you die, your character becomes inactive.
- The respawn screen appears with a countdown.
- After the countdown, you respawn at a random location.
- Deaths are recorded in PostgreSQL and highscore updates are stored in MySQL.

## Event feed

The right-side feed displays gameplay events and system messages such as:

- connection status
- shots fired
- player deaths
- Kafka event activity

## Aiven integrations used in gameplay

- **Redis / Valkey** — keeps live player positions and connection state.
- **Kafka** — publishes game events like `PlayerJoined`, `PlayerShot`, and `PlayerDied`.
- **PostgreSQL** — stores player stats and leaderboard values.
- **MySQL** — saves persistent highscore records.
- **OpenSearch** — indexes game events for search and analytics.
- **Prometheus** — exposes server metrics for dashboards.

## Using the analytics panels

- The leaderboard panel fetches `/leaderboard` periodically.
- The event panel fetches `/events` from OpenSearch.
- These panels show live game metrics and help validate that Aiven services are receiving activity.

## Developer notes

- The server is in `server.js`.
- Game logic and rendering are in `public/game.js`.
- The lobby landing page is `public/index.html` and the game client is `public/game.html`.
- Add new Aiven integrations under `lib/` with a simple adapter pattern.
- Use `/stats`, `/leaderboard`, and `/events` endpoints to verify live data.

## Troubleshooting

- If you are not connected, check `ws:` / `wss:` in the browser console.
- If the leaderboard does not return data, verify `DATABASE_URL`.
- If the metrics endpoint is unreachable, ensure `prom-client` is installed and the server is running.
