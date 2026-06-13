<template>
  <div class="book-detail-view">
    <button class="back-btn" @click="router.back()">← Back</button>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading book details...</p>
    </div>

    <div v-else-if="error" class="error-banner">{{ error }}</div>

    <div v-else class="book-layout">
      <!-- Cover column -->
      <div class="cover-col">
        <img
          v-if="coverSrc"
          :src="coverSrc"
          :alt="title"
          class="detail-cover"
        />
        <div v-else class="cover-placeholder-lg">📚</div>

        <div class="detail-actions">
          <button
            class="btn btn-primary action-full"
            :class="{ 'btn-gold': isFavorite }"
            @click="toggleFavorite"
          >
            {{ isFavorite ? '❤️ Saved to Favorites' : '♡ Save to Favorites' }}
          </button>
          <button
            class="btn btn-outline action-full"
            :class="{ 'btn-primary': isQueued }"
            @click="toggleQueue"
            :disabled="queueLoading"
          >
            {{ isQueued ? '✓ In Reading Queue' : '📚 Add to Queue' }}
          </button>
          <button
            class="btn btn-outline action-full"
            :class="{ 'btn-primary': isRead }"
            @click="toggleRead"
          >
            {{ isRead ? '✓ Already Read' : '+ Mark as Read' }}
          </button>
        </div>
      </div>

      <!-- Info column -->
      <div class="info-col">
        <h1 class="detail-title">{{ title }}</h1>

        <div v-if="authorPairs.length" class="authors-line">
          by
          <template v-for="(pair, i) in authorPairs" :key="pair.key || i">
            <RouterLink v-if="pair.key" :to="`/author/${pair.key.replace('/authors/', '')}`" class="author-link">
              {{ pair.name }}
            </RouterLink>
            <span v-else>{{ pair.name }}</span>
            <span v-if="i < authorPairs.length - 1">, </span>
          </template>
        </div>

        <div class="detail-chips">
          <span v-if="firstPublishDate" class="chip">{{ firstPublishDate }}</span>
        </div>

        <div class="description-block">
          <p v-if="details?.description" class="detail-desc">{{ details.description }}</p>
          <p v-else class="detail-desc no-desc">No description available.</p>
        </div>

        <div v-if="details?.subjects?.length" class="subjects">
          <span v-for="s in details.subjects" :key="s" class="subject-tag">{{ s }}</span>
        </div>
      </div>
    </div>

    <ReadModal
      v-if="readModalOpen"
      :book="readModalBook"
      @close="readModalOpen = false"
      @confirm="confirmRead"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBooksStore } from '../stores/books.js';
import api from '../composables/useApi.js';
import ReadModal from '../components/ReadModal.vue';

const route = useRoute();
const router = useRouter();
const store = useBooksStore();

const details = ref(null);
const fetchedAuthorNames = ref([]);
const loading = ref(true);
const error = ref('');
const queueLoading = ref(false);
const readModalOpen = ref(false);

// Book key from route: /book/works/OL45804W → params.key = 'works/OL45804W'
const bookKey = computed(() => {
  const k = route.params.key;
  return k.startsWith('/') ? k : `/${k}`;
});

// Prefer data from OL details response; fall back to query params for fast initial render
const title = computed(() => details.value?.title || route.query.t || '');
const firstPublishDate = computed(() => details.value?.firstPublishDate || null);

const coverSrc = computed(() => {
  const coverId = details.value?.covers?.[0] || route.query.c;
  return coverId ? `https://covers.openlibrary.org/b/id/${coverId}-L.jpg` : null;
});

// Author names from navigation query params take priority;
// otherwise use names fetched from the author API after work details load.
const authorPairs = computed(() => {
  const namesFromQuery = (route.query.a || '').split('|').filter(Boolean);
  const keysFromDetails = details.value?.authorKeys || [];
  const keysFromQuery = (route.query.aks || '').split('|').filter(Boolean);
  const allKeys = [...new Set([...keysFromDetails, ...keysFromQuery])];

  if (namesFromQuery.length) {
    return namesFromQuery.map((name, i) => ({ name, key: allKeys[i] || null }));
  }

  return fetchedAuthorNames.value;
});

const readModalBook = computed(() => ({
  key: bookKey.value,
  title: title.value,
  coverId: details.value?.covers?.[0] || route.query.c,
  bookAuthor: authorPairs.value.map(p => p.name).join(', '),
}));

const isFavorite = computed(() => store.isBookFavorite(bookKey.value));
const isQueued = computed(() => !!store.isInQueue(bookKey.value));
const isRead = computed(() => !!store.isBookRead(bookKey.value));

async function fetchDetails() {
  loading.value = true;
  error.value = '';
  fetchedAuthorNames.value = [];
  try {
    const { data } = await api.get(`/books/details${bookKey.value}`);
    details.value = data;

    // Fetch author names when not provided via navigation query params
    if (!route.query.a && data.authorKeys?.length) {
      const results = await Promise.all(
        data.authorKeys.slice(0, 3).map(async (key) => {
          try {
            const { data: a } = await api.get(`/books/author${key}`);
            return { key, name: a.name };
          } catch {
            return null;
          }
        })
      );
      fetchedAuthorNames.value = results.filter(Boolean);
    }
  } catch (err) {
    error.value = 'Could not load book details.';
  } finally {
    loading.value = false;
  }
}

async function toggleFavorite() {
  if (isFavorite.value) {
    await store.removeFavoriteBook(bookKey.value);
  } else {
    await store.addFavoriteBook({
      bookKey: bookKey.value,
      bookTitle: title.value,
      bookAuthor: authorPairs.value.map(p => p.name).join(', '),
      coverId: details.value?.covers?.[0] || route.query.c,
      firstPublishYear: null,
    });
  }
}

async function toggleQueue() {
  queueLoading.value = true;
  try {
    if (isQueued.value) {
      await store.removeFromQueue(bookKey.value);
    } else {
      await store.addToQueue({
        key: bookKey.value,
        title: title.value,
        authors: authorPairs.value.map(p => p.name),
        coverId: details.value?.covers?.[0] || route.query.c,
      });
    }
  } finally {
    queueLoading.value = false;
  }
}

function toggleRead() {
  if (isRead.value) {
    store.unmarkAsRead(bookKey.value);
  } else {
    readModalOpen.value = true;
  }
}

async function confirmRead({ rating, notes }) {
  await store.markAsRead({
    bookKey: bookKey.value,
    bookTitle: title.value,
    bookAuthor: authorPairs.value.map(p => p.name).join(', '),
    coverId: details.value?.covers?.[0] || route.query.c,
    rating,
    notes,
  });
  readModalOpen.value = false;
}

onMounted(fetchDetails);
watch(() => route.params.key, fetchDetails);
</script>

<style scoped>
.book-detail-view {
  padding: 2rem 2.5rem;
  max-width: 960px;
}

.back-btn {
  color: var(--muted);
  font-size: 0.9rem;
  cursor: pointer;
  margin-bottom: 2rem;
  display: inline-flex;
  align-items: center;
  gap: 4px;
  transition: color var(--transition);
}

.back-btn:hover { color: var(--ink); }

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
}

.book-layout {
  display: grid;
  grid-template-columns: 220px 1fr;
  gap: 3rem;
  align-items: start;
}

.cover-col {
  display: flex;
  flex-direction: column;
  gap: 16px;
}

.detail-cover {
  width: 100%;
  border-radius: 8px;
  box-shadow: 0 8px 32px var(--shadow-lg);
}

.cover-placeholder-lg {
  width: 100%;
  aspect-ratio: 2/3;
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 4rem;
}

.detail-actions {
  display: flex;
  flex-direction: column;
  gap: 8px;
}

.action-full { width: 100%; justify-content: center; }

.info-col {}

.detail-title {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  line-height: 1.2;
  color: var(--ink);
  margin-bottom: 0.5rem;
}

.authors-line {
  font-size: 1rem;
  color: var(--muted);
  margin-bottom: 1rem;
}

.author-link {
  color: var(--ink);
  text-decoration: none;
  font-weight: 500;
  transition: color var(--transition);
}

.author-link:hover { color: var(--gold); }

.detail-chips {
  display: flex;
  gap: 8px;
  flex-wrap: wrap;
  margin-bottom: 1.5rem;
}

.chip {
  padding: 4px 12px;
  background: var(--cream);
  border-radius: 20px;
  font-size: 0.82rem;
  color: var(--muted);
}

.description-block {
  margin-bottom: 1.5rem;
}

.detail-desc {
  font-size: 1rem;
  line-height: 1.7;
  color: #4a4038;
}

.no-desc { font-style: italic; opacity: 0.6; }

.subjects {
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
}

.subject-tag {
  padding: 4px 12px;
  background: rgba(201,168,76,0.1);
  border: 1px solid rgba(201,168,76,0.3);
  border-radius: 20px;
  font-size: 0.8rem;
  color: #8a6d10;
}

@media (max-width: 720px) {
  .book-detail-view { padding: 1.5rem; }
  .book-layout {
    grid-template-columns: 1fr;
  }
  .cover-col {
    flex-direction: row;
    align-items: flex-start;
    gap: 1.5rem;
  }
  .detail-cover, .cover-placeholder-lg {
    width: 120px;
    flex-shrink: 0;
  }
  .detail-actions { flex: 1; }
}
</style>
