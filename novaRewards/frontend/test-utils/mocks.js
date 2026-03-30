import { createSpy } from './spies';

export function createMockFunction(impl) {
  const fn = createSpy();
  if (impl) {
    fn.mockImplementation(impl);
  }
  return fn;
}

export function createMockModule(shape) {
  const mock = {};
  Object.keys(shape).forEach((key) => {
    const value = shape[key];
    mock[key] = typeof value === 'function' ? createMockFunction(value) : value;
  });
  return mock;
}

export function createFetchResponse(body = {}, status = 200, headers = { 'Content-Type': 'application/json' }) {
  return {
    ok: status >= 200 && status < 300,
    status,
    headers,
    json: async () => body,
    text: async () => JSON.stringify(body),
  };
}

export function mockGlobalFetch(response) {
  const fetchMock = createMockFunction(async () => response);
  if (typeof global !== 'undefined') {
    global.fetch = fetchMock;
  }
  if (typeof window !== 'undefined') {
    window.fetch = fetchMock;
  }
  return fetchMock;
}
