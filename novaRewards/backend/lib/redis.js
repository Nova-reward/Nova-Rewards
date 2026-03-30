const { createClient } = require('redis');

const client = createClient({ url: process.env.REDIS_URL });

client.on('error', (err) => console.error('[Redis]', err));

// Connect lazily — server.js calls this once at startup
async function connectRedis() {
  if (!client.isOpen) await client.connect();
}

module.exports = { client, connectRedis };
