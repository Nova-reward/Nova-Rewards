const assert = require('assert');

function assertEqual(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
}

function assertNotEqual(actual, expected, message) {
  assert.notStrictEqual(actual, expected, message);
}

function assertDeepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
}

function assertMatches(received, regex, message) {
  assert.match(received, regex, message);
}

function assertThrows(fn, expectedMessage, message) {
  const expected = expectedMessage ? { message: expectedMessage } : undefined;
  assert.throws(fn, expected, message);
}

async function assertRejects(promiseFactory, expectedMessage, message) {
  const promise = typeof promiseFactory === 'function' ? promiseFactory() : promiseFactory;
  const expected = expectedMessage ? { message: expectedMessage } : undefined;
  await assert.rejects(promise, expected, message);
}

module.exports = {
  assertEqual,
  assertNotEqual,
  assertDeepEqual,
  assertMatches,
  assertThrows,
  assertRejects,
};
