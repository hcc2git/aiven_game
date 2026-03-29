const { Client } = require('@opensearch-project/opensearch');
const { getAivenTlsOptions } = require('./ssl');

const opensearchUrl = process.env.OPENSEARCH_URL || process.env.OPENSEARCH_URI;
const username = process.env.OPENSEARCH_USERNAME || process.env.OPENSEARCH_USER;
const password = process.env.OPENSEARCH_PASSWORD || process.env.OPENSEARCH_PASS;
const indexName = process.env.OPENSEARCH_INDEX || 'game-events';

let client = null;
if (opensearchUrl && username && password) {
  client = new Client({
    node: opensearchUrl,
    auth: { username, password },
    ssl: {
      rejectUnauthorized: false
    }
  });
} else {
  console.warn('OpenSearch not configured. Using mock event index.');
}

module.exports = {
  async initIndex() {
    if (!client) return;
    try {
      await client.indices.create({ index: indexName });
    } catch (e) {
      if (!e?.body?.error?.type?.includes('resource_already_exists_exception')) {
        console.error('OpenSearch init error:', e);
      }
    }
  },

  async indexEvent(eventType, payload = {}) {
    if (!client) return;
    try {
      await client.index({
        index: indexName,
        body: {
          eventType,
          category: eventType.split('.')[0] || 'game',
          playerId: payload.playerId || null,
          playerName: payload.playerState?.name || payload.playerName || null,
          sessionId: payload.playerId || null,
          source: 'aiven-game-server',
          payload,
          timestamp: new Date().toISOString()
        },
        refresh: true
      });
    } catch (e) {
      console.error('OpenSearch index error:', e);
    }
  },

  async searchEvents(limit = 20) {
    if (!client) return [];
    try {
      const result = await client.search({
        index: indexName,
        body: {
          size: limit,
          sort: [{ timestamp: { order: 'desc' }}],
          query: { match_all: {} }
        }
      });
      const hits = result?.body?.hits?.hits;
      if (!hits) {
        console.error('OpenSearch search error: invalid response', result);
        return [];
      }
      return hits.map(hit => hit._source);
    } catch (e) {
      console.error('OpenSearch search error:', e);
      return [];
    }
  }
};
