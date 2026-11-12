import { screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import Sidebar from './Sidebar';
import { mockAppData, renderWithProviders } from '../test/render';

vi.mock('../context/AppDataContext', () => ({ useAppData: vi.fn() }));

beforeEach(() => {
  mockAppData();
});

function renderSidebar({ open = false, route = '/dashboard' } = {}) {
  const onClose = vi.fn();
  renderWithProviders(<Sidebar open={open} onClose={onClose} />, { route });
  return { onClose };
}

describe('Sidebar navigation links', () => {
  it.each([
    ['Dashboard', '/dashboard'],
    ['My Workouts', '/workouts'],
    ['Exercises', '/exercises'],
    ['By Date', '/by-date'],
    ['Progress', '/progress'],
    ['Templates', '/templates'],
  ])('links %s to %s', (name, href) => {
    renderSidebar();

    expect(screen.getByRole('link', { name })).toHaveAttribute('href', href);
  });

  it('marks the link for the current page', () => {
    renderSidebar({ route: '/progress' });

    expect(screen.getByRole('link', { name: 'Progress' })).toHaveAttribute('aria-current', 'page');
    expect(screen.getByRole('link', { name: 'Dashboard' })).not.toHaveAttribute('aria-current');
  });

  it('navigates when a link is clicked', async () => {
    const user = userEvent.setup();
    renderSidebar();

    await user.click(screen.getByRole('link', { name: 'Templates' }));

    expect(screen.getByTestId('location')).toHaveTextContent('/templates');
    expect(screen.getByRole('link', { name: 'Templates' })).toHaveAttribute('aria-current', 'page');
  });
});

describe('admin section', () => {
  it('is hidden from members', () => {
    renderSidebar();

    expect(screen.queryByText('Admin Apps')).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Users' })).not.toBeInTheDocument();
    expect(screen.queryByRole('link', { name: 'Live Traffic' })).not.toBeInTheDocument();
  });

  it('shows admins the admin tools', () => {
    mockAppData({ isAdmin: true, role: 'ADMIN' });
    renderSidebar();

    expect(screen.getByText('Admin Apps')).toBeInTheDocument();
    expect(screen.getByRole('link', { name: 'Live Traffic' })).toHaveAttribute('href', '/traffic');
    expect(screen.getByRole('link', { name: 'Server Health' })).toHaveAttribute('href', '/health');
    expect(screen.getByRole('link', { name: 'Request Map' })).toHaveAttribute('href', '/map');
    expect(screen.getByRole('link', { name: 'Users' })).toHaveAttribute('href', '/users');
  });
});

describe('mobile drawer', () => {
  it('is not rendered while closed', () => {
    renderSidebar({ open: false });

    expect(screen.queryByRole('dialog', { name: 'Navigation' })).not.toBeInTheDocument();
  });

  it('renders a navigation dialog while open', () => {
    renderSidebar({ open: true });

    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    expect(within(drawer).getByRole('link', { name: 'Exercises' })).toBeInTheDocument();
  });

  it('closes from the close button', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSidebar({ open: true });
    onClose.mockClear(); // ignore the call made on mount

    await user.click(screen.getByRole('button', { name: 'Close navigation' }));

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes when the backdrop is tapped', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSidebar({ open: true });
    onClose.mockClear();

    await user.click(screen.getByRole('dialog', { name: 'Navigation' }).firstElementChild as HTMLElement);

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('closes on Escape', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSidebar({ open: true });
    onClose.mockClear();

    await user.keyboard('{Escape}');

    expect(onClose).toHaveBeenCalledTimes(1);
  });

  it('ignores Escape while closed', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSidebar({ open: false });
    onClose.mockClear();

    await user.keyboard('{Escape}');

    expect(onClose).not.toHaveBeenCalled();
  });

  it('closes after choosing a page', async () => {
    const user = userEvent.setup();
    const { onClose } = renderSidebar({ open: true });
    onClose.mockClear();

    const drawer = screen.getByRole('dialog', { name: 'Navigation' });
    await user.click(within(drawer).getByRole('link', { name: 'By Date' }));

    expect(onClose).toHaveBeenCalled();
    expect(screen.getByTestId('location')).toHaveTextContent('/by-date');
  });
});
