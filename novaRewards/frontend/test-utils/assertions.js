import assert from 'assert';

export function assertEqual(actual, expected, message) {
  assert.strictEqual(actual, expected, message);
}

export function assertNotEqual(actual, expected, message) {
  assert.notStrictEqual(actual, expected, message);
}

export function assertDeepEqual(actual, expected, message) {
  assert.deepStrictEqual(actual, expected, message);
}

export function assertContains(container, value, message) {
  if (!String(container).includes(String(value))) {
    throw new Error(message || `Expected ${container} to contain ${value}`);
  }
}

export function assertThrows(fn, expectedMessage, message) {
  try {
    fn();
  } catch (error) {
    if (expectedMessage && !String(error.message).includes(expectedMessage)) {
      throw new Error(message || `Expected error message to include '${expectedMessage}', got '${error.message}'`);
    }
    return;
  }
  throw new Error(message || 'Expected function to throw');
}

export async function assertThrowsAsync(asyncFn, expectedMessage, message) {
  let error;
  try {
    await asyncFn();
  } catch (err) {
    error = err;
  }
  if (!error) {
    throw new Error(message || 'Expected async function to reject');
  }
  if (expectedMessage && !String(error.message).includes(expectedMessage)) {
    throw new Error(message || `Expected rejection message to include '${expectedMessage}', got '${error.message}'`);
  }
}
