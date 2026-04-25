import { vi } from 'vitest';

export function createSpy(impl) {
  const fn = vi.fn();
  if (impl) fn.mockImplementation(impl);
  return fn;
}

export function spyOn(object, methodName) {
  return vi.spyOn(object, methodName);
}

// CommonJS interop
module.exports = { createSpy, spyOn };
