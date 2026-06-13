<template>
  <div class="search-view">
    <div class="search-header">
      <h1 class="section-title">Search</h1>

      <div class="search-controls">
        <div class="search-tabs">
          <button :class="['tab', activeTab === 'books' ? 'active' : '']" @click="switchTab('books')">Books</button>
          <button :class="['tab', activeTab === 'authors' ? 'active' : '']" @click="switchTab('authors')">Authors</button>
        </div>

        <div class="search-bar">
          <input
            v-model="query"
            class="input-field search-input"
            :placeholder="activeTab === 'books' ? 'Search books by title, author...' : 'Search authors by name...'"
            @keyup.enter="performSearch(1)"
          />
          <select v-if="activeTab === 'books'" v-model="language" class="input-field lang-select">
            <option value="">Any language</option>
            <option value="eng">English</option>
            <option value="fre">French</option>
            <option value="ger">German</option>
            <option value="spa">Spanish</option>
            <option value="nld">Dutch</option>
            <option value="ita">Italian</option>
            <option value="por">Portuguese</option>
            <option value="jpn">Japanese</option>
          </select>
          <button class="btn btn-primary" @click="performSearch(1)" :disabled="loading">
            {{ loading ? '...' : 'Search' }}
          </button>
        </div>
      </div>
    </div>

    <div v-if="loading" class="loading-state">
      <div class="spinner"></div>
      <p>Searching...</p>
    </div>

    <div v-else-if="error" class="error-banner">{{ error }}</div>

    <!-- Books results -->
    <div v-else-if="activeTab === 'books' && books.length">
      <p class="result-count">{{ total.toLocaleString() }} results</p>
      <div class="books-grid">
        <BookCard
          v-for="book in books"
          :key="book.key"
          :book="book"
          @toggle-favorite="handleToggleFavorite"
          @toggle-read="handleToggleRead"
        />
      </div>
      <div class="pagination" v-if="total > limit">
        <button class="btn btn-outline btn-sm" :disabled="page <= 1" @click="changePage(page - 1)">← Prev</button>
        <span class="page-info">Page {{ page }}</span>
        <button class="btn btn-outline btn-sm" @click="changePage(page + 1)">Next →</button>
      </div>
    </div>

    <!-- Authors results -->
    <div v-else-if="activeTab === 'authors' && authors.length">
      <p class="result-count">{{ total.toLocaleString() }} results</p>
      <div class="authors-grid">
        <div v-for="author in authors" :key="author.key" class="author-card card">
          <RouterLink :to="`/author/${author.key.replace('/authors/', '')}`" class="author-photo-link">
            <div class="author-photo">
              <img
                v-if="author.photos?.length"
                :src="`https://covers.openlibrary.org/a/id/${author.photos[0]}-M.jpg`"
                :alt="author.name"
              />
              <div v-else class="photo-placeholder">✍️</div>
            </div>
          </RouterLink>
          <div class="author-info">
            <RouterLink :to="`/author/${author.key.replace('/authors/', '')}`" class="author-name-link">
              <h3>{{ author.name }}</h3>
            </RouterLink>
            <p v-if="author.birthDate" class="author-meta">Born {{ author.birthDate }}</p>
            <p v-if="author.topWork" class="author-meta top-work">{{ author.topWork }}</p>
            <p v-if="author.workCount" class="author-meta">{{ author.workCount }} works</p>
            <button
              class="btn btn-sm"
              :class="booksStore.isAuthorFavorite(author.key) ? 'btn-gold' : 'btn-outline'"
              @click="handleToggleAuthorFavorite(author)"
            >
              {{ booksStore.isAuthorFavorite(author.key) ? '❤️ Following' : '♡ Follow' }}
            </button>
          </div>
        </div>
      </div>
    </div>

    <div v-else-if="searched" class="empty-state">
      <div class="icon">🔍</div>
      <p>No results found. Try different search terms.</p>
    </div>

    <div v-else class="welcome-state">
      <div class="welcome-text">
        <h2>Explore millions of books</h2>
        <p>Search by title, author, subject, or use the filters to narrow results.</p>
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
import { ref, watch } from 'vue';
import api from '../composables/useApi.js';
import { useBooksStore } from '../stores/books.js';
import BookCard from '../components/BookCard.vue';
import ReadModal from '../components/ReadModal.vue';

const booksStore = useBooksStore();

const activeTab = ref('books');
const query = ref('');
const language = ref('');
const books = ref([]);
const authors = ref([]);
const total = ref(0);
const page = ref(1);
const limit = 20;
const loading = ref(false);
const error = ref('');
const searched = ref(false);
const readModalBook = ref(null);

let debounceTimer = null;

watch(query, (val) => {
  clearTimeout(debounceTimer);
  if (val.trim().length >= 2) {
    debounceTimer = setTimeout(() => performSearch(1), 400);
  }
});

watch(language, () => {
  if (query.value.trim()) performSearch(1);
});

function switchTab(tab) {
  activeTab.value = tab;
  if (query.value.trim()) performSearch(1);
}

async function performSearch(p = 1) {
  if (!query.value.trim()) return;
  loading.value = true;
  error.value = '';
  searched.value = true;
  page.value = p;

  try {
    if (activeTab.value === 'books') {
      const { data } = await api.get('/books/search', {
        params: { q: query.value, language: language.value, page: p, limit },
      });
      books.value = data.books;
      total.value = data.total;
    } else {
      const { data } = await api.get('/authors/search', {
        params: { q: query.value, page: p, limit },
      });
      authors.value = data.authors;
      total.value = data.total;
    }
  } catch (err) {
    error.value = 'Search failed. Please try again.';
  } finally {
    loading.value = false;
  }
}

function changePage(p) {
  performSearch(p);
  window.scrollTo({ top: 0, behavior: 'smooth' });
}

async function handleToggleFavorite(book) {
  if (booksStore.isBookFavorite(book.key)) {
    await booksStore.removeFavoriteBook(book.key);
  } else {
    await booksStore.addFavoriteBook({
      bookKey: book.key,
      bookTitle: book.title,
      bookAuthor: book.authors?.join(', '),
      coverId: book.coverId,
      firstPublishYear: book.firstPublishYear,
    });
  }
}

function handleToggleRead(book) {
  const existing = booksStore.isBookRead(book.key);
  if (existing) {
    booksStore.unmarkAsRead(book.key);
  } else {
    readModalBook.value = book;
  }
}

async function confirmRead({ rating, notes }) {
  const book = readModalBook.value;
  await booksStore.markAsRead({
    bookKey: book.key,
    bookTitle: book.title,
    bookAuthor: book.authors?.join(', '),
    coverId: book.coverId,
    firstPublishYear: book.firstPublishYear,
    rating,
    notes,
  });
  readModalBook.value = null;
}

async function handleToggleAuthorFavorite(author) {
  if (booksStore.isAuthorFavorite(author.key)) {
    await booksStore.removeFavoriteAuthor(author.key);
  } else {
    await booksStore.addFavoriteAuthor({
      authorKey: author.key,
      authorName: author.name,
      birthDate: author.birthDate,
      photoId: author.photos?.[0],
    });
  }
}
</script>

<style scoped>
.search-view {
  padding: 2.5rem;
  max-width: 1200px;
}

.search-header {
  margin-bottom: 2rem;
}

.search-controls {
  display: flex;
  flex-direction: column;
  gap: 12px;
}

.search-tabs {
  display: flex;
  gap: 4px;
  background: var(--cream);
  padding: 4px;
  border-radius: 8px;
  width: fit-content;
}

.tab {
  padding: 7px 18px;
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

.search-bar {
  display: flex;
  gap: 10px;
  flex-wrap: wrap;
}

.search-input { flex: 1; min-width: 200px; }
.lang-select { width: 160px; }

.result-count {
  font-size: 0.85rem;
  color: var(--muted);
  margin-bottom: 1rem;
}

.books-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(340px, 1fr));
  gap: 16px;
}

.authors-grid {
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(280px, 1fr));
  gap: 16px;
}

.author-card {
  display: flex;
  gap: 14px;
  padding: 16px;
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
  border-radius: 4px;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 1.8rem;
  border: 1px solid var(--border);
}

.author-name-link { text-decoration: none; }

.author-info h3 {
  font-family: var(--font-display);
  font-size: 1rem;
  margin-bottom: 4px;
  color: var(--ink);
  transition: color var(--transition);
}

.author-name-link:hover h3 { color: var(--gold); }

.author-meta {
  font-size: 0.8rem;
  color: var(--muted);
  margin-bottom: 3px;
}

.top-work {
  font-style: italic;
  color: var(--ink);
  overflow: hidden;
  display: -webkit-box;
  -webkit-line-clamp: 2;
  -webkit-box-orient: vertical;
  margin-bottom: 8px;
}

.pagination {
  display: flex;
  align-items: center;
  gap: 16px;
  margin-top: 2rem;
  justify-content: center;
}

.page-info { color: var(--muted); font-size: 0.9rem; }

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
  margin-bottom: 1rem;
}

.welcome-state {
  padding: 3rem 0;
  text-align: center;
}

.welcome-text h2 {
  font-family: var(--font-display);
  font-size: 1.8rem;
  color: var(--ink);
  margin-bottom: 0.6rem;
}

.welcome-text p { color: var(--muted); }

@media (max-width: 640px) {
  .search-view { padding: 1.5rem; }
  .books-grid, .authors-grid { grid-template-columns: 1fr; }
}
</style>
