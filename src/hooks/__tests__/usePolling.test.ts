import { renderHook, act, waitFor } from '@testing-library/react';
import { usePolling } from '../usePolling';

describe('usePolling', () => {
  beforeEach(() => {
    jest.useFakeTimers();
  });

  afterEach(() => {
    jest.useRealTimers();
  });

  it('should fetch data on mount', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ data: 'test' });
    
    renderHook(() => usePolling({
      fetchFn: mockFetch,
      interval: 15000,
    }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should poll at specified interval', async () => {
    const mockFetch = jest.fn().mockResolvedValue({ data: 'test' });
    
    renderHook(() => usePolling({
      fetchFn: mockFetch,
      interval: 15000,
    }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    act(() => {
      jest.advanceTimersByTime(15000);
    });
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
  });

  it('should pause polling when tab is hidden', () => {
    const mockFetch = jest.fn().mockResolvedValue({ data: 'test' });
    
    renderHook(() => usePolling({
      fetchFn: mockFetch,
      interval: 15000,
    }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Hide tab
    Object.defineProperty(document, 'visibilityState', { value: 'hidden', configurable: true });
    document.dispatchEvent(new Event('visibilitychange'));
    
    act(() => {
      jest.advanceTimersByTime(15000);
    });
    
    // Should not have fetched again
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });

  it('should implement exponential backoff on failure', async () => {
    const mockFetch = jest.fn().mockRejectedValue(new Error('Failed'));
    
    renderHook(() => usePolling({
      fetchFn: mockFetch,
      interval: 15000,
      maxRetries: 3,
      retryDelay: 1000,
    }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    // Should retry after 1 second
    act(() => {
      jest.advanceTimersByTime(1000);
    });
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(2);
    });
    
    // Should retry after 2 seconds
    act(() => {
      jest.advanceTimersByTime(2000);
    });
    
    await waitFor(() => {
      expect(mockFetch).toHaveBeenCalledTimes(3);
    });
  });

  it('should stop polling on unmount', () => {
    const mockFetch = jest.fn().mockResolvedValue({ data: 'test' });
    
    const { unmount } = renderHook(() => usePolling({
      fetchFn: mockFetch,
      interval: 15000,
    }));

    expect(mockFetch).toHaveBeenCalledTimes(1);
    
    unmount();
    
    act(() => {
      jest.advanceTimersByTime(15000);
    });
    
    expect(mockFetch).toHaveBeenCalledTimes(1);
  });
});
