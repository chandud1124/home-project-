import { vi } from 'vitest';
import '@testing-library/jest-dom';

// Mock WebSocket
class MockWebSocket {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSING = 2;
  static CLOSED = 3;

  readyState = 1; // OPEN
  constructor() {}
  send() {}
  close() {}
  addEventListener() {}
  removeEventListener() {}
}
global.WebSocket = MockWebSocket as any;

// Mock fetch
global.fetch = vi.fn();

// Mock EventSource
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = 1; // OPEN
  constructor() {}
  addEventListener() {}
  removeEventListener() {}
  close() {}
}
global.EventSource = MockEventSource as any;

// Mock navigator.onLine
Object.defineProperty(navigator, 'onLine', {
  writable: true,
  value: true,
});

// Mock localStorage
const localStorageMock = {
  getItem: vi.fn(),
  setItem: vi.fn(),
  removeItem: vi.fn(),
  clear: vi.fn(),
  length: 0,
  key: vi.fn(),
};
global.localStorage = localStorageMock as any;

// Mock console methods to reduce noise in tests
global.console = {
  ...console,
  log: vi.fn(),
  warn: vi.fn(),
  error: vi.fn(),
};
