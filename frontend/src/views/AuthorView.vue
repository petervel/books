<template>
  <div class="author-view">
    <button class="back-btn" @click="router.back()">← Back</button>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Loading author...</p>
    </div>

    <div v-else-if="error" class="error-banner">{{ error }}</div>

    <div v-else>
      <!-- Author header -->
      <div class="author-header">
        <div class="author-photo-wrap">
          <img
            v-if="photoSrc"
            :src="photoSrc"
            :alt="author.name"
            class="author-photo"
          />
          <div v-else class="photo-placeholder">✍️</div>
        </div>

        <div class="author-header-info">
          <h1 class="author-name">{{ author.name }}</h1>
          <div class="author-dates">
            <span v-if="author.birthDate">{{ author.birthDate }}</span>
            <span v-if="author.birthDate && author.deathDate"> – </span>
            <span v-if="author.deathDate">{{ author.deathDate }}</span>
          </div>

          <p v-if="author.bio" class="author-bio">{{ author.bio }}</p>

          <button
            class="btn"
            :class="isFollowing ? 'btn-gold' : 'btn-outline'"
            @click="toggleFollow"
            :disabled="followLoading"
          >
            {{ isFollowing ? '❤️ Following' : '♡ Follow' }}
          </button>
        </div>
      </div>

      <!-- Works -->
      <section class="works-section">
        <div v-if="worksLoading && works.length === 0" class="loading-inline"><div class="spinner"></div></div>

        <div v-else-if="works.length === 0" class="empty-state">
          <p>No works found.</p>
        </div>

        <template v-else>
          <template v-if="readWorks.length">
            <h2 class="section-heading">Read ({{ readWorks.length }})</h2>
            <div class="works-grid">
              <RouterLink
                v-for="work in readWorks"
                :key="work.key"
                :to="`/book${work.key}`"
                class="work-card card"
              >
                <WorkCover :work="work" />
                <div class="work-info">
                  <p class="work-title">{{ work.title }}</p>
                  <p v-if="work.firstPublishDate" class="work-year">{{ work.firstPublishDate }}</p>
                  <div class="work-read-badge">✓ Read</div>
                </div>
              </RouterLink>
            </div>
          </template>

          <h2 class="section-heading" :style="readWorks.length ? 'margin-top: 2rem' : ''">
            {{ readWorks.length ? `Unread (${unreadWorks.length})` : `Works (${unreadWorks.length})` }}
          </h2>

          <div v-if="unreadWorks.length === 0" class="empty-state">
            <p>You've read everything by this author!</p>
          </div>
          <div v-else class="works-grid">
            <RouterLink
              v-for="work in unreadWorks"
              :key="work.key"
              :to="`/book${work.key}`"
              class="work-card card"
            >
              <WorkCover :work="work" />
              <div class="work-info">
                <p class="work-title">{{ work.title }}</p>
                <p v-if="work.firstPublishDate" class="work-year">{{ work.firstPublishDate }}</p>
                <div v-if="store.isInQueue(work.key)" class="work-queue-badge">📚 Queued</div>
              </div>
            </RouterLink>
          </div>
        </template>

        <div v-if="worksLoading && works.length > 0" class="loading-inline"><div class="spinner"></div></div>

        <button
          v-if="hasMore && !worksLoading"
          class="btn btn-outline load-more-btn"
          @click="loadMoreWorks"
        >
          Load more works
        </button>
      </section>
    </div>
  </div>
</template>

<script setup>
import { ref, computed, onMounted, watch, defineComponent, h } from 'vue';
import { useRoute, useRouter } from 'vue-router';
import { useBooksStore } from '../stores/books.js';
import api from '../composables/useApi.js';

const WorkCover = defineComponent({
  props: { work: Object },
  setup(props) {
    return () => h('div', { class: 'work-cover-wrap' }, [
      props.work.covers?.length
        ? h('img', {
            src: `https://covers.openlibrary.org/b/id/${props.work.covers[0]}-M.jpg`,
            alt: props.work.title,
            class: 'work-cover',
          })
        : h('div', { class: 'work-cover-placeholder' }, '📚'),
    ]);
  },
});

const route = useRoute();
const router = useRouter();
const store = useBooksStore();

const author = ref(null);
const works = ref([]);
const loading = ref(true);
const worksLoading = ref(false);
const error = ref('');
const followLoading = ref(false);
const totalWorks = ref(0);
const worksOffset = ref(0);
const WORKS_LIMIT = 20;

// route.params.key = 'OL23919A', backend normalizes to /authors/OL23919A
const authorKey = computed(() => `/authors/${route.params.key}`);

const photoSrc = computed(() => {
  if (!author.value?.photos?.length) return null;
  return `https://covers.openlibrary.org/a/id/${author.value.photos[0]}-L.jpg`;
});

const isFollowing = computed(() => store.isAuthorFavorite(authorKey.value));

const hasMore = computed(() => worksOffset.value < totalWorks.value);

function normalizeTitle(title) {
  return (title || '')
    .toLowerCase()
    .replace(/\s*[:(].+$/, '')     // strip subtitle after : or (
    .replace(/[^\w\s]/g, ' ')      // strip punctuation
    .replace(/\s+/g, ' ')
    .trim();
}

function deduplicateWorks(list) {
  const groups = new Map();
  for (const work of list) {
    const key = normalizeTitle(work.title);
    if (!key) continue;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key).push(work);
  }
  return Array.from(groups.values()).map(group => {
    // Pick the representative: prefer works with a cover, then highest edition count
    return [...group].sort((a, b) => {
      const aCover = a.covers?.length ? 1 : 0;
      const bCover = b.covers?.length ? 1 : 0;
      if (bCover !== aCover) return bCover - aCover;
      return (b.editionCount || 0) - (a.editionCount || 0);
    })[0];
  });
}

function sortWorks(list) {
  const hasEditionCounts = list.some(w => w.editionCount != null);
  return [...list].sort((a, b) => {
    if (hasEditionCounts) {
      return (b.editionCount || 0) - (a.editionCount || 0);
    }
    const yearA = parseInt(a.firstPublishDate) || 0;
    const yearB = parseInt(b.firstPublishDate) || 0;
    return yearB - yearA;
  });
}

const readWorks = computed(() => sortWorks(works.value.filter(w => store.isBookRead(w.key))));
const unreadWorks = computed(() => sortWorks(works.value.filter(w => !store.isBookRead(w.key))));

async function fetchAuthor() {
  loading.value = true;
  error.value = '';
  try {
    const { data } = await api.get(`/books/author/${route.params.key}`);
    author.value = data;
    await fetchWorks(true);
  } catch (err) {
    error.value = 'Could not load author.';
  } finally {
    loading.value = false;
  }
}

async function fetchWorks(reset = false) {
  if (reset) {
    works.value = [];
    worksOffset.value = 0;
  }
  worksLoading.value = true;
  try {
    const { data } = await api.get(`/books/author-works/${route.params.key}`, {
      params: { limit: WORKS_LIMIT, offset: worksOffset.value },
    });
    totalWorks.value = data.size;
    worksOffset.value += data.works.length;
    works.value = deduplicateWorks([...works.value, ...data.works]);
  } catch (_) {}
  worksLoading.value = false;
}

async function loadMoreWorks() {
  await fetchWorks(false);
}

async function toggleFollow() {
  if (!author.value) return;
  followLoading.value = true;
  try {
    if (isFollowing.value) {
      await store.removeFavoriteAuthor(authorKey.value);
    } else {
      await store.addFavoriteAuthor({
        authorKey: authorKey.value,
        authorName: author.value.name,
        birthDate: author.value.birthDate,
        bio: author.value.bio,
        photoId: author.value.photos?.[0],
      });
    }
  } finally {
    followLoading.value = false;
  }
}

onMounted(fetchAuthor);
watch(() => route.params.key, fetchAuthor);
</script>

<style scoped>
.author-view {
  padding: 2rem 2.5rem;
  max-width: 1000px;
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

.author-header {
  display: flex;
  gap: 2rem;
  margin-bottom: 3rem;
  align-items: flex-start;
}

.author-photo-wrap { flex-shrink: 0; }

.author-photo {
  width: 140px;
  height: 180px;
  object-fit: cover;
  border-radius: 8px;
  box-shadow: 0 4px 16px var(--shadow-lg);
}

.photo-placeholder {
  width: 140px;
  height: 180px;
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: 8px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 3.5rem;
}

.author-header-info { flex: 1; }

.author-name {
  font-family: var(--font-display);
  font-size: 2rem;
  font-weight: 700;
  color: var(--ink);
  margin-bottom: 0.4rem;
}

.author-dates {
  font-size: 0.9rem;
  color: var(--muted);
  margin-bottom: 1rem;
}

.author-bio {
  font-size: 0.95rem;
  line-height: 1.7;
  color: #4a4038;
  margin-bottom: 1.5rem;
  max-width: 600px;
}

.section-heading {
  font-family: var(--font-display);
  font-size: 1.4rem;
  color: var(--ink);
  margin-bottom: 1.5rem;
}

.works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
  gap: 16px;
  margin-bottom: 1.5rem;
}

.work-card {
  text-decoration: none;
  display: flex;
  flex-direction: column;
  gap: 8px;
  padding: 10px;
  transition: transform var(--transition), box-shadow var(--transition);
}

.work-card:hover {
  transform: translateY(-3px);
  box-shadow: 0 6px 20px var(--shadow-lg);
}

.work-cover-wrap { width: 100%; }

.work-cover {
  width: 100%;
  aspect-ratio: 2/3;
  object-fit: cover;
  border-radius: 4px;
}

.work-cover-placeholder {
  width: 100%;
  aspect-ratio: 2/3;
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 2rem;
}

.work-info {}

.work-title {
  font-size: 0.85rem;
  font-weight: 600;
  color: var(--ink);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.35;
}

.work-year {
  font-size: 0.75rem;
  color: var(--muted);
  margin-top: 2px;
}

.work-read-badge, .work-queue-badge {
  font-size: 0.72rem;
  padding: 2px 8px;
  border-radius: 10px;
  margin-top: 4px;
  display: inline-block;
}

.work-read-badge { background: rgba(45,138,62,0.1); color: #2d8a3e; }
.work-queue-badge { background: rgba(201,168,76,0.15); color: #8a6d10; }

.load-more-btn { margin: 0 auto; display: block; }

.loading-inline { display: flex; justify-content: center; padding: 2rem; }

@media (max-width: 640px) {
  .author-view { padding: 1.5rem; }
  .author-header { flex-direction: column; }
  .author-photo, .photo-placeholder { width: 100px; height: 130px; }
  .works-grid { grid-template-columns: repeat(auto-fill, minmax(110px, 1fr)); }
}
</style>
