/**
 * Session store — holds the user's personal decryption key in memory only.
 * NEVER use `persist` middleware. The session key must NOT be stored in
 * localStorage, sessionStorage, cookies, or any persistent medium.
 */
import { create } from 'zustand';

interface SessionState {
  sessionKey: string | null;
  isUnlocked: boolean;
  setSessionKey: (key: string) => void;
  clearSessionKey: () => void;
}

export const useSessionStore = create<SessionState>((set) => ({
  sessionKey: null,
  isUnlocked: false,
  setSessionKey: (key) => set({ sessionKey: key, isUnlocked: true }),
  clearSessionKey: () => set({ sessionKey: null, isUnlocked: false }),
}));
