import { defineStore } from 'pinia';
import { ref } from 'vue';
import api from '../composables/useApi.js';

export const useBooksStore = defineStore('books', () => {
  const favoriteBooks = ref([]);
  const favoriteAuthors = ref([]);
  const readBooks = ref([]);
  const readingQueue = ref([]);
  const notInterestedSet = ref(new Set());

  async function loadFavoriteBooks() {
    const { data } = await api.get('/books/favorites');
    favoriteBooks.value = data;
  }

  async function loadFavoriteAuthors() {
    const { data } = await api.get('/authors/favorites');
    favoriteAuthors.value = data;
  }

  async function loadReadBooks() {
    const { data } = await api.get('/books/read');
    readBooks.value = data;
  }

  async function loadReadingQueue() {
    const { data } = await api.get('/books/queue');
    readingQueue.value = data;
  }

  async function loadNotInterested() {
    const { data } = await api.get('/books/not-interested');
    notInterestedSet.value = new Set(data);
  }

  async function addFavoriteBook(book) {
    await api.post('/books/favorites', book);
    await loadFavoriteBooks();
  }

  async function removeFavoriteBook(bookKey) {
    await api.delete(`/books/favorites/${encodeURIComponent(bookKey)}`);
    favoriteBooks.value = favoriteBooks.value.filter(b => b.book_key !== bookKey);
  }

  async function addFavoriteAuthor(author) {
    await api.post('/authors/favorites', author);
    await loadFavoriteAuthors();
  }

  async function removeFavoriteAuthor(authorKey) {
    await api.delete(`/authors/favorites/${encodeURIComponent(authorKey)}`);
    favoriteAuthors.value = favoriteAuthors.value.filter(a => a.author_key !== authorKey);
  }

  async function markAsRead(book) {
    await api.post('/books/read', book);
    await loadReadBooks();
  }

  async function unmarkAsRead(bookKey) {
    await api.delete(`/books/read/${encodeURIComponent(bookKey)}`);
    readBooks.value = readBooks.value.filter(b => b.book_key !== bookKey);
  }

  async function addToQueue(book, priority = 2) {
    await api.post('/books/queue', {
      bookKey: book.key || book.book_key,
      bookTitle: book.title || book.book_title,
      bookAuthor: book.authors?.join(', ') || book.book_author || book.authorName || null,
      coverId: book.coverId || book.cover_id || book.covers?.[0] || null,
      firstPublishYear: book.firstPublishYear || book.first_publish_year || null,
      priority,
    });
    await loadReadingQueue();
  }

  async function removeFromQueue(bookKey) {
    await api.delete(`/books/queue/${encodeURIComponent(bookKey)}`);
    readingQueue.value = readingQueue.value.filter(b => b.book_key !== bookKey);
  }

  async function updateQueuePriority(bookKey, priority) {
    await api.patch(`/books/queue/${encodeURIComponent(bookKey)}`, { priority });
    const item = readingQueue.value.find(b => b.book_key === bookKey);
    if (item) item.priority = priority;
  }

  async function markNotInterested(bookKey) {
    await api.post('/books/not-interested', { bookKey });
    notInterestedSet.value = new Set([...notInterestedSet.value, bookKey]);
  }

  function isBookFavorite(bookKey) {
    return favoriteBooks.value.some(b => b.book_key === bookKey);
  }

  function isAuthorFavorite(authorKey) {
    return favoriteAuthors.value.some(a => a.author_key === authorKey);
  }

  function isBookRead(bookKey) {
    return readBooks.value.find(b => b.book_key === bookKey);
  }

  function isInQueue(bookKey) {
    return readingQueue.value.find(b => b.book_key === bookKey);
  }

  function isNotInterested(bookKey) {
    return notInterestedSet.value.has(bookKey);
  }

  function loadAll() {
    return Promise.all([
      loadFavoriteBooks(),
      loadFavoriteAuthors(),
      loadReadBooks(),
      loadReadingQueue(),
      loadNotInterested(),
    ]);
  }

  return {
    favoriteBooks, favoriteAuthors, readBooks, readingQueue, notInterestedSet,
    loadAll, loadFavoriteBooks, loadFavoriteAuthors, loadReadBooks, loadReadingQueue, loadNotInterested,
    addFavoriteBook, removeFavoriteBook,
    addFavoriteAuthor, removeFavoriteAuthor,
    markAsRead, unmarkAsRead,
    addToQueue, removeFromQueue, updateQueuePriority,
    markNotInterested,
    isBookFavorite, isAuthorFavorite, isBookRead, isInQueue, isNotInterested,
  };
});
