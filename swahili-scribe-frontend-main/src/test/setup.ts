// Import necessary testing utilities
import { vi } from 'vitest';
import '@testing-library/jest-dom/vitest';

// Add Vitest types
declare global {
  interface Window {
    URL: {
      createObjectURL: (blob: Blob) => string;
    };
  }
}

// Mock global objects
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

// Mock window.URL.createObjectURL
window.URL.createObjectURL = vi.fn();
// Note: Individual tests can mock modules as needed.
