const { createClient, createCluster } = require('redis');

const REDIS_URL    = process.env.REDIS_URL    || 'redis://localhost:6379';
const REDIS_MODE   = process.env.REDIS_MODE   || 'single'; // 'single' | 'cluster' | 'sentinel'
const SENTINEL_NAME = process.env.REDIS_SENTINEL_NAME || 'mymaster';

function buildClient() {
  if (REDIS_MODE === 'cluster') {
    // REDIS_CLUSTER_NODES = "host1:6379,host2:6379,host3:6379"
    const nodes = (process.env.REDIS_CLUSTER_NODES || REDIS_URL.replace('redis://', ''))
      .split(',')
      .map(n => {
        const [host, port] = n.trim().split(':');
        return { host, port: Number(port) || 6379 };
      });
    return createCluster({ rootNodes: nodes });
  }

  if (REDIS_MODE === 'sentinel') {
    // REDIS_SENTINEL_NODES = "host1:26379,host2:26379"
    const sentinels = (process.env.REDIS_SENTINEL_NODES || 'localhost:26379')
      .split(',')
      .map(n => {
        const [host, port] = n.trim().split(':');
        return { host, port: Number(port) || 26379 };
      });
    return createClient({
      sentinel: { sentinels, name: SENTINEL_NAME },
    });
  }

  // Default: single node
  return createClient({ url: REDIS_URL });
}

const client = buildClient();

client.on('error', (err) => console.error('[Redis]', err));
client.on('ready', () => console.log(`[Redis] Connected (mode: ${REDIS_MODE})`));

async function connectRedis() {
  if (!client.isOpen) await client.connect();
}

module.exports = { client, connectRedis };
