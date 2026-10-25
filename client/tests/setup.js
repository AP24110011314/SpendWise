import '@testing-library/jest-dom';
import { vi, expect } from 'vitest';

vi.mock('react-hot-toast', () => ({
  Toaster: ({ children }) => children,
  toast: {
    success: vi.fn(),
    error: vi.fn(),
  },
}));

Object.defineProperty(window, 'matchMedia', {
  writable: true,
  value: vi.fn().mockImplementation(query => ({
    matches: false,
    media: query,
    onchange: null,
    addListener: vi.fn(),
    removeListener: vi.fn(),
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
    dispatchEvent: vi.fn(),
  })),
});

// Make expect available globally for @testing-library/jest-dom
global.expect = expect;