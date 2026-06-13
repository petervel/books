import express from 'express';
import cors from 'cors';
import authRoutes from './routes/auth.js';
import bookRoutes from './routes/books.js';
import authorRoutes from './routes/authors.js';
import recommendationRoutes from './routes/recommendations.js';

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors({
  origin: process.env.NODE_ENV === 'production'
    ? ['https://books.petervel.nl']
    : ['http://localhost:5173', 'http://localhost:3000', 'http://localhost:8080'],
  credentials: true,
}));

app.use(express.json());

app.get('/health', (req, res) => res.json({ status: 'ok' }));

app.use('/auth', authRoutes);
app.use('/books', bookRoutes);
app.use('/authors', authorRoutes);
app.use('/recommendations', recommendationRoutes);

app.listen(PORT, () => {
  console.log(`🚀 Backend running on port ${PORT}`);
});
