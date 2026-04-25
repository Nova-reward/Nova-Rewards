import { vi } from 'vitest';

export function createMockFunction(impl) {
  const fn = vi.fn();
  if (impl) fn.mockImplementation(impl);
  return fn;
}

export function createMockModule(shape) {
  const mock = {};
  for (const [key, value] of Object.entries(shape)) {
    mock[key] = typeof value === 'function' ? createMockFunction(value) : value;
  }
  return mock;
}

export function createRequest({ body = {}, params = {}, query = {}, headers = {} } = {}) {
  return {
    body,
    params,
    query,
    headers,
    get(name) {
      return headers[name.toLowerCase()];
    },
  };
}

export function createResponse() {
  const res = {};
  res.status = vi.fn(() => res);
  res.json = vi.fn(() => res);
  res.send = vi.fn(() => res);
  res.set = vi.fn(() => res);
  return res;
}

// CommonJS interop for tests that still use require()
module.exports = { createMockFunction, createMockModule, createRequest, createResponse };
