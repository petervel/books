<template>
  <div class="favorites-view">
    <h1 class="section-title">Favorites</h1>

    <div class="tabs">
      <button :class="['tab', tab === 'books' ? 'active' : '']" @click="tab = 'books'">
        📚 Books ({{ store.favoriteBooks.length }})
      </button>
      <button :class="['tab', tab === 'authors' ? 'active' : '']" @click="tab = 'authors'">
        ✍️ Authors ({{ store.favoriteAuthors.length }})
      </button>
    </div>

    <!-- Favorite Books -->
    <div v-if="tab === 'books'">
      <div v-if="store.favoriteBooks.length === 0" class="empty-state">
        <div class="icon">📚</div>
        <p>No favorite books yet. Search for books and save them here!</p>
      </div>
      <div v-else class="books-grid">
        <div v-for="book in store.favoriteBooks" :key="book.id" class="fav-book card">
          <RouterLink :to="bookRoute(book.book_key)" class="cover-link">
            <img
              v-if="book.cover_id"
              :src="`https://covers.openlibrary.org/b/id/${book.cover_id}-M.jpg`"
              :alt="book.book_title"
              class="cover-img"
            />
            <div v-else class="no-cover">📚</div>
          </RouterLink>
          <div class="book-details">
            <RouterLink :to="bookRoute(book.book_key)" class="book-title-link">
              <h3>{{ book.book_title }}</h3>
            </RouterLink>
            <p class="by">{{ book.book_author }}</p>
            <p v-if="book.first_publish_year" class="year">{{ book.first_publish_year }}</p>

            <div v-if="readEntry(book.book_key)" class="read-badge">
              <span v-for="n in 5" :key="n" :class="['star', n <= readEntry(book.book_key).rating ? 'filled' : '']">★</span>
            </div>

            <div class="actions">
              <button
                class="btn btn-sm"
                :class="readEntry(book.book_key) ? 'btn-primary' : 'btn-outline'"
                @click="handleToggleRead(book)"
              >
                {{ readEntry(book.book_key) ? '✓ Read' : '+ Mark read' }}
              </button>
              <button
                class="btn btn-sm"
                :class="store.isInQueue(book.book_key) ? 'btn-primary' : 'btn-outline'"
                @click="handleToggleQueue(book)"
              >
                {{ store.isInQueue(book.book_key) ? '✓ Queued' : '📚 Queue' }}
              </button>
              <button class="btn btn-sm btn-outline" @click="store.removeFavoriteBook(book.book_key)">
                Remove
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>

    <!-- Favorite Authors -->
    <div v-if="tab === 'authors'">
      <div v-if="store.favoriteAuthors.length === 0" class="empty-state">
        <div class="icon">✍️</div>
        <p>No favorite authors yet. Search for authors and follow them!</p>
      </div>

      <div v-else>
        <!-- Unread works section -->
        <div class="unread-section" v-if="filteredUnreadWorks.length || loadingUnread">
          <h2 class="subsection-title">Unread by your authors</h2>
          <div v-if="loadingUnread" class="loading-inline"><div class="spinner"></div></div>
          <div v-else class="unread-works-grid">
            <div v-for="work in filteredUnreadWorks" :key="work.key" class="work-card card">
              <RouterLink :to="`/book${work.key}`" class="work-cover-link">
                <img
                  v-if="work.covers?.length"
                  :src="`https://covers.openlibrary.org/b/id/${work.covers[0]}-M.jpg`"
                  :alt="work.title"
                  class="work-cover"
                />
                <div v-else class="work-cover no-cover-md">📚</div>
              </RouterLink>
              <div class="work-info">
                <RouterLink :to="`/book${work.key}`" class="work-title">{{ work.title }}</RouterLink>
                <RouterLink
                  :to="`/author/${work.authorKey.replace('/authors/', '')}`"
                  class="work-author"
                >{{ work.authorName }}</RouterLink>
                <div class="work-actions">
                  <button
                    class="btn btn-sm"
                    :class="store.isInQueue(work.key) ? 'btn-primary' : 'btn-outline'"
                    @click="handleWorkQueue(work)"
                  >
                    {{ store.isInQueue(work.key) ? '✓ Queued' : '📚 Queue' }}
                  </button>
                  <button class="btn btn-sm btn-outline" @click="handleWorkRead(work)">✓ Read</button>
                  <button class="btn btn-sm btn-ghost" @click="handleNotInterested(work)">✕ Not interested</button>
                </div>
              </div>
            </div>
          </div>
        </div>

        <h2 class="subsection-title">Authors you follow</h2>
        <div class="authors-list">
          <div v-for="author in store.favoriteAuthors" :key="author.id" class="author-row card">
            <RouterLink :to="`/author/${author.author_key.replace('/authors/', '')}`" class="author-photo-link">
              <div class="author-photo">
                <img
                  v-if="author.photo_id"
                  :src="`https://covers.openlibrary.org/a/id/${author.photo_id}-M.jpg`"
                  :alt="author.author_name"
                />
                <div v-else class="photo-placeholder">✍️</div>
              </div>
            </RouterLink>
            <div class="author-details">
              <RouterLink :to="`/author/${author.author_key.replace('/authors/', '')}`" class="author-name-link">
                <h3>{{ author.author_name }}</h3>
              </RouterLink>
              <p v-if="author.birth_date" class="birth">Born {{ author.birth_date }}</p>
              <p v-if="author.bio" class="bio">{{ author.bio.slice(0, 200) }}{{ author.bio.length > 200 ? '...' : '' }}</p>
            </div>
            <button class="btn btn-sm btn-outline remove-btn" @click="store.removeFavoriteAuthor(author.author_key)">
              Unfollow
            </button>
          </div>
        </div>
      </div>
    </div>

    <ReadModal
      v-if="readModalBook"
      :book="readModalBook"
      @close="readModalBook = null"
      @confirm="confirmRead"
    />
  </div>
</template>

<script setup>
import { ref, computed, onMounted } from 'vue';
import { useBooksStore } from '../stores/books.js';
import api from '../composables/useApi.js';
import ReadModal from '../components/ReadModal.vue';

const store = useBooksStore();
const tab = ref('books');
const unreadWorks = ref([]);
const loadingUnread = ref(false);
const readModalBook = ref(null);
let pendingReadWork = null;

const filteredUnreadWorks = computed(() =>
  unreadWorks.value.filter(w =>
    !store.isBookRead(w.key) && !store.isNotInterested(w.key)
  )
);

function bookRoute(bookKey) {
  const key = bookKey.startsWith('/') ? bookKey : `/${bookKey}`;
  return `/book${key}`;
}

function readEntry(bookKey) {
  return store.isBookRead(bookKey);
}

function handleToggleRead(book) {
  const existing = readEntry(book.book_key);
  if (existing) {
    store.unmarkAsRead(book.book_key);
  } else {
    readModalBook.value = {
      key: book.book_key,
      title: book.book_title,
      bookAuthor: book.book_author,
      coverId: book.cover_id,
      firstPublishYear: book.first_publish_year,
    };
  }
}

async function handleToggleQueue(book) {
  if (store.isInQueue(book.book_key)) {
    await store.removeFromQueue(book.book_key);
  } else {
    await store.addToQueue(book);
  }
}

function handleWorkRead(work) {
  pendingReadWork = work;
  readModalBook.value = {
    key: work.key,
    title: work.title,
    bookAuthor: work.authorName,
    coverId: work.covers?.[0],
  };
}

async function handleWorkQueue(work) {
  if (store.isInQueue(work.key)) {
    await store.removeFromQueue(work.key);
  } else {
    await store.addToQueue(work);
  }
}

async function handleNotInterested(work) {
  await store.markNotInterested(work.key);
}

async function confirmRead({ rating, notes }) {
  const book = readModalBook.value;
  await store.markAsRead({
    bookKey: book.key,
    bookTitle: book.title,
    bookAuthor: book.bookAuthor,
    coverId: book.coverId,
    firstPublishYear: book.firstPublishYear,
    rating,
    notes,
  });
  if (pendingReadWork) {
    await store.removeFromQueue(pendingReadWork.key);
    pendingReadWork = null;
  }
  readModalBook.value = null;
}

onMounted(async () => {
  loadingUnread.value = true;
  try {
    const { data } = await api.get('/authors/unread-works');
    unreadWorks.value = data;
  } catch (_) {}
  loadingUnread.value = false;
});
</script>

<style scoped>
.favorites-view { padding: 2.5rem; max-width: 1100px; }

.tabs {
  display: flex;
  gap: 4px;
  background: var(--cream);
  padding: 4px;
  border-radius: 8px;
  width: fit-content;
  margin-bottom: 2rem;
}

.tab {
  padding: 8px 20px;
  border-radius: 6px;
  font-size: 0.9rem;
  font-weight: 500;
  color: var(--muted);
  cursor: pointer;
  transition: all var(--transition);
}

.tab.active {
  background: white;
  color: var(--ink);
  box-shadow: 0 1px 4px var(--shadow);
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(300px, 1fr));
  gap: 16px;
}

.fav-book {
  display: flex;
  gap: 14px;
  padding: 14px;
}

.cover-link { flex-shrink: 0; text-decoration: none; }

.cover-img {
  width: 65px;
  height: 92px;
  object-fit: cover;
  border-radius: 4px;
  transition: opacity var(--transition);
}

.cover-img:hover { opacity: 0.85; }

.no-cover {
  width: 65px;
  height: 92px;
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.5rem;
}

.book-details { flex: 1; min-width: 0; }

.book-title-link { text-decoration: none; }

.book-details h3 {
  font-family: var(--font-display);
  font-size: 0.95rem;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 4px;
  color: var(--ink);
  transition: color var(--transition);
}

.book-title-link:hover h3 { color: var(--gold); }

.by, .year { font-size: 0.8rem; color: var(--muted); }
.year { margin-top: 2px; }

.read-badge { display: flex; margin: 6px 0; }
.star { color: var(--border); font-size: 0.9rem; }
.star.filled { color: var(--gold); }

.actions { display: flex; gap: 6px; margin-top: 8px; flex-wrap: wrap; }

.subsection-title {
  font-family: var(--font-display);
  font-size: 1.3rem;
  color: var(--ink);
  margin: 1.5rem 0 1rem;
}

/* Unread works grid */
.unread-works-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(240px, 1fr));
  gap: 16px;
  margin-bottom: 2.5rem;
}

.work-card {
  display: flex;
  gap: 12px;
  padding: 12px;
  align-items: flex-start;
}

.work-cover-link { flex-shrink: 0; text-decoration: none; }

.work-cover {
  width: 60px;
  height: 86px;
  object-fit: cover;
  border-radius: 4px;
  transition: opacity var(--transition);
}

.work-cover:hover { opacity: 0.85; }

.no-cover-md {
  width: 60px;
  height: 86px;
  background: var(--cream);
  border-radius: 4px;
  border: 1px solid var(--border);
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.4rem;
}

.work-info {
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 4px;
}

.work-title {
  font-size: 0.9rem;
  font-weight: 600;
  color: var(--ink);
  text-decoration: none;
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  line-height: 1.35;
  transition: color var(--transition);
}

.work-title:hover { color: var(--gold); }

.work-author {
  font-size: 0.78rem;
  color: var(--muted);
  text-decoration: none;
  transition: color var(--transition);
}

.work-author:hover { color: var(--ink); }

.work-actions {
  display: flex;
  flex-direction: column;
  gap: 5px;
  margin-top: 6px;
}

.btn-ghost {
  background: transparent;
  color: var(--muted);
  border: 1px solid transparent;
  font-size: 0.78rem;
  padding: 4px 8px;
  cursor: pointer;
  border-radius: var(--radius);
  transition: all var(--transition);
  text-align: left;
}

.btn-ghost:hover {
  color: var(--rust);
  border-color: rgba(184,92,58,0.3);
  background: rgba(184,92,58,0.05);
}

/* Authors list */
.authors-list { display: flex; flex-direction: column; gap: 12px; }

.author-row {
  display: flex;
  gap: 16px;
  padding: 16px;
  align-items: flex-start;
}

.author-photo-link { flex-shrink: 0; text-decoration: none; }

.author-photo img {
  width: 72px;
  height: 90px;
  object-fit: cover;
  border-radius: 4px;
  transition: opacity var(--transition);
}

.author-photo img:hover { opacity: 0.85; }

.photo-placeholder {
  width: 72px;
  height: 90px;
  background: var(--cream);
  border: 1px solid var(--border);
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
}

.author-details { flex: 1; min-width: 0; }

.author-name-link { text-decoration: none; }

.author-details h3 {
  font-family: var(--font-display);
  font-size: 1.1rem;
  margin-bottom: 4px;
  color: var(--ink);
  transition: color var(--transition);
}

.author-name-link:hover h3 { color: var(--gold); }

.birth { font-size: 0.8rem; color: var(--muted); margin-bottom: 6px; }
.bio { font-size: 0.85rem; color: var(--muted); line-height: 1.5; }

.remove-btn { flex-shrink: 0; }

.loading-inline { display: flex; justify-content: center; padding: 1rem; }

@media (max-width: 640px) {
  .favorites-view { padding: 1.5rem; }
  .unread-works-grid { grid-template-columns: 1fr; }
}
</style>
