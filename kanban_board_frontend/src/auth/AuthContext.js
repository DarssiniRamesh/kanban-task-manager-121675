import React, { createContext, useCallback, useContext, useMemo, useState } from 'react';

const AUTH_STORAGE_KEY = 'kanban.dummyAuth.v1';

/**
 * Hardcoded demo credentials (frontend-only).
 * IMPORTANT: This is intentionally insecure and for demo purposes only.
 */
const DUMMY_USERS = [
  { username: 'reader', password: 'reader123', role: 'reader', displayName: 'Reader' },
  { username: 'editor', password: 'editor123', role: 'editor', displayName: 'Editor' },
];

const AuthContext = createContext(null);

function safeLoadAuthState() {
  try {
    const raw = localStorage.getItem(AUTH_STORAGE_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw);
    if (!parsed || typeof parsed !== 'object') return null;
    if (parsed.role !== 'reader' && parsed.role !== 'editor') return null;
    if (typeof parsed.username !== 'string') return null;
    if (typeof parsed.displayName !== 'string') return null;
    return { username: parsed.username, role: parsed.role, displayName: parsed.displayName };
  } catch {
    return null;
  }
}

function safeSaveAuthState(user) {
  try {
    if (!user) localStorage.removeItem(AUTH_STORAGE_KEY);
    else localStorage.setItem(AUTH_STORAGE_KEY, JSON.stringify(user));
  } catch {
    // ignore storage errors
  }
}

// PUBLIC_INTERFACE
export function AuthProvider({ children }) {
  /** Provides dummy frontend-only auth state (Reader/Editor) and role helpers. */
  const [user, setUser] = useState(() => {
    if (typeof window === 'undefined') return null;
    return safeLoadAuthState();
  });

  const login = useCallback(async ({ username, password }) => {
    const uname = (username || '').trim().toLowerCase();
    const pwd = (password || '').toString();

    const found = DUMMY_USERS.find(
      (u) => u.username === uname && u.password === pwd
    );

    if (!found) {
      return { ok: false, error: 'Invalid username or password.' };
    }

    const nextUser = { username: found.username, role: found.role, displayName: found.displayName };
    setUser(nextUser);
    safeSaveAuthState(nextUser);
    return { ok: true, user: nextUser };
  }, []);

  const logout = useCallback(() => {
    setUser(null);
    safeSaveAuthState(null);
  }, []);

  const isAuthenticated = !!user;
  const role = user?.role || null;

  // Editor is the only role allowed to mutate data or drag/move things.
  const canEdit = role === 'editor';

  const value = useMemo(
    () => ({
      user,
      isAuthenticated,
      role,
      canEdit,
      login,
      logout,
      dummyCredentials: DUMMY_USERS.map(({ username, password, role }) => ({ username, password, role })),
    }),
    [user, isAuthenticated, role, canEdit, login, logout]
  );

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

// PUBLIC_INTERFACE
export function useAuth() {
  /** Hook to access auth info: { user, role, canEdit, login, logout }. */
  const ctx = useContext(AuthContext);
  if (!ctx) {
    throw new Error('useAuth must be used within an AuthProvider');
  }
  return ctx;
}
