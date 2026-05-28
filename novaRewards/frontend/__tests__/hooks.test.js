import React from 'react';
import { renderHook, act, waitFor } from '@testing-library/react';

// Single mock for ../lib/api — satisfies both useFetch and AuthProvider
jest.mock('../lib/api', () => ({
  request: jest.fn(),
  interceptors: {
    request: { use: jest.fn(() => 1), eject: jest.fn() },
    response: { use: jest.fn(() => 1), eject: jest.fn() },
  },
  post: jest.fn(),
}));

// ── useDebounce ───────────────────────────────────────────────────────────────
import { useDebounce } from '../hooks/useDebounce';

describe('useDebounce', () => {
  beforeEach(() => jest.useFakeTimers());
  afterEach(() => jest.useRealTimers());

  test('returns initial value immediately', () => {
    const { result } = renderHook(() => useDebounce('hello', 300));
    expect(result.current).toBe('hello');
  });

  test('does not update before delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    act(() => jest.advanceTimersByTime(100));
    expect(result.current).toBe('a');
  });

  test('updates after delay elapses', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    act(() => jest.advanceTimersByTime(300));
    expect(result.current).toBe('b');
  });

  test('resets timer on rapid changes, only settles on last value', () => {
    const { result, rerender } = renderHook(({ v }) => useDebounce(v, 300), {
      initialProps: { v: 'a' },
    });
    rerender({ v: 'b' });
    act(() => jest.advanceTimersByTime(200));
    rerender({ v: 'c' });
    act(() => jest.advanceTimersByTime(200));
    expect(result.current).toBe('a');
    act(() => jest.advanceTimersByTime(100));
    expect(result.current).toBe('c');
  });
});

// ── useLocalStorage ───────────────────────────────────────────────────────────
import { useLocalStorage } from '../hooks/useLocalStorage';

describe('useLocalStorage', () => {
  beforeEach(() => localStorage.clear());

  test('returns initialValue when key is absent', () => {
    const { result } = renderHook(() => useLocalStorage('k', 42));
    expect(result.current[0]).toBe(42);
  });

  test('reads existing value from localStorage', () => {
    localStorage.setItem('k', JSON.stringify('stored'));
    const { result } = renderHook(() => useLocalStorage('k', 'default'));
    expect(result.current[0]).toBe('stored');
  });

  test('setValue updates state and persists to localStorage', () => {
    const { result } = renderHook(() => useLocalStorage('k', 0));
    act(() => result.current[1](99));
    expect(result.current[0]).toBe(99);
    expect(JSON.parse(localStorage.getItem('k'))).toBe(99);
  });

  test('setValue accepts an updater function', () => {
    const { result } = renderHook(() => useLocalStorage('k', 1));
    act(() => result.current[1]((prev) => prev + 1));
    expect(result.current[0]).toBe(2);
  });

  test('remove clears localStorage and resets to initialValue', () => {
    const { result } = renderHook(() => useLocalStorage('k', 'init'));
    act(() => result.current[1]('changed'));
    act(() => result.current[2]());
    expect(result.current[0]).toBe('init');
    expect(localStorage.getItem('k')).toBeNull();
  });
});

// ── useAsync ──────────────────────────────────────────────────────────────────
import { useAsync } from '../hooks/useAsync';

describe('useAsync', () => {
  test('starts with idle state', () => {
    const { result } = renderHook(() => useAsync(jest.fn()));
    expect(result.current).toMatchObject({ data: null, loading: false, error: null });
  });

  test('sets loading true while pending', async () => {
    let resolve;
    const fn = () => new Promise((r) => { resolve = r; });
    const { result } = renderHook(() => useAsync(fn));
    act(() => { result.current.execute(); });
    expect(result.current.loading).toBe(true);
    await act(async () => resolve('done'));
    expect(result.current.loading).toBe(false);
  });

  test('sets data on success', async () => {
    const fn = jest.fn().mockResolvedValue({ id: 1 });
    const { result } = renderHook(() => useAsync(fn));
    await act(() => result.current.execute());
    expect(result.current.data).toEqual({ id: 1 });
    expect(result.current.error).toBeNull();
  });

  test('sets error on failure', async () => {
    const fn = jest.fn().mockRejectedValue(new Error('boom'));
    const { result } = renderHook(() => useAsync(fn));
    await act(() => result.current.execute());
    expect(result.current.error).toBe('boom');
    expect(result.current.data).toBeNull();
  });

  test('reset clears all state', async () => {
    const fn = jest.fn().mockResolvedValue('ok');
    const { result } = renderHook(() => useAsync(fn));
    await act(() => result.current.execute());
    act(() => result.current.reset());
    expect(result.current).toMatchObject({ data: null, loading: false, error: null });
  });

  test('passes arguments through to the async function', async () => {
    const fn = jest.fn().mockResolvedValue(null);
    const { result } = renderHook(() => useAsync(fn));
    await act(() => result.current.execute('a', 'b'));
    expect(fn).toHaveBeenCalledWith('a', 'b');
  });
});

// ── useFetch ──────────────────────────────────────────────────────────────────
import api from '../lib/api';
import { useFetch } from '../hooks/useFetch';

describe('useFetch', () => {
  beforeEach(() => jest.clearAllMocks());

  test('fetches data on mount and clears loading', async () => {
    api.request.mockResolvedValue({ data: { items: [] } });
    const { result } = renderHook(() => useFetch('/rewards'));
    expect(result.current.loading).toBe(true);
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.data).toEqual({ items: [] });
    expect(result.current.error).toBeNull();
  });

  test('sets error message on failure', async () => {
    api.request.mockRejectedValue({ message: 'Network Error' });
    const { result } = renderHook(() => useFetch('/rewards'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    expect(result.current.error).toBe('Network Error');
  });

  test('skips fetch when url is null', () => {
    const { result } = renderHook(() => useFetch(null));
    expect(result.current.loading).toBe(false);
    expect(api.request).not.toHaveBeenCalled();
  });

  test('refetch re-runs the request', async () => {
    api.request.mockResolvedValue({ data: 'first' });
    const { result } = renderHook(() => useFetch('/data'));
    await waitFor(() => expect(result.current.loading).toBe(false));
    api.request.mockResolvedValue({ data: 'second' });
    await act(() => result.current.refetch());
    expect(result.current.data).toBe('second');
  });
});

// ── useMediaQuery ─────────────────────────────────────────────────────────────
import { useMediaQuery } from '../hooks/useMediaQuery';

describe('useMediaQuery', () => {
  const makeMql = (matches) => ({
    matches,
    addEventListener: jest.fn(),
    removeEventListener: jest.fn(),
  });

  test('returns true when query matches', () => {
    window.matchMedia = jest.fn().mockReturnValue(makeMql(true));
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(true);
  });

  test('returns false when query does not match', () => {
    window.matchMedia = jest.fn().mockReturnValue(makeMql(false));
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    expect(result.current).toBe(false);
  });

  test('updates state when media query fires a change event', () => {
    let handler;
    const mql = {
      matches: false,
      addEventListener: jest.fn((_, h) => { handler = h; }),
      removeEventListener: jest.fn(),
    };
    window.matchMedia = jest.fn().mockReturnValue(mql);
    const { result } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    act(() => handler({ matches: true }));
    expect(result.current).toBe(true);
  });

  test('removes event listener on unmount', () => {
    const mql = makeMql(false);
    window.matchMedia = jest.fn().mockReturnValue(mql);
    const { unmount } = renderHook(() => useMediaQuery('(max-width: 768px)'));
    unmount();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });
});

// ── useTheme ──────────────────────────────────────────────────────────────────
jest.mock('next-themes', () => ({
  useTheme: () => ({ theme: 'light', setTheme: jest.fn(), resolvedTheme: 'light' }),
}));
import { useTheme } from '../hooks/useTheme';

describe('useTheme', () => {
  test('returns theme object from next-themes', () => {
    const { result } = renderHook(() => useTheme());
    expect(result.current.theme).toBe('light');
    expect(typeof result.current.setTheme).toBe('function');
  });
});

// ── useAuth ───────────────────────────────────────────────────────────────────
import { useAuth } from '../hooks/useAuth';
import { AuthProvider } from '../context/AuthContext';

describe('useAuth', () => {
  test('throws when used outside AuthProvider', () => {
    const spy = jest.spyOn(console, 'error').mockImplementation(() => {});
    expect(() => renderHook(() => useAuth())).toThrow(
      'useAuth must be used within an AuthProvider'
    );
    spy.mockRestore();
  });

  test('returns auth context shape when inside AuthProvider', () => {
    const wrapper = ({ children }) => <AuthProvider>{children}</AuthProvider>;
    const { result } = renderHook(() => useAuth(), { wrapper });
    expect(result.current).toMatchObject({
      isAuthenticated: expect.any(Boolean),
      login: expect.any(Function),
      logout: expect.any(Function),
      register: expect.any(Function),
    });
  });
});
