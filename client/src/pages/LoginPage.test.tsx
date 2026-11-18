import { screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, describe, expect, it, vi } from 'vitest';
import LoginPage from './LoginPage';
import { useAppData } from '../context/AppDataContext';
import { renderWithProviders } from '../test/render';

vi.mock('../context/AppDataContext', () => ({ useAppData: vi.fn() }));

const mockLogin = vi.fn();
const mockSignup = vi.fn();

beforeEach(() => {
  mockLogin.mockReset().mockResolvedValue({ ok: true });
  mockSignup.mockReset().mockResolvedValue({ ok: true });

  vi.mocked(useAppData).mockReturnValue({
    authToken: null,
    isAdmin: false,
    userEmail: null,
    login: mockLogin,
    signup: mockSignup,
    logout: vi.fn(),
  } as unknown as ReturnType<typeof useAppData>);
});

describe('LoginPage', () => {
  it('renders the login page with editorial section and auth form', () => {
    renderWithProviders(<LoginPage />);

    expect(screen.getByText(/Track every rep/i)).toBeInTheDocument();
    expect(screen.getByText(/Conquer every limit/i)).toBeInTheDocument();
    expect(screen.getByRole('heading', { name: /Welcome back/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Email Address/i)).toBeInTheDocument();
    expect(screen.getByLabelText(/^Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Log In/i })).toBeInTheDocument();
  });

  it('toggles password visibility when the eye icon is clicked', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    const passwordInput = screen.getByLabelText(/^Password/i);
    expect(passwordInput).toHaveAttribute('type', 'password');

    const toggleBtn = screen.getByRole('button', { name: /Show password/i });
    await user.click(toggleBtn);

    expect(passwordInput).toHaveAttribute('type', 'text');
  });

  it('switches between Login and Signup modes', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    // Initially in Login mode
    expect(screen.getByRole('heading', { name: /Welcome back/i })).toBeInTheDocument();
    expect(screen.queryByLabelText(/Confirm Password/i)).not.toBeInTheDocument();

    // Click Sign up toggle
    await user.click(screen.getByRole('button', { name: /^Sign up$/i }));

    // Now in Signup mode
    expect(screen.getByRole('heading', { name: /Create your account/i })).toBeInTheDocument();
    expect(screen.getByLabelText(/Confirm Password/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /Create Account/i })).toBeInTheDocument();

    // Switch back to Login
    await user.click(screen.getByRole('button', { name: /^Log in$/i }));
    expect(screen.getByRole('heading', { name: /Welcome back/i })).toBeInTheDocument();
  });

  it('shows an error if passwords do not match on signup', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    // Switch to Signup
    await user.click(screen.getByRole('button', { name: /^Sign up$/i }));

    await user.type(screen.getByLabelText(/Email Address/i), 'athlete@gym.com');
    await user.type(screen.getByLabelText(/^Password/i), 'secret123');
    await user.type(screen.getByLabelText(/Confirm Password/i), 'mismatch456');

    await user.click(screen.getByRole('button', { name: /Create Account/i }));

    expect(screen.getByRole('alert')).toHaveTextContent("Passwords don't match.");
    expect(mockSignup).not.toHaveBeenCalled();
  });

  it('submits login form with valid credentials', async () => {
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/Email Address/i), 'athlete@gym.com');
    await user.type(screen.getByLabelText(/^Password/i), 'secret123');

    await user.click(screen.getByRole('button', { name: /Log In/i }));

    expect(mockLogin).toHaveBeenCalledWith('athlete@gym.com', 'secret123');
  });

  it('displays error notice when login fails', async () => {
    mockLogin.mockResolvedValueOnce({ ok: false, error: 'Invalid email or password' });
    const user = userEvent.setup();
    renderWithProviders(<LoginPage />);

    await user.type(screen.getByLabelText(/Email Address/i), 'athlete@gym.com');
    await user.type(screen.getByLabelText(/^Password/i), 'wrongpassword');

    await user.click(screen.getByRole('button', { name: /Log In/i }));

    expect(screen.getByRole('alert')).toHaveTextContent('Invalid email or password');
  });
});
