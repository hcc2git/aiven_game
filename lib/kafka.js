const Kafka = require("node-rdkafka");
const path = require('path');
const fs = require('fs');

const TOPIC_NAME = "aiven-game";

// Helper for absolute paths to your /cert folder
function getCertPath(fileName) {
  const fullPath = path.resolve(__dirname, '../cert', fileName);
  if (!fs.existsSync(fullPath)) {
    console.error(`❌ Kafka Cert Missing: ${fullPath}`);
  }
  return fullPath;
}

// Global SSL settings shared by both
const baseConfig = {
  'metadata.broker.list': "kafka-27188368-heikki-9c61.b.aivencloud.com:19490",
  "security.protocol": "ssl",
  "ssl.key.location": getCertPath("kafka_service.key"),
  "ssl.certificate.location": getCertPath("kafka_service.cert"),
  "ssl.ca.location": getCertPath("aiven-ca.pem"),
};

// --- PRODUCER (Sends data) ---
// Only the Producer gets 'dr_cb'
const producer = new Kafka.Producer({
  ...baseConfig,
  'dr_cb': true
});

producer.on('event.error', (err) => console.error('Kafka Producer Error:', err));
producer.connect();

function publishEvent(eventType, data) {
  if (!producer.isConnected()) return;
  const message = JSON.stringify({ eventType, ...data, time: Date.now() });
  try {
    producer.produce(TOPIC_NAME, null, Buffer.from(message), null, Date.now());
  } catch (e) {
    console.error("Kafka Publish Failed", e);
  }
}

// --- CONSUMER (Receives data for UI) ---
function initConsumer(onMessage) {
  const stream = new Kafka.createReadStream(
    {
      ...baseConfig, // Notice: No 'dr_cb' here!
      "group.id": "game-ui-group-" + Math.random().toString(36).substring(7)
    },
    { "auto.offset.reset": "latest" },
    { topics: [TOPIC_NAME] }
  );

  stream.on("data", (msg) => {
    try {
      onMessage(JSON.parse(msg.value.toString()));
    } catch (e) {
      onMessage({ eventType: 'RawMessage', content: msg.value.toString() });
    }
  });

  stream.on('error', (err) => console.error('Kafka Consumer Stream Error:', err));
}

module.exports = { publishEvent, initConsumer };