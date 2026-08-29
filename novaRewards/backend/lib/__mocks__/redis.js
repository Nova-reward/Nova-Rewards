import { vi } from 'vitest';
export const client = { isOpen: true, get: vi.fn(), set: vi.fn(), del: vi.fn() };
export const connectRedis = vi.fn();
