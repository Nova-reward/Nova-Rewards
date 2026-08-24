import { useAuthStore } from '../store/authStore';

/**
 * Tests for authStore's persistence behavior.
 *
 * Focus: confirm the `token` field is held in memory only and never
 * written to localStorage, while `user`/`isAuthenticated` continue to be
 * persisted and restored across reloads (the security-boundary contract
 * documented in authStore.js).
 */

const STORAGE_KEY = 'nova-auth-storage';

const mockUser = { id: 'user-1', firstName: 'Ada', stellarPublicKey: 'G...ABC' };
const mockToken = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.mock-payload.mock-signature';

function resetStore() {
  useAuthStore.setState({ user: null, token: null, isAuthenticated: false });
  localStorage.clear();
}

describe('authStore', () => {
  beforeEach(() => {
    resetStore();
  });

  afterEach(() => {
    resetStore();
  });

  it('starts with no user, no token, and isAuthenticated false', () => {
    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);
  });

  it('login sets user, token, and isAuthenticated in memory', () => {
    useAuthStore.getState().login(mockUser, mockToken);

    const state = useAuthStore.getState();
    expect(state.user).toEqual(mockUser);
    expect(state.token).toBe(mockToken);
    expect(state.isAuthenticated).toBe(true);
  });

  it('does not persist token to localStorage after login', () => {
    useAuthStore.getState().login(mockUser, mockToken);

    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();

    const persisted = JSON.parse(raw);
    expect(persisted.state.token).toBeUndefined();
    expect(raw).not.toContain(mockToken);
  });

  it('persists user and isAuthenticated to localStorage after login', () => {
    useAuthStore.getState().login(mockUser, mockToken);

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(persisted.state.user).toEqual(mockUser);
    expect(persisted.state.isAuthenticated).toBe(true);
  });

  it('updateUser merges new fields without reintroducing token into storage', () => {
    useAuthStore.getState().login(mockUser, mockToken);
    useAuthStore.getState().updateUser({ firstName: 'Ngozi' });

    const state = useAuthStore.getState();
    expect(state.user.firstName).toBe('Ngozi');
    expect(state.user.id).toBe(mockUser.id);
    expect(state.token).toBe(mockToken); // still in memory

    const persisted = JSON.parse(localStorage.getItem(STORAGE_KEY));
    expect(persisted.state.token).toBeUndefined();
  });

  it('logout clears in-memory state and leaves no token in persisted storage', () => {
    useAuthStore.getState().login(mockUser, mockToken);
    useAuthStore.getState().logout();

    const state = useAuthStore.getState();
    expect(state.user).toBeNull();
    expect(state.token).toBeNull();
    expect(state.isAuthenticated).toBe(false);

    // Zustand's persist middleware re-writes the storage key on every
    // set() call (including the one inside logout()), so the key itself
    // isn't removed — but it must never contain a token, before or after.
    const raw = localStorage.getItem(STORAGE_KEY);
    expect(raw).not.toBeNull();
    const persisted = JSON.parse(raw);
    expect(persisted.state.token).toBeUndefined();
    expect(persisted.state.user).toBeNull();
    expect(persisted.state.isAuthenticated).toBe(false);
    expect(raw).not.toContain(mockToken);
  });
});