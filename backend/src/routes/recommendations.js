import express from 'express';
import axios from 'axios';
import pool from '../db/connection.js';
import { authenticate } from '../middleware/auth.js';

const router = express.Router();

const olClient = axios.create({
  baseURL: 'https://openlibrary.org',
  timeout: 10000,
  headers: { 'User-Agent': 'Bookshelf/1.0 (openlibrary@example.com)' },
});

function normaliseWorkKey(key) {
  if (!key) return key;
  if (key.startsWith('/works/')) return key;
  return `/works/${key}`;
}

// Get recommendations for swipe interface
router.get('/', authenticate, async (req, res) => {
  try {
    const userId = req.user.id;

    const [swiped] = await pool.execute(
      'SELECT book_key FROM swipe_decisions WHERE user_id = ?',
      [userId]
    );
    const swipedKeys = new Set(swiped.map(s => s.book_key));

    const [popularBooks] = await pool.execute(
      `SELECT rb.book_key,
              ANY_VALUE(rb.book_title) as book_title,
              ANY_VALUE(rb.book_author) as book_author,
              ANY_VALUE(rb.cover_id) as cover_id,
              ANY_VALUE(rb.first_publish_year) as first_publish_year,
              AVG(rb.rating) as avg_rating, COUNT(*) as read_count
       FROM read_books rb
       WHERE rb.user_id != ? AND rb.rating >= 4
       GROUP BY rb.book_key
       ORDER BY avg_rating DESC, read_count DESC
       LIMIT 50`,
      [userId]
    );

    const [likedByOthers] = await pool.execute(
      `SELECT sd.book_key,
              ANY_VALUE(fb.book_title) as book_title,
              ANY_VALUE(fb.book_author) as book_author,
              ANY_VALUE(fb.cover_id) as cover_id,
              ANY_VALUE(fb.first_publish_year) as first_publish_year,
              COUNT(*) as like_count
       FROM swipe_decisions sd
       LEFT JOIN favorite_books fb ON fb.book_key = sd.book_key
       WHERE sd.decision = 'like' AND sd.user_id != ?
       GROUP BY sd.book_key
       ORDER BY like_count DESC
       LIMIT 30`,
      [userId]
    );

    const candidates = new Map();
    [...popularBooks, ...likedByOthers].forEach(b => {
      if (b.book_key && !swipedKeys.has(b.book_key) && !candidates.has(b.book_key)) {
        candidates.set(b.book_key, b);
      }
    });

    if (candidates.size < 10) {
      const subjects = ['fiction', 'mystery', 'fantasy', 'biography', 'science'];
      const subject = subjects[Math.floor(Math.random() * subjects.length)];

      try {
        const { data } = await olClient.get('/search.json', {
          params: {
            subject,
            sort: 'editions',
            limit: 30,
            fields: 'key,title,author_name,author_key,cover_i,first_publish_year,edition_count',
          },
        });

        (data.docs || []).forEach(b => {
          const key = normaliseWorkKey(b.key);
          if (key && !swipedKeys.has(key) && !candidates.has(key)) {
            candidates.set(key, {
              book_key: key,
              book_title: b.title,
              book_author: (b.author_name || []).join(', '),
              cover_id: b.cover_i || null,
              first_publish_year: b.first_publish_year || null,
              author_key: (b.author_key || [])[0] || null,
            });
          }
        });
      } catch (err) {
        const detail = err.response?.data ? JSON.stringify(err.response.data).slice(0, 200) : '';
        console.warn(`Fallback OL search failed ${err.response?.status}: ${err.message} ${detail}`);
      }
    }

    const topCandidates = Array.from(candidates.values()).slice(0, 20);
    res.json(topCandidates);
  } catch (err) {
    console.error('Recommendation error:', err.message);
    res.status(500).json({ error: 'Could not generate recommendations' });
  }
});

// Record swipe decision
router.post('/swipe', authenticate, async (req, res) => {
  try {
    const { bookKey, decision, bookTitle, bookAuthor, coverId, firstPublishYear } = req.body;

    await pool.execute(
      `INSERT INTO swipe_decisions (user_id, book_key, decision)
       VALUES (?, ?, ?)
       ON DUPLICATE KEY UPDATE decision = VALUES(decision)`,
      [req.user.id, bookKey, decision]
    );

    if (decision === 'like') {
      await pool.execute(
        `INSERT IGNORE INTO favorite_books (user_id, book_key, book_title, book_author, cover_id, first_publish_year)
         VALUES (?, ?, ?, ?, ?, ?)`,
        [req.user.id, bookKey, bookTitle, bookAuthor, coverId || null, firstPublishYear || null]
      );
    }

    res.json({ success: true });
  } catch (err) {
    console.error('Swipe error:', err.message);
    res.status(500).json({ error: 'Could not record swipe' });
  }
});

export default router;
