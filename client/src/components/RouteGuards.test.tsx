import { screen } from '@testing-library/react';
import { Route, Routes } from 'react-router-dom';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import RequireAdmin from './RequireAdmin';
import RequireAuth from './RequireAuth';
import { mockAppData, renderWithProviders } from '../test/render';

vi.mock('../context/AppDataContext', () => ({ useAppData: vi.fn() }));

function renderRoutes(route: string) {
  return renderWithProviders(
    <Routes>
      <Route path="/login" element={<div>Member login page</div>} />
      <Route path="/admin" element={<div>Admin login page</div>} />
      <Route
        path="/workouts"
        element={
          <RequireAuth>
            <div>Workouts page</div>
          </RequireAuth>
        }
      />
      <Route
        path="/users"
        element={
          <RequireAdmin>
            <div>Users page</div>
          </RequireAdmin>
        }
      />
    </Routes>,
    { route }
  );
}

describe('RequireAuth', () => {
  beforeEach(() => {
    mockAppData();
  });

  it('shows the page to a signed-in member', () => {
    renderRoutes('/workouts');

    expect(screen.getByText('Workouts page')).toBeInTheDocument();
  });

  it('shows the page to an admin too', () => {
    mockAppData({ isAdmin: true, role: 'ADMIN' });
    renderRoutes('/workouts');

    expect(screen.getByText('Workouts page')).toBeInTheDocument();
  });

  it('sends a signed-out visitor to the login page without rendering the page', () => {
    mockAppData({ authToken: null, role: null, email: null });
    renderRoutes('/workouts');

    expect(screen.getByText('Member login page')).toBeInTheDocument();
    expect(screen.queryByText('Workouts page')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/login');
  });
});

describe('RequireAdmin', () => {
  it('shows the page to an admin', () => {
    mockAppData({ isAdmin: true, role: 'ADMIN' });
    renderRoutes('/users');

    expect(screen.getByText('Users page')).toBeInTheDocument();
  });

  it('sends a regular member to the admin login page', () => {
    mockAppData({ isAdmin: false });
    renderRoutes('/users');

    expect(screen.getByText('Admin login page')).toBeInTheDocument();
    expect(screen.queryByText('Users page')).not.toBeInTheDocument();
    expect(screen.getByTestId('location')).toHaveTextContent('/admin');
  });

  it('sends a signed-out visitor to the admin login page', () => {
    mockAppData({ authToken: null, isAdmin: false, role: null });
    renderRoutes('/users');

    expect(screen.getByTestId('location')).toHaveTextContent('/admin');
  });
});
