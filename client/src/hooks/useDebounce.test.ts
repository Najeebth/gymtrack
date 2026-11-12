import { act, renderHook } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { useDebounce } from './useDebounce';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

const advance = (ms: number) => act(() => vi.advanceTimersByTime(ms));

describe('useDebounce', () => {
  it('returns the initial value straight away', () => {
    const { result } = renderHook(() => useDebounce('bench', 300));

    expect(result.current).toBe('bench');
  });

  it('holds the old value until the delay has passed', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: 'b' },
    });

    rerender({ value: 'be' });
    advance(299);
    expect(result.current).toBe('b');

    advance(1);
    expect(result.current).toBe('be');
  });

  it('waits for typing to stop: every change restarts the timer', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 300), {
      initialProps: { value: '' },
    });

    for (const typed of ['b', 'be', 'ben', 'benc', 'bench']) {
      rerender({ value: typed });
      advance(200); // never long enough to settle
    }
    expect(result.current).toBe('');

    advance(100);
    expect(result.current).toBe('bench');
  });

  it('defaults to a 300 ms delay', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value), { initialProps: { value: 'a' } });

    rerender({ value: 'b' });
    advance(299);
    expect(result.current).toBe('a');

    advance(1);
    expect(result.current).toBe('b');
  });

  it('applies a changed delay to the next update', () => {
    const { result, rerender } = renderHook(({ value, delay }) => useDebounce(value, delay), {
      initialProps: { value: 'a', delay: 1000 },
    });

    rerender({ value: 'b', delay: 50 });
    advance(50);

    expect(result.current).toBe('b');
  });

  it('works with non-string values', () => {
    const { result, rerender } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: { page: 1 } },
    });

    rerender({ value: { page: 2 } });
    advance(100);

    expect(result.current).toEqual({ page: 2 });
  });

  it('does not update after unmounting', () => {
    const { rerender, unmount } = renderHook(({ value }) => useDebounce(value, 100), {
      initialProps: { value: 'a' },
    });
    rerender({ value: 'b' });

    unmount();

    expect(vi.getTimerCount()).toBe(0);
  });
});
