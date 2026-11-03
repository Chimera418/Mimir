import { create } from 'zustand';
import api from '../services/api';

const useAuthStore = create((set) => ({
  user: null,
  token: localStorage.getItem('mimir_token') || null,
  isAuthenticated: !!localStorage.getItem('mimir_token'),
  isLoading: true,

  login: async (email, password) => {
    try {
      const res = await api.post('/auth/login', { email, password });
      const { token } = res.data.data;
      localStorage.setItem('mimir_token', token);
      set({ token, isAuthenticated: true });
      await useAuthStore.getState().fetchUser();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Login failed' };
    }
  },

  register: async (username, email, password) => {
    try {
      const res = await api.post('/auth/register', { username, email, password });
      const { token } = res.data.data;
      localStorage.setItem('mimir_token', token);
      set({ token, isAuthenticated: true });
      await useAuthStore.getState().fetchUser();
      return { success: true };
    } catch (error) {
      return { success: false, error: error.response?.data?.message || 'Registration failed' };
    }
  },

  logout: () => {
    localStorage.removeItem('mimir_token');
    set({ user: null, token: null, isAuthenticated: false });
  },

  fetchUser: async () => {
    const { token } = useAuthStore.getState();
    if (!token) {
      set({ isLoading: false });
      return;
    }
    
    try {
      const res = await api.get('/auth/me');
      set({ user: res.data.data.user, isAuthenticated: true, isLoading: false });
    } catch (error) {
      localStorage.removeItem('mimir_token');
      set({ user: null, token: null, isAuthenticated: false, isLoading: false });
    }
  }
}));

export default useAuthStore;
