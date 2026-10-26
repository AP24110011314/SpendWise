import { describe, it, expect, vi, beforeEach } from 'vitest';
import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { BrowserRouter } from 'react-router-dom';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import Login from '../src/pages/Login.jsx';
import { AuthProvider } from '../src/context/AuthContext.jsx';
import { authApi } from '../src/api/auth.js';
import toast from 'react-hot-toast';

// Mock react-hot-toast
vi.mock('react-hot-toast', () => ({
  default: {
    success: vi.fn(),
    error: vi.fn(),
  },
  Toaster: () => null,
}));

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
};
Object.defineProperty(window, 'localStorage', { value: localStorageMock, writable: true });

// Mock the authApi
vi.mock('../src/api/auth.js', () => ({
  authApi: {
    login: vi.fn(),
    register: vi.fn(),
    logout: vi.fn(),
    me: vi.fn().mockRejectedValue(new Error('Unauthorized')),
  },
}));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: false },
  },
});

function renderWithProviders(ui) {
  return render(
    <QueryClientProvider client={queryClient}>
      <BrowserRouter future={{ v7_startTransition: true, v7_relativeSplatPath: true }}>
        <AuthProvider>
          {ui}
        </AuthProvider>
      </BrowserRouter>
    </QueryClientProvider>
  );
}

describe('Login Page - Form Submission', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    localStorageMock.clear.mockClear();
    // Reset authApi.me to reject by default (unauthenticated)
    authApi.me.mockRejectedValue(new Error('Unauthorized'));
  });

  it('renders login form', () => {
    renderWithProviders(<Login />);
    expect(screen.getByText('Welcome back')).toBeInTheDocument();
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
    expect(screen.getByLabelText('Password')).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /sign in/i })).toBeInTheDocument();
  });

  it('submits form with valid credentials and calls login API', async () => {
    const mockUser = { _id: '123', name: 'Test User', email: 'test@example.com' };
    const mockAccessToken = 'mock-token';
    authApi.login.mockResolvedValue({ user: mockUser, accessToken: mockAccessToken });

    renderWithProviders(<Login />);

    // Fill in the form
    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');

    // Submit
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Wait for API call
    await waitFor(() => {
      expect(authApi.login).toHaveBeenCalledWith('test@example.com', 'password123');
    });

    // Check that the API was called with correct body
    expect(authApi.login).toHaveBeenCalledTimes(1);
  });

  it('shows validation errors for invalid email', async () => {
    renderWithProviders(<Login />);

    await userEvent.type(screen.getByLabelText('Email'), 'invalid-email');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    // Submit form using fireEvent to trigger validation
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(screen.getByText('Invalid email')).toBeInTheDocument();
    });

    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('shows validation error for empty password', async () => {
    renderWithProviders(<Login />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    // Submit form using fireEvent to trigger validation
    fireEvent.submit(screen.getByTestId('login-form'));

    await waitFor(() => {
      expect(screen.getByText('Password is required')).toBeInTheDocument();
    });

    expect(authApi.login).not.toHaveBeenCalled();
  });

  it('shows error toast on failed login', async () => {
    authApi.login.mockRejectedValue(new Error('Invalid credentials'));

    renderWithProviders(<Login />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'wrongpassword');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    await waitFor(() => {
      expect(toast.error).toHaveBeenCalledWith('Invalid credentials');
    });
  });

  it('shows loading state during submission', async () => {
    let resolveLogin;
    const loginPromise = new Promise((resolve) => { resolveLogin = resolve; });
    authApi.login.mockReturnValue(loginPromise);

    renderWithProviders(<Login />);

    await userEvent.type(screen.getByLabelText('Email'), 'test@example.com');
    await userEvent.type(screen.getByLabelText('Password'), 'password123');
    await userEvent.click(screen.getByRole('button', { name: /sign in/i }));

    // Button should be disabled and show loading
    await waitFor(() => {
      const button = screen.getByRole('button', { name: /sign in/i });
      expect(button).toBeDisabled();
    });

    resolveLogin({ user: { _id: '123', name: 'Test' }, accessToken: 'token' });
  });
});