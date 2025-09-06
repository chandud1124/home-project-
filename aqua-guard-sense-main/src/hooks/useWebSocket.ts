
// Deprecated: Legacy WebSocket hook retained as empty stub for backward compatibility.
// The project migrated to Server-Sent Events (SSE) + HTTPS POST; this file will be removed in a future cleanup.
// Any previous imports should be refactored to use the SSE logic inside `src/services/api.ts`.

export const useWebSocket = () => {
  if (process.env.NODE_ENV !== 'production') {
    // eslint-disable-next-line no-console
    console.warn('useWebSocket is deprecated. Use the SSE implementation in api.ts instead.');
  }
  return { isConnected: false, lastMessage: null, sendMessage: () => {} };
};
