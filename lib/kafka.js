const { Kafka } = require('kafkajs');

const broker = process.env.KAFKA_BROKER;
const username = process.env.KAFKA_USERNAME;
const password = process.env.KAFKA_PASSWORD;

let producer = null;

if (broker && username && password) {
  const kafka = new Kafka({
    clientId: 'aiven-game-server',
    brokers: [broker],
    ssl: true,
    sasl: { mechanism: 'scram-sha-256', username, password }
  });
  
  producer = kafka.producer();
  producer.connect().catch(console.error);
} else {
  console.warn('Kafka not configured. Using mock event logging.');
}

module.exports = {
  async publishEvent(eventType, payload) {
    const event = { type: eventType, data: payload, timestamp: Date.now() };
    if (producer) {
      try {
        await producer.send({
          topic: 'game-events',
          messages: [{ value: JSON.stringify(event) }]
        });
      } catch (e) {
         console.error('Kafka send error:', e);
      }
    } else {
      // Mock log to console
      // console.log('[Mock Kafka Event]', event);
    }
  }
};
