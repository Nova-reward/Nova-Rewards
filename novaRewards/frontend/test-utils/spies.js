export function createSpy() {
  if (typeof jest !== 'undefined') {
    return jest.fn();
  }

  const calls = [];
  const spy = function (...args) {
    calls.push(args);
    if (spy.__impl) {
      return spy.__impl(...args);
    }
  };

  spy.calls = calls;
  spy.mockImplementation = (impl) => {
    spy.__impl = impl;
    return spy;
  };
  spy.reset = () => {
    calls.length = 0;
    return spy;
  };
  spy.restore = () => {};

  return spy;
}

export function spyOn(object, methodName) {
  if (typeof jest !== 'undefined') {
    return jest.spyOn(object, methodName);
  }

  const original = object[methodName];
  const spy = createSpy();
  object[methodName] = function (...args) {
    spy(...args);
    return original.apply(this, args);
  };
  spy.restore = () => {
    object[methodName] = original;
  };
  return spy;
}
