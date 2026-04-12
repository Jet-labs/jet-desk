/**
 * Connection Store — Runtime-only connection state
 * No persistence. Tracks live socket status and reconnect logic.
 */

import { create } from 'zustand';

export type ConnectionStatus =
  | 'disconnected'
  | 'connecting'
  | 'authenticating'
  | 'connected'
  | 'reconnecting'
  | 'error';

interface ConnectionStoreState {
  status: ConnectionStatus;
  errorMessage: string | null;
  reconnectAttempt: number;
  maxReconnectAttempts: number;

  // Actions
  setStatus: (status: ConnectionStatus) => void;
  setError: (message: string) => void;
  clearError: () => void;
  incrementReconnect: () => number;
  resetReconnect: () => void;
  canReconnect: () => boolean;
}

export const useConnectionStore = create<ConnectionStoreState>((set, get) => ({
  status: 'disconnected',
  errorMessage: null,
  reconnectAttempt: 0,
  maxReconnectAttempts: 10,

  setStatus: (status: ConnectionStatus) => {
    set({ status, errorMessage: status === 'error' ? get().errorMessage : null });
  },

  setError: (message: string) => {
    set({ status: 'error', errorMessage: message });
  },

  clearError: () => {
    set({ errorMessage: null });
  },

  incrementReconnect: () => {
    const next = get().reconnectAttempt + 1;
    set({ reconnectAttempt: next });
    return next;
  },

  resetReconnect: () => {
    set({ reconnectAttempt: 0 });
  },

  canReconnect: () => {
    const { reconnectAttempt, maxReconnectAttempts } = get();
    return reconnectAttempt < maxReconnectAttempts;
  },
}));
