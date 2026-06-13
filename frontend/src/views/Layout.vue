<template>
  <div class="app-shell">
    <nav class="sidebar">
      <div class="sidebar-logo">📚 <span>Bookshelf</span></div>

      <div class="nav-links">
        <RouterLink to="/search" class="nav-item">
          <span class="nav-icon">🔍</span>
          <span>Search</span>
        </RouterLink>
        <RouterLink to="/favorites" class="nav-item">
          <span class="nav-icon">❤️</span>
          <span>Favorites</span>
        </RouterLink>
        <RouterLink to="/reading-list" class="nav-item">
          <span class="nav-icon">📖</span>
          <span>Reading List</span>
        </RouterLink>
        <RouterLink to="/discover" class="nav-item">
          <span class="nav-icon">✨</span>
          <span>Discover</span>
        </RouterLink>
      </div>

      <div class="sidebar-footer">
        <div class="user-info">
          <div class="user-avatar">{{ userInitial }}</div>
          <div>
            <div class="user-name">{{ auth.user?.username }}</div>
            <button class="logout-btn" @click="handleLogout">Sign out</button>
          </div>
        </div>
      </div>
    </nav>

    <div class="mobile-nav">
      <RouterLink to="/search" class="mob-item">
        <span class="mob-icon">🔍</span>
        <span class="mob-label">Search</span>
      </RouterLink>
      <RouterLink to="/favorites" class="mob-item">
        <span class="mob-icon">❤️</span>
        <span class="mob-label">Favorites</span>
      </RouterLink>
      <RouterLink to="/reading-list" class="mob-item">
        <span class="mob-icon">📖</span>
        <span class="mob-label">Reading</span>
      </RouterLink>
      <RouterLink to="/discover" class="mob-item">
        <span class="mob-icon">✨</span>
        <span class="mob-label">Discover</span>
      </RouterLink>
    </div>

    <main class="main-content">
      <RouterView />
    </main>
  </div>
</template>

<script setup>
import { computed, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';
import { useBooksStore } from '../stores/books.js';

const auth = useAuthStore();
const books = useBooksStore();
const router = useRouter();

const userInitial = computed(() => auth.user?.username?.charAt(0).toUpperCase() || 'U');

onMounted(() => books.loadAll());

function handleLogout() {
  auth.logout();
  router.push('/login');
}
</script>

<style scoped>
.app-shell {
  display: flex;
  min-height: 100vh;
}

.sidebar {
  width: 240px;
  background: var(--ink);
  display: flex;
  flex-direction: column;
  padding: 1.5rem;
  flex-shrink: 0;
  position: sticky;
  top: 0;
  height: 100vh;
}

.sidebar-logo {
  font-family: var(--font-display);
  font-size: 1.3rem;
  font-weight: 700;
  color: var(--paper);
  margin-bottom: 2.5rem;
  display: flex;
  align-items: center;
  gap: 8px;
}

.sidebar-logo span { color: var(--gold); }

.nav-links {
  flex: 1;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.nav-item {
  display: flex;
  align-items: center;
  gap: 10px;
  padding: 10px 14px;
  border-radius: var(--radius);
  color: rgba(245,240,232,0.6);
  font-size: 0.95rem;
  transition: all var(--transition);
  text-decoration: none;
}

.nav-item:hover {
  background: rgba(245,240,232,0.08);
  color: var(--paper);
}

.nav-item.router-link-active {
  background: rgba(201,168,76,0.15);
  color: var(--gold-light);
}

.nav-icon { font-size: 1.1rem; }

.sidebar-footer {
  border-top: 1px solid rgba(245,240,232,0.1);
  padding-top: 1rem;
}

.user-info {
  display: flex;
  align-items: center;
  gap: 10px;
}

.user-avatar {
  width: 36px;
  height: 36px;
  background: var(--gold);
  color: var(--ink);
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-weight: 700;
  font-size: 0.9rem;
  flex-shrink: 0;
}

.user-name {
  color: var(--paper);
  font-size: 0.9rem;
  font-weight: 500;
}

.logout-btn {
  color: rgba(245,240,232,0.4);
  font-size: 0.75rem;
  cursor: pointer;
  transition: color var(--transition);
}

.logout-btn:hover { color: var(--rust); }

.main-content {
  flex: 1;
  overflow-y: auto;
  min-height: 100vh;
}

.mobile-nav {
  display: none;
  position: fixed;
  bottom: 0;
  left: 0;
  right: 0;
  background: var(--ink);
  padding: 6px 0 8px;
  z-index: 100;
  justify-content: space-around;
}

.mob-item {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 2px;
  padding: 6px 16px;
  border-radius: var(--radius);
  transition: background var(--transition);
  text-decoration: none;
}

.mob-item.router-link-active {
  background: rgba(201,168,76,0.2);
}

.mob-icon { font-size: 1.3rem; }

.mob-label {
  font-size: 0.65rem;
  color: rgba(245,240,232,0.6);
  letter-spacing: 0.02em;
}

.mob-item.router-link-active .mob-label {
  color: var(--gold-light);
}

@media (max-width: 768px) {
  .sidebar { display: none; }
  .mobile-nav { display: flex; }
  .main-content { padding-bottom: 70px; }
}
</style>
