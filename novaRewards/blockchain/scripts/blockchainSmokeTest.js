const assert = require('node:assert');

process.env.ISSUER_PUBLIC = process.env.ISSUER_PUBLIC || 'GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAWHF';

const service = require('../stellarService');

assert(service && typeof service.isValidStellarAddress === 'function', 'Blockchain service should export a valid address helper');

console.log('Blockchain smoke test passed');
