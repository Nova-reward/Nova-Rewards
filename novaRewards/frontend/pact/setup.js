const { PactV4 } = require('@pact-foundation/pact');
const path = require('path');

const provider = new PactV4({
  consumer: 'nova-rewards-frontend',
  provider: 'nova-rewards-backend',
  dir: path.resolve(__dirname, '../pacts'),
  logLevel: 'warn',
});

module.exports = { provider };
