<template>
  <div class="discover-view">
    <div class="discover-header">
      <h1 class="section-title">Discover</h1>
      <p class="subtitle">Swipe or use buttons to save books to your favorites</p>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Finding books for you...</p>
    </div>

    <div v-else-if="error" class="error-banner">{{ error }}</div>

    <div v-else-if="deck.length === 0" class="empty-deck">
      <div class="empty-icon">🎉</div>
      <h2>You're all caught up!</h2>
      <p>You've gone through all recommendations. Come back later for more!</p>
      <button class="btn btn-primary" @click="loadRecommendations">Refresh</button>
    </div>

    <div v-else class="swipe-container">
      <!-- Cards stack -->
      <div class="card-stack" ref="stackRef">
        <div
          v-for="(book, index) in visibleCards"
          :key="book.book_key"
          :class="['swipe-card', {
            'is-top': index === 0,
            'swiping-left': index === 0 && swipeDir < 0,
            'swiping-right': index === 0 && swipeDir > 0,
          }]"
          :style="cardStyle(index)"
          @mousedown="index === 0 && startDrag($event)"
          @touchstart.passive="index === 0 && startDragTouch($event)"
        >
          <!-- Book cover -->
          <div class="card-cover">
            <img
              v-if="book.cover_id"
              :src="`https://covers.openlibrary.org/b/id/${book.cover_id}-L.jpg`"
              :alt="book.book_title"
            />
            <div v-else class="cover-fallback">
              <span class="cover-emoji">📚</span>
            </div>

            <div v-if="index === 0" class="swipe-indicator">
              <Transition name="fade">
                <div v-if="swipeDir > 40" class="like-badge">❤️ SAVE</div>
              </Transition>
              <Transition name="fade">
                <div v-if="swipeDir < -40" class="nope-badge">✕ SKIP</div>
              </Transition>
            </div>
          </div>

          <!-- Book info -->
          <div class="card-info">
            <div class="card-meta">
              <span v-if="book.first_publish_year" class="year-chip">{{ book.first_publish_year }}</span>
              <span v-if="book.avg_rating" class="rating-chip">⭐ {{ parseFloat(book.avg_rating).toFixed(1) }}</span>
            </div>

            <h2 class="card-title">{{ book.book_title || book.title }}</h2>
            <p class="card-author">by {{ book.book_author }}</p>

            <template v-if="index === 0">
              <p v-if="topCardDescription" class="card-desc">{{ topCardDescription }}</p>
              <p v-else class="card-desc no-desc">
                {{ loadingDesc ? 'Loading description...' : 'No description available for this book.' }}
              </p>
            </template>
          </div>
        </div>
      </div>

      <!-- Action buttons -->
      <div class="action-buttons">
        <button class="action-btn skip-btn" @click="swipe('dislike')" title="Skip">
          <span>✕</span>
        </button>
        <button class="action-btn save-btn" @click="swipe('like')" title="Save to favorites">
          <span>❤️</span>
        </button>
      </div>

      <p class="swipe-hint">{{ deck.length }} books remaining</p>
    </div>

    <!-- Toast notification -->
    <Transition name="slide-up">
      <div v-if="toast.show" :class="['toast', toast.type]">{{ toast.message }}</div>
    </Transition>
  </div>
</template>

<script setup>
import { ref, computed, watch, onMounted, onUnmounted } from 'vue';
import api from '../composables/useApi.js';

const deck = ref([]);
const loading = ref(true);
const error = ref('');
const toast = ref({ show: false, message: '', type: 'success' });

const isDragging = ref(false);
const startX = ref(0);
const swipeDir = ref(0);
const stackRef = ref(null);

const topCardDescription = ref('');
const loadingDesc = ref(false);

const visibleCards = computed(() => deck.value.slice(0, 3));

watch(
  () => deck.value[0],
  async (book) => {
    topCardDescription.value = '';
    if (!book) return;
    const key = book.book_key || book.key;
    if (!key) return;
    loadingDesc.value = true;
    try {
      const { data } = await api.get(`/books/details${key}`);
      topCardDescription.value = data.description || '';
    } catch (_) {
      topCardDescription.value = '';
    } finally {
      loadingDesc.value = false;
    }
  },
  { immediate: true }
);

async function loadRecommendations() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get('/recommendations');
    deck.value = data;
  } catch (err) {
    error.value = 'Could not load recommendations. Please try again.';
  } finally {
    loading.value = false;
  }
}

function cardStyle(index) {
  if (index === 0) {
    const rotate = swipeDir.value * 0.05;
    const translateX = isDragging.value ? swipeDir.value : 0;
    return {
      transform: `translateX(${translateX}px) rotate(${rotate}deg)`,
      zIndex: 30,
      transition: isDragging.value ? 'none' : 'transform 0.4s ease',
    };
  }
  const offset = index * 6;
  const scale = 1 - index * 0.04;
  return {
    transform: `translateY(${offset}px) scale(${scale})`,
    zIndex: 30 - index,
  };
}

function startDrag(e) {
  isDragging.value = true;
  startX.value = e.clientX;
  window.addEventListener('mousemove', onDrag);
  window.addEventListener('mouseup', endDrag);
}

function startDragTouch(e) {
  isDragging.value = true;
  startX.value = e.touches[0].clientX;
  window.addEventListener('touchmove', onDragTouch, { passive: true });
  window.addEventListener('touchend', endDragTouch);
}

function onDrag(e) {
  if (!isDragging.value) return;
  swipeDir.value = e.clientX - startX.value;
}

function onDragTouch(e) {
  if (!isDragging.value) return;
  swipeDir.value = e.touches[0].clientX - startX.value;
}

function endDrag() {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', endDrag);
  if (Math.abs(swipeDir.value) > 100) {
    swipe(swipeDir.value > 0 ? 'like' : 'dislike');
  } else {
    swipeDir.value = 0;
    isDragging.value = false;
  }
}

function endDragTouch() {
  window.removeEventListener('touchmove', onDragTouch);
  window.removeEventListener('touchend', endDragTouch);
  endDrag();
}

async function swipe(decision) {
  if (!deck.value.length) return;
  const book = deck.value[0];

  swipeDir.value = decision === 'like' ? 500 : -500;
  isDragging.value = false;

  setTimeout(() => {
    deck.value.shift();
    swipeDir.value = 0;
  }, 350);

  try {
    await api.post('/recommendations/swipe', {
      bookKey: book.book_key || book.key,
      decision,
      bookTitle: book.book_title || book.title,
      bookAuthor: book.book_author,
      coverId: book.cover_id,
      firstPublishYear: book.first_publish_year,
    });

    if (decision === 'like') {
      showToast('❤️ Added to favorites!', 'success');
    }
  } catch (_) {}
}

function showToast(message, type = 'success') {
  toast.value = { show: true, message, type };
  setTimeout(() => { toast.value.show = false; }, 2500);
}

onMounted(loadRecommendations);
onUnmounted(() => {
  window.removeEventListener('mousemove', onDrag);
  window.removeEventListener('mouseup', endDrag);
});
</script>

<style scoped>
.discover-view {
  padding: 2.5rem;
  display: flex;
  flex-direction: column;
  align-items: center;
  min-height: 100vh;
  background: linear-gradient(160deg, var(--paper) 0%, var(--cream) 100%);
}

.discover-header {
  text-align: center;
  margin-bottom: 2rem;
  width: 100%;
}

.subtitle { color: var(--muted); font-size: 0.95rem; }

.loading-state {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 4rem;
  color: var(--muted);
}

.error-banner {
  padding: 14px 18px;
  background: rgba(184,92,58,0.08);
  color: var(--rust);
  border-radius: var(--radius);
  max-width: 400px;
  text-align: center;
}

.swipe-container {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 24px;
  width: 100%;
  max-width: 440px;
}

.card-stack {
  position: relative;
  width: 100%;
  height: 600px;
}

.swipe-card {
  position: absolute;
  width: 100%;
  border-radius: 20px;
  background: white;
  box-shadow: 0 8px 32px var(--shadow-lg);
  overflow: hidden;
  cursor: grab;
  user-select: none;
  top: 0;
  left: 0;
}

.swipe-card.is-top { cursor: grab; }
.swipe-card.is-top:active { cursor: grabbing; }

.card-cover {
  position: relative;
  height: 340px;
  background: var(--cream);
  overflow: hidden;
}

.card-cover img {
  width: 100%;
  height: 100%;
  object-fit: cover;
}

.cover-fallback {
  width: 100%;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  background: linear-gradient(135deg, var(--cream), var(--border));
}

.cover-emoji { font-size: 5rem; opacity: 0.5; }

.swipe-indicator {
  position: absolute;
  inset: 0;
  pointer-events: none;
}

.like-badge, .nope-badge {
  position: absolute;
  top: 24px;
  padding: 8px 20px;
  border-radius: 8px;
  font-size: 1.2rem;
  font-weight: 700;
  letter-spacing: 0.1em;
  border: 3px solid;
}

.like-badge {
  right: 20px;
  color: #2d8a3e;
  border-color: #2d8a3e;
  background: rgba(45,138,62,0.1);
  transform: rotate(10deg);
}

.nope-badge {
  left: 20px;
  color: var(--rust);
  border-color: var(--rust);
  background: rgba(184,92,58,0.1);
  transform: rotate(-10deg);
}

.card-info {
  padding: 20px;
}

.card-meta {
  display: flex;
  gap: 8px;
  margin-bottom: 10px;
}

.year-chip, .rating-chip {
  padding: 3px 10px;
  border-radius: 20px;
  font-size: 0.78rem;
  font-weight: 500;
}

.year-chip { background: var(--cream); color: var(--muted); }
.rating-chip { background: rgba(201,168,76,0.15); color: #a07a20; }

.card-title {
  font-family: var(--font-display);
  font-size: 1.35rem;
  font-weight: 700;
  line-height: 1.25;
  color: var(--ink);
  margin-bottom: 6px;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
}

.card-author {
  color: var(--muted);
  font-size: 0.9rem;
  margin-bottom: 12px;
}

.card-desc {
  font-size: 0.88rem;
  color: #5a5046;
  line-height: 1.55;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 3;
  -webkit-box-orient: vertical;
}

.no-desc { font-style: italic; opacity: 0.6; }

.action-buttons {
  display: flex;
  gap: 32px;
  align-items: center;
}

.action-btn {
  width: 64px;
  height: 64px;
  border-radius: 50%;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
  box-shadow: 0 4px 16px var(--shadow-lg);
  border: 2px solid var(--border);
  background: white;
  transition: transform var(--transition), box-shadow var(--transition);
  cursor: pointer;
}

.action-btn:hover { transform: scale(1.1); box-shadow: 0 6px 24px var(--shadow-lg); }
.action-btn:active { transform: scale(0.95); }

.skip-btn:hover { border-color: var(--rust); background: rgba(184,92,58,0.05); }
.save-btn {
  width: 72px;
  height: 72px;
  font-size: 1.6rem;
  border-color: #e8a0b4;
  background: rgba(255,182,193,0.1);
}
.save-btn:hover { border-color: #d1466a; background: rgba(209,70,106,0.08); }

.swipe-hint { font-size: 0.8rem; color: var(--muted); }

.empty-deck {
  display: flex;
  flex-direction: column;
  align-items: center;
  gap: 16px;
  padding: 4rem 2rem;
  text-align: center;
}

.empty-icon { font-size: 4rem; }

.empty-deck h2 {
  font-family: var(--font-display);
  font-size: 1.6rem;
}

.empty-deck p { color: var(--muted); max-width: 300px; }

.toast {
  position: fixed;
  bottom: 2rem;
  left: 50%;
  transform: translateX(-50%);
  padding: 12px 24px;
  border-radius: 30px;
  font-weight: 500;
  font-size: 0.95rem;
  box-shadow: 0 4px 16px var(--shadow-lg);
  z-index: 9999;
  white-space: nowrap;
}

.toast.success {
  background: var(--ink);
  color: var(--paper);
}

@media (max-width: 480px) {
  .discover-view { padding: 1.5rem 1rem; }
  .card-stack { height: 560px; }
  .card-cover { height: 300px; }
}
</style>
