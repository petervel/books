CREATE TABLE IF NOT EXISTS users (
  id INT AUTO_INCREMENT PRIMARY KEY,
  username VARCHAR(50) UNIQUE NOT NULL,
  email VARCHAR(255) UNIQUE NOT NULL,
  password_hash VARCHAR(255),
  google_id VARCHAR(255) UNIQUE,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP
);

CREATE TABLE IF NOT EXISTS favorite_books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_key VARCHAR(255) NOT NULL,
  book_title VARCHAR(500) NOT NULL,
  book_author VARCHAR(500),
  cover_id VARCHAR(50),
  first_publish_year INT,
  language VARCHAR(50),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_book (user_id, book_key)
);

CREATE TABLE IF NOT EXISTS favorite_authors (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  author_key VARCHAR(255) NOT NULL,
  author_name VARCHAR(500) NOT NULL,
  birth_date VARCHAR(50),
  bio TEXT,
  photo_id VARCHAR(50),
  added_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_author (user_id, author_key)
);

CREATE TABLE IF NOT EXISTS read_books (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_key VARCHAR(255) NOT NULL,
  book_title VARCHAR(500) NOT NULL,
  book_author VARCHAR(500),
  cover_id VARCHAR(50),
  first_publish_year INT,
  rating TINYINT CHECK (rating >= 1 AND rating <= 5),
  notes TEXT,
  read_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_read_book (user_id, book_key)
);

CREATE TABLE IF NOT EXISTS swipe_decisions (
  id INT AUTO_INCREMENT PRIMARY KEY,
  user_id INT NOT NULL,
  book_key VARCHAR(255) NOT NULL,
  decision ENUM('like', 'dislike') NOT NULL,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY unique_user_swipe (user_id, book_key)
);

CREATE INDEX idx_read_books_user ON read_books(user_id);
CREATE INDEX idx_favorite_books_user ON favorite_books(user_id);
CREATE INDEX idx_favorite_authors_user ON favorite_authors(user_id);
CREATE INDEX idx_swipe_decisions_user ON swipe_decisions(user_id);
