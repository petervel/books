import { defineStore } from 'pinia';
import { ref, computed } from 'vue';
import api from '../composables/useApi.js';

export const useAuthStore = defineStore('auth', () => {
  const token = ref(localStorage.getItem('token'));
  const user = ref(JSON.parse(localStorage.getItem('user') || 'null'));

  const isAuthenticated = computed(() => !!token.value);

  async function login(email, password) {
    const { data } = await api.post('/auth/login', { email, password });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  async function register(username, email, password) {
    const { data } = await api.post('/auth/register', { username, email, password });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  async function loginWithGoogle(credential) {
    const { data } = await api.post('/auth/google', { credential });
    token.value = data.token;
    user.value = data.user;
    localStorage.setItem('token', data.token);
    localStorage.setItem('user', JSON.stringify(data.user));
  }

  function logout() {
    token.value = null;
    user.value = null;
    localStorage.removeItem('token');
    localStorage.removeItem('user');
  }

  return { token, user, isAuthenticated, login, register, loginWithGoogle, logout };
});
