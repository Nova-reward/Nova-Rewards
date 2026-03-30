const { createSpy } = require('./spies');

function createMockFunction(impl) {
  const fn = createSpy();
  if (impl) {
    fn.mockImplementation(impl);
  }
  return fn;
}

function createMockModule(shape) {
  const mock = {};
  Object.keys(shape).forEach((key) => {
    const value = shape[key];
    mock[key] = typeof value === 'function' ? createMockFunction(value) : value;
  });
  return mock;
}

function createRequest({ body = {}, params = {}, query = {}, headers = {} } = {}) {
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

function createResponse() {
  const res = {};
  res.status = jest.fn(() => res);
  res.json = jest.fn(() => res);
  res.send = jest.fn(() => res);
  res.set = jest.fn(() => res);
  return res;
}

module.exports = {
  createMockFunction,
  createMockModule,
  createRequest,
  createResponse,
};
