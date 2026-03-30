// Mock knex for tests
const knexStub = {
  destroy: () => Promise.resolve(),
  raw: (sql) => Promise.resolve({ rows: [] }),
};

if (process.env.NODE_ENV !== "test") {
  // Real knex
  const knex = require("knex")(require("../config/db"));
  module.exports = knex;
} else {
  module.exports = knexStub;
}
