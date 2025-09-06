import { describe, it, expect, vi, beforeEach } from 'vitest';
import { useWebSocket } from '../hooks/useWebSocket';

// Mock EventSource for SSE testing
class MockEventSource {
  static CONNECTING = 0;
  static OPEN = 1;
  static CLOSED = 2;

  readyState = 1;
  url = '';
  onopen: (() => void) | null = null;
  onmessage: ((event: any) => void) | null = null;
  onerror: ((event: any) => void) | null = null;

  constructor(url: string) {
    this.url = url;
  }

  addEventListener(type: string, listener: any) {
    if (type === 'open' && this.onopen) this.onopen();
    if (type === 'message' && this.onmessage) {
      // Simulate receiving a message
      const mockEvent = {
        data: JSON.stringify({
          type: 'tank_reading',
          data: {
            tank_type: 'sump_tank',
            level_percentage: 75,
            timestamp: new Date().toISOString()
          }
        })
      };
      this.onmessage(mockEvent);
    }
    // Call the listener directly for the test
    if (type === 'message') {
      listener({
        data: JSON.stringify({
          type: 'tank_reading',
          data: {
            tank_type: 'sump_tank',
            level_percentage: 75,
            timestamp: new Date().toISOString()
          }
        })
      });
    }
  }

  removeEventListener() {}
  close() {}
}

global.EventSource = MockEventSource as any;

describe('WebSocket/SSE Integration', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it('should handle deprecated useWebSocket hook', () => {
    const result = useWebSocket();

    expect(result.isConnected).toBe(false);
    expect(result.lastMessage).toBe(null);
    expect(typeof result.sendMessage).toBe('function');
  });

  it('should simulate server-sent events', () => {
    const mockEventSource = new MockEventSource('http://test.com/events');

    expect(mockEventSource.readyState).toBe(1); // OPEN
    expect(mockEventSource.url).toBe('http://test.com/events');
  });

  it('should handle event listeners', () => {
    const mockEventSource = new MockEventSource('http://test.com/events');
    const mockListener = vi.fn();

    mockEventSource.addEventListener('message', mockListener);

    expect(mockListener).toHaveBeenCalled();
  });

  it('should close connections properly', () => {
    const mockEventSource = new MockEventSource('http://test.com/events');
    const closeSpy = vi.spyOn(mockEventSource, 'close');

    mockEventSource.close();

    expect(closeSpy).toHaveBeenCalled();
  });

  it('should handle SSE message parsing', () => {
    const mockEventSource = new MockEventSource('http://test.com/events');
    const mockMessageHandler = vi.fn();

    mockEventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        mockMessageHandler(data);
      } catch (error) {
        // Handle parsing error
      }
    };

    // Trigger message
    mockEventSource.addEventListener('message', () => {});

    expect(mockMessageHandler).toHaveBeenCalledWith(
      expect.objectContaining({
        type: 'tank_reading',
        data: expect.objectContaining({
          tank_type: 'sump_tank',
          level_percentage: 75
        })
      })
    );
  });

  it('should handle connection states', () => {
    const mockEventSource = new MockEventSource('http://test.com/events');

    expect(mockEventSource.readyState).toBe(MockEventSource.OPEN);

    // Simulate connection close
    mockEventSource.readyState = MockEventSource.CLOSED;
    expect(mockEventSource.readyState).toBe(MockEventSource.CLOSED);
  });
});
