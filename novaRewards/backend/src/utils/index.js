const math = require('./math');
const string = require('./string');
const array = require('./array');
const time = require('./time');
const validation = require('./validation');
const conversion = require('./conversion');

module.exports = { ...math, ...string, ...array, ...time, ...validation, ...conversion };
