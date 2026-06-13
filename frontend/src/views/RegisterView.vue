<template>
  <div class="auth-page">
    <div class="auth-decoration">
      <div class="deco-text">
        <h1>Start Your<br/><em>Reading Journey.</em></h1>
        <p>Join thousands of readers tracking their literary adventures.</p>
      </div>
      <div class="deco-books">
        <div class="book b1"></div>
        <div class="book b2"></div>
        <div class="book b3"></div>
        <div class="book b4"></div>
        <div class="book b5"></div>
      </div>
    </div>

    <div class="auth-form-container">
      <div class="auth-form-inner">
        <div class="logo">📚 Bookshelf</div>
        <h2>Create account</h2>
        <p class="subtitle">Join the community of readers</p>

        <form @submit.prevent="handleRegister">
          <div class="form-group">
            <label>Username</label>
            <input v-model="username" type="text" class="input-field" placeholder="your_username" required />
          </div>
          <div class="form-group">
            <label>Email</label>
            <input v-model="email" type="email" class="input-field" placeholder="you@example.com" required />
          </div>
          <div class="form-group">
            <label>Password</label>
            <input v-model="password" type="password" class="input-field" placeholder="At least 8 characters" required />
          </div>

          <div v-if="error" class="error-msg">{{ error }}</div>

          <button type="submit" class="btn btn-primary submit-btn" :disabled="loading">
            <span v-if="loading" class="spinner small"></span>
            <span v-else>Create Account</span>
          </button>
        </form>

        <div class="divider"><span>or</span></div>

        <div ref="googleBtnRef" class="google-btn-wrapper"></div>
        <div v-if="googleError" class="error-msg">{{ googleError }}</div>

        <p class="switch-link">
          Already have an account? <RouterLink to="/login">Sign in</RouterLink>
        </p>
      </div>
    </div>
  </div>
</template>

<script setup>
import { ref, onMounted } from 'vue';
import { useRouter } from 'vue-router';
import { useAuthStore } from '../stores/auth.js';

const router = useRouter();
const auth = useAuthStore();

const username = ref('');
const email = ref('');
const password = ref('');
const error = ref('');
const googleError = ref('');
const loading = ref(false);
const googleBtnRef = ref(null);

async function handleRegister() {
  error.value = '';
  loading.value = true;
  try {
    await auth.register(username.value, email.value, password.value);
    router.push('/search');
  } catch (err) {
    error.value = err.response?.data?.error || 'Registration failed';
  } finally {
    loading.value = false;
  }
}

onMounted(() => {
  if (window.google && import.meta.env.VITE_GOOGLE_CLIENT_ID) {
    window.google.accounts.id.initialize({
      client_id: import.meta.env.VITE_GOOGLE_CLIENT_ID,
      callback: async (response) => {
        googleError.value = '';
        try {
          await auth.loginWithGoogle(response.credential);
          router.push('/search');
        } catch (err) {
          googleError.value = err.response?.data?.error || 'Google sign-up failed';
        }
      },
    });
    window.google.accounts.id.renderButton(googleBtnRef.value, {
      theme: 'outline',
      size: 'large',
      width: '368',
    });
  }
});
</script>

<style scoped>
.auth-page {
  display: grid;
  grid-template-columns: 1fr 1fr;
  min-height: 100vh;
}
.auth-decoration {
  background: var(--ink);
  padding: 4rem;
  display: flex;
  flex-direction: column;
  justify-content: space-between;
  position: relative;
  overflow: hidden;
}
.auth-decoration::before {
  content: '';
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse at 70% 30%, rgba(201,168,76,0.15) 0%, transparent 60%);
}
.deco-text { position: relative; z-index: 1; }
.deco-text h1 {
  font-family: var(--font-display);
  font-size: 3.5rem;
  color: var(--paper);
  line-height: 1.15;
  margin-bottom: 1.5rem;
}
.deco-text h1 em { color: var(--gold); font-style: italic; }
.deco-text p { color: rgba(245,240,232,0.65); font-size: 1.05rem; max-width: 320px; }
.deco-books {
  display: flex;
  align-items: flex-end;
  gap: 8px;
  height: 160px;
  position: relative;
  z-index: 1;
}
.book { border-radius: 3px 6px 6px 3px; flex-shrink: 0; }
.b1 { width: 28px; height: 120px; background: #c9845a; }
.b2 { width: 22px; height: 145px; background: #4a7c59; }
.b3 { width: 32px; height: 100px; background: var(--gold); }
.b4 { width: 20px; height: 135px; background: #6b7db3; }
.b5 { width: 26px; height: 110px; background: #c94b4b; }
.auth-form-container {
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 4rem 2rem;
  background: var(--paper);
}
.auth-form-inner { width: 100%; max-width: 400px; }
.logo { font-family: var(--font-display); font-size: 1.4rem; font-weight: 700; color: var(--ink); margin-bottom: 2.5rem; }
h2 { font-family: var(--font-display); font-size: 2rem; color: var(--ink); margin-bottom: 0.4rem; }
.subtitle { color: var(--muted); margin-bottom: 2rem; }
.form-group { margin-bottom: 1.2rem; }
.form-group label { display: block; font-size: 0.85rem; font-weight: 500; color: var(--muted); margin-bottom: 6px; text-transform: uppercase; letter-spacing: 0.05em; }
.error-msg { color: var(--rust); font-size: 0.875rem; margin-bottom: 1rem; padding: 10px 14px; background: rgba(184,92,58,0.08); border-radius: var(--radius); }
.submit-btn { width: 100%; justify-content: center; padding: 13px; font-size: 1rem; margin-top: 0.5rem; }
.spinner.small { width: 18px; height: 18px; border-width: 2px; }
.switch-link { text-align: center; margin-top: 1.5rem; color: var(--muted); font-size: 0.9rem; }
.switch-link a { color: var(--gold); font-weight: 500; }
.divider {
  display: flex;
  align-items: center;
  gap: 12px;
  margin: 1.25rem 0;
  color: var(--muted);
  font-size: 0.8rem;
  letter-spacing: 0.05em;
}
.divider::before,
.divider::after {
  content: '';
  flex: 1;
  height: 1px;
  background: rgba(0,0,0,0.1);
}
.google-btn-wrapper {
  display: flex;
  justify-content: center;
  margin-bottom: 0.5rem;
}
@media (max-width: 768px) { .auth-page { grid-template-columns: 1fr; } .auth-decoration { display: none; } }
</style>
