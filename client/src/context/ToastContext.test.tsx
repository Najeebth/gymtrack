import { act, fireEvent, render, renderHook, screen } from '@testing-library/react';
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { ToastProvider, useToast, type ToastType } from './ToastContext';
import ToastStack from '../components/ToastStack';

beforeEach(() => {
  vi.useFakeTimers();
});

afterEach(() => {
  vi.useRealTimers();
});

function Trigger({ message, type }: { message: string; type?: ToastType }) {
  const { showToast } = useToast();
  return <button onClick={() => showToast(message, type)}>show {message}</button>;
}

function setup(...triggers: { message: string; type?: ToastType }[]) {
  render(
    <ToastProvider>
      {triggers.map((t) => (
        <Trigger key={t.message} {...t} />
      ))}
      <ToastStack />
    </ToastProvider>
  );
}

const show = (message: string) => fireEvent.click(screen.getByRole('button', { name: `show ${message}` }));

describe('toasts', () => {
  it('shows a message when asked', () => {
    setup({ message: 'Workout saved', type: 'success' });

    show('Workout saved');

    expect(screen.getByText('Workout saved')).toBeInTheDocument();
  });

  it.each([
    ['success', 'bg-brand-success'],
    ['error', 'bg-brand-danger'],
    ['info', 'bg-brand-orange'],
  ] as const)('colours a %s toast with %s', (type, className) => {
    setup({ message: 'hello', type });

    show('hello');

    expect(screen.getByText('hello')).toHaveClass(className);
  });

  it('defaults to the info style', () => {
    setup({ message: 'fyi' });

    show('fyi');

    expect(screen.getByText('fyi')).toHaveClass('bg-brand-orange');
  });

  it('disappears by itself after 3 seconds, and not before', () => {
    setup({ message: 'bye' });
    show('bye');

    act(() => vi.advanceTimersByTime(2999));
    expect(screen.getByText('bye')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1));
    expect(screen.queryByText('bye')).not.toBeInTheDocument();
  });

  it('can be dismissed early by clicking it', () => {
    setup({ message: 'click me' });
    show('click me');

    fireEvent.click(screen.getByText('click me'));

    expect(screen.queryByText('click me')).not.toBeInTheDocument();
  });

  it('stacks several toasts and expires each on its own timer', () => {
    setup({ message: 'first' }, { message: 'second' });

    show('first');
    act(() => vi.advanceTimersByTime(2000));
    show('second');

    expect(screen.getByText('first')).toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();

    act(() => vi.advanceTimersByTime(1000)); // first is now 3s old
    expect(screen.queryByText('first')).not.toBeInTheDocument();
    expect(screen.getByText('second')).toBeInTheDocument();
  });

  it('dismissing one toast leaves the others', () => {
    setup({ message: 'a' }, { message: 'b' });
    show('a');
    show('b');

    fireEvent.click(screen.getByText('a'));

    expect(screen.queryByText('a')).not.toBeInTheDocument();
    expect(screen.getByText('b')).toBeInTheDocument();
  });
});

describe('useToast', () => {
  it('throws a helpful error outside a ToastProvider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useToast())).toThrow('useToast must be used within ToastProvider');

    spy.mockRestore();
  });
});
