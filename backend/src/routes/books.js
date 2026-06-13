import express from 'express';
import axios from 'axios';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const olClient = axios.create({
  baseURL: 'https://openlibrary.org',
  timeout: 12000,
  headers: {
    'User-Agent': 'Bookshelf/1.0 (openlibrary@example.com)',
  },
});

function extractText(field) {
  if (!field) return '';
  if (typeof field === 'string') return field;
  if (typeof field === 'object' && field.value) return field.value;
  return '';
}

// ─── Search books ─────────────────────────────────────────────────────────────
router.get('/search', authenticate, async (req, res) => {
  try {
    const { q, author, language } = req.query;
    const pageNum = Math.max(1, parseInt(req.query.page) || 1);
    const limitNum = Math.min(100, Math.max(1, parseInt(req.query.limit) || 20));

    if (!q && !author) {
      return res.json({ books: [], total: 0, page: pageNum, limit: limitNum });
    }

    const params = {
      limit: limitNum,
      offset: (pageNum - 1) * limitNum,
      fields: 'key,title,author_name,author_key,cover_i,first_publish_year,language,subject,edition_count',
    };

    if (q) params.q = q.trim();
    if (author) params.author = author.trim();
    if (language) params.lang = language.trim();

    const { data } = await olClient.get('/search.json', { params });

    const books = (data.docs || []).map(b => ({
      key: b.key.startsWith('/works/') ? b.key : `/works/${b.key}`,
      title: b.title,
      authors: b.author_name || [],
      authorKeys: (b.author_key || []).map(k =>
        k.startsWith('/authors/') ? k : `/authors/${k}`
      ),
      coverId: b.cover_i || null,
      firstPublishYear: b.first_publish_year || null,
      languages: b.language || [],
      subjects: (b.subject || []).slice(0, 5),
      editionCount: b.edition_count || null,
    }));

    res.json({ books, total: data.numFound, page: pageNum, limit: limitNum });
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 300) : '';
    console.error(`Search error ${err.response?.status}: ${err.message} ${detail}`);
    res.status(500).json({ error: 'Search failed' });
  }
});

// ─── Get work details ─────────────────────────────────────────────────────────
router.get('/details/:workKey(*)', authenticate, async (req, res) => {
  try {
    let key = '/' + req.params.workKey.replace(/^\/+/, '');
    if (!key.startsWith('/works/')) key = `/works/${key.replace(/^\//, '')}`;

    const { data } = await olClient.get(`${key}.json`);

    res.json({
      key: data.key,
      title: data.title,
      description: extractText(data.description).slice(0, 600),
      subjects: (data.subjects || []).slice(0, 8),
      firstPublishDate: data.first_publish_date || null,
      covers: data.covers || [],
      authorKeys: (data.authors || []).map(a => a.author?.key).filter(Boolean),
    });
  } catch (err) {
    const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : '';
    console.error(`Details error ${err.response?.status}: ${err.message} ${detail}`);
    res.status(500).json({ error: 'Could not fetch book details' });
  }
});

// ─── Get author details ───────────────────────────────────────────────────────
router.get('/author/:authorKey(*)', authenticate, async (req, res) => {
  try {
    let key = '/' + req.params.authorKey.replace(/^\/+/, '');
    if (!key.startsWith('/authors/')) key = `/authors/${key.replace(/^\//, '')}`;

    const { data } = await olClient.get(`${key}.json`);

    res.json({
      key: data.key,
      name: data.name,
      bio: extractText(data.bio).slice(0, 600),
      birthDate: data.birth_date || null,
      deathDate: data.death_date || null,
      photos: data.photos || [],
    });
  } catch (err) {
    console.error(`Author details error ${err.response?.status}: ${err.message}`);
    res.status(500).json({ error: 'Could not fetch author details' });
  }
});

// ─── Get works by author ──────────────────────────────────────────────────────
router.get('/author-works/:authorKey(*)', authenticate, async (req, res) => {
  try {
    let key = '/' + req.params.authorKey.replace(/^\/+/, '');
    if (!key.startsWith('/authors/')) key = `/authors/${key.replace(/^\//, '')}`;

    const { limit = 20, offset = 0 } = req.query;
    const { data } = await olClient.get(`${key}/works.json`, {
      params: { limit: parseInt(limit), offset: parseInt(offset) },
    });

    const works = (data.entries || []).map(w => ({
      key: w.key,
      title: w.title,
      covers: w.covers || [],
      firstPublishDate: w.first_publish_date || null,
      subjects: (w.subjects || []).slice(0, 5),
      editionCount: w.edition_count || null,
    }));

    res.json({ works, size: data.size || works.length });
  } catch (err) {
    console.error(`Author works error ${err.response?.status}: ${err.message}`);
    res.status(500).json({ error: 'Could not fetch author works' });
  }
});

// ─── Favorite books ───────────────────────────────────────────────────────────

router.get('/favorites', authenticate, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM favorite_books WHERE user_id = ? ORDER BY added_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

router.post('/favorites', authenticate, async (req, res) => {
  try {
    const { bookKey, bookTitle, bookAuthor, coverId, firstPublishYear, language } = req.body;
    await pool.execute(
      'INSERT IGNORE INTO favorite_books (user_id, book_key, book_title, book_author, cover_id, first_publish_year, language) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, bookKey, bookTitle, bookAuthor, coverId || null, firstPublishYear || null, language || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Add favourite error:', err.message);
    res.status(500).json({ error: 'Could not add favourite' });
  }
});

router.delete('/favorites/:bookKey(*)', authenticate, async (req, res) => {
  await pool.execute(
    'DELETE FROM favorite_books WHERE user_id = ? AND book_key = ?',
    [req.user.id, decodeURIComponent(req.params.bookKey)]
  );
  res.json({ success: true });
});

// ─── Read books ───────────────────────────────────────────────────────────────

router.get('/read', authenticate, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM read_books WHERE user_id = ? ORDER BY read_at DESC',
    [req.user.id]
  );
  res.json(rows);
});

router.post('/read', authenticate, async (req, res) => {
  try {
    const { bookKey, bookTitle, bookAuthor, coverId, firstPublishYear, rating, notes } = req.body;
    await pool.execute(
      `INSERT INTO read_books (user_id, book_key, book_title, book_author, cover_id, first_publish_year, rating, notes)
       VALUES (?, ?, ?, ?, ?, ?, ?, ?)
       ON DUPLICATE KEY UPDATE rating = VALUES(rating), notes = VALUES(notes), read_at = CURRENT_TIMESTAMP`,
      [req.user.id, bookKey, bookTitle, bookAuthor, coverId || null, firstPublishYear || null, rating || null, notes || null]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Mark read error:', err.message);
    res.status(500).json({ error: 'Could not mark as read' });
  }
});

router.delete('/read/:bookKey(*)', authenticate, async (req, res) => {
  await pool.execute(
    'DELETE FROM read_books WHERE user_id = ? AND book_key = ?',
    [req.user.id, decodeURIComponent(req.params.bookKey)]
  );
  res.json({ success: true });
});

// ─── Reading queue ────────────────────────────────────────────────────────────

router.get('/queue', authenticate, async (req, res) => {
  const [rows] = await pool.execute(
    'SELECT * FROM reading_queue WHERE user_id = ? ORDER BY priority DESC, added_at ASC',
    [req.user.id]
  );
  res.json(rows);
});

router.post('/queue', authenticate, async (req, res) => {
  try {
    const { bookKey, bookTitle, bookAuthor, coverId, firstPublishYear, priority } = req.body;
    await pool.execute(
      'INSERT IGNORE INTO reading_queue (user_id, book_key, book_title, book_author, cover_id, first_publish_year, priority) VALUES (?, ?, ?, ?, ?, ?, ?)',
      [req.user.id, bookKey, bookTitle, bookAuthor || null, coverId || null, firstPublishYear || null, priority || 2]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Add to queue error:', err.message);
    res.status(500).json({ error: 'Could not add to queue' });
  }
});

router.patch('/queue/:bookKey(*)', authenticate, async (req, res) => {
  try {
    const { priority } = req.body;
    await pool.execute(
      'UPDATE reading_queue SET priority = ? WHERE user_id = ? AND book_key = ?',
      [priority, req.user.id, decodeURIComponent(req.params.bookKey)]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Update queue priority error:', err.message);
    res.status(500).json({ error: 'Could not update priority' });
  }
});

router.delete('/queue/:bookKey(*)', authenticate, async (req, res) => {
  await pool.execute(
    'DELETE FROM reading_queue WHERE user_id = ? AND book_key = ?',
    [req.user.id, decodeURIComponent(req.params.bookKey)]
  );
  res.json({ success: true });
});

// ─── Not interested ───────────────────────────────────────────────────────────

router.get('/not-interested', authenticate, async (req, res) => {
  const [rows] = await pool.execute(
    `SELECT book_key FROM swipe_decisions WHERE user_id = ? AND decision = 'dislike'`,
    [req.user.id]
  );
  res.json(rows.map(r => r.book_key));
});

router.post('/not-interested', authenticate, async (req, res) => {
  try {
    const { bookKey } = req.body;
    await pool.execute(
      `INSERT INTO swipe_decisions (user_id, book_key, decision)
       VALUES (?, ?, 'dislike')
       ON DUPLICATE KEY UPDATE decision = 'dislike'`,
      [req.user.id, bookKey]
    );
    res.json({ success: true });
  } catch (err) {
    console.error('Not interested error:', err.message);
    res.status(500).json({ error: 'Could not mark as not interested' });
  }
});

export default router;
