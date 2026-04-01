const knex = require("../../lib/db"); // Adjust path to your knex instance

/**
 * Test DB Helpers: Truncate, migrate fixtures
 */

const truncateTables = async () => {
  const tables = [
    "transactions",
    "campaigns",
    "users",
    "merchants",
    "point_transactions",
  ]; // Add as needed
  await knex.raw("TRUNCATE ?? RESTART IDENTITY CASCADE", [tables]);
};

const loadFixtures = async () => {
  // Optional: seed basic data
  // await knex('merchants').insert({ id: 1, name: 'Test Merchant', api_key: 'test-key' });
};

module.exports = {
  truncateTables,
  loadFixtures,
};
