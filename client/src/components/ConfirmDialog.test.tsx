import { act, renderHook, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { describe, expect, it, vi } from 'vitest';
import { useConfirm, type ConfirmOptions } from '../context/ConfirmContext';
import { renderWithProviders } from '../test/render';

// The dialog animates in with `motion`; jsdom has no Web Animations API
vi.mock('motion', () => ({ animate: vi.fn() }));

/** A button that opens the dialog and reports what the user chose. */
function Harness({ options, onResult }: { options: ConfirmOptions; onResult: (ok: boolean) => void }) {
  const confirm = useConfirm();
  return <button onClick={async () => onResult(await confirm(options))}>Open</button>;
}

function setup(options: Partial<ConfirmOptions> = {}) {
  const onResult = vi.fn();
  const user = userEvent.setup();
  renderWithProviders(<Harness options={{ title: 'Delete workout?', ...options }} onResult={onResult} />);
  return { onResult, user };
}

describe('ConfirmDialog', () => {
  it('is not shown until requested', () => {
    setup();

    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('shows an accessible dialog with the title and message', async () => {
    const { user } = setup({ message: 'This cannot be undone.' });

    await user.click(screen.getByRole('button', { name: 'Open' }));

    const dialog = screen.getByRole('alertdialog', { name: 'Delete workout?' });
    expect(dialog).toHaveAttribute('aria-modal', 'true');
    expect(dialog).toHaveAccessibleDescription('This cannot be undone.');
  });

  it('has no description when there is no message', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('alertdialog')).not.toHaveAttribute('aria-describedby');
  });

  it('resolves true and closes when confirmed', async () => {
    const { user, onResult } = setup({ confirmLabel: 'Delete it' });
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.click(screen.getByRole('button', { name: 'Delete it' }));

    expect(onResult).toHaveBeenCalledWith(true);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('resolves false and closes when cancelled', async () => {
    const { user, onResult } = setup({ cancelLabel: 'Keep it' });
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.click(screen.getByRole('button', { name: 'Keep it' }));

    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('uses Confirm and Cancel as the default labels', async () => {
    const { user } = setup();

    await user.click(screen.getByRole('button', { name: 'Open' }));

    expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
    expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  });

  it('cancels on Escape', async () => {
    const { user, onResult } = setup();
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.keyboard('{Escape}');

    expect(onResult).toHaveBeenCalledWith(false);
    expect(screen.queryByRole('alertdialog')).not.toBeInTheDocument();
  });

  it('cancels when the backdrop is clicked', async () => {
    const { user, onResult } = setup();
    await user.click(screen.getByRole('button', { name: 'Open' }));
    const backdrop = screen.getByRole('alertdialog').previousElementSibling as HTMLElement;

    await user.click(backdrop);

    expect(onResult).toHaveBeenCalledWith(false);
  });

  it('does not close when the dialog panel itself is clicked', async () => {
    const { user, onResult } = setup({ message: 'Body text' });
    await user.click(screen.getByRole('button', { name: 'Open' }));

    await user.click(screen.getByText('Body text'));

    expect(onResult).not.toHaveBeenCalled();
    expect(screen.getByRole('alertdialog')).toBeInTheDocument();
  });

  describe('focus', () => {
    it('starts on Confirm for an ordinary question', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveFocus();
    });

    it('starts on Cancel for a destructive one, so a stray Enter cannot delete anything', async () => {
      const { user, onResult } = setup({ tone: 'danger' });

      await user.click(screen.getByRole('button', { name: 'Open' }));
      expect(screen.getByRole('button', { name: 'Cancel' })).toHaveFocus();

      await user.keyboard('{Enter}');
      expect(onResult).toHaveBeenCalledWith(false);
    });

    it('keeps Tab inside the dialog, wrapping between the two buttons', async () => {
      const { user } = setup({ tone: 'danger' });
      await user.click(screen.getByRole('button', { name: 'Open' }));
      const cancel = screen.getByRole('button', { name: 'Cancel' });
      const confirm = screen.getByRole('button', { name: 'Confirm' });

      await user.tab();
      expect(confirm).toHaveFocus();
      await user.tab();
      expect(cancel).toHaveFocus();
      await user.tab({ shift: true });
      expect(confirm).toHaveFocus();
    });

    it('returns focus to the button that opened it', async () => {
      const { user } = setup();
      const opener = screen.getByRole('button', { name: 'Open' });
      await user.click(opener);

      await user.keyboard('{Escape}');

      expect(opener).toHaveFocus();
    });
  });

  describe('styling by tone', () => {
    it('makes the confirm button red for danger', async () => {
      const { user } = setup({ tone: 'danger' });

      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('bg-brand-danger');
    });

    it('makes the confirm button orange otherwise', async () => {
      const { user } = setup();

      await user.click(screen.getByRole('button', { name: 'Open' }));

      expect(screen.getByRole('button', { name: 'Confirm' })).toHaveClass('bg-brand-orange');
    });
  });
});

describe('useConfirm', () => {
  it('cancels the open dialog when a second one is requested, instead of stacking them', async () => {
    let confirm!: ReturnType<typeof useConfirm>;
    function Capture() {
      confirm = useConfirm();
      return null;
    }
    renderWithProviders(<Capture />);

    let first!: Promise<boolean>;
    let second!: Promise<boolean>;
    act(() => {
      first = confirm({ title: 'First?' });
      second = confirm({ title: 'Second?' });
    });

    await expect(first).resolves.toBe(false);
    expect(screen.getAllByRole('alertdialog')).toHaveLength(1);
    expect(screen.getByRole('alertdialog', { name: 'Second?' })).toBeInTheDocument();

    await userEvent.setup().click(screen.getByRole('button', { name: 'Confirm' }));
    await expect(second).resolves.toBe(true);
  });

  it('throws a clear error outside the provider', () => {
    const spy = vi.spyOn(console, 'error').mockImplementation(() => {});

    expect(() => renderHook(() => useConfirm())).toThrow('useConfirm must be used within ConfirmProvider');

    spy.mockRestore();
  });
});
