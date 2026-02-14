const express = require('express');
const bcrypt = require('bcryptjs');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();

// Helper function to promisify db operations
function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

router.post('/register', async (req, res) => {
  try {
    const { username, email, password } = req.body;
    
    if (!username || !email || !password) {
      return res.status(400).json({ error: 'All fields are required' });
    }

    if (password.length < 6) {
      return res.status(400).json({ error: 'Password must be at least 6 characters' });
    }

    const existingUser = await dbGet('SELECT * FROM users WHERE email = ? OR username = ?', [email, username]);
    if (existingUser) {
      return res.status(409).json({ error: 'User already exists' });
    }

    const hashedPassword = await bcrypt.hash(password, 10);
    const userId = uuidv4();

    await dbRun(
      'INSERT INTO users (id, username, email, password_hash, status) VALUES (?, ?, ?, ?, ?)',
      [userId, username, email, hashedPassword, 'online']
    );

    req.session.userId = userId;

    res.status(201).json({
      id: userId,
      username,
      email,
      status: 'online'
    });
  } catch (error) {
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/login', async (req, res) => {
  try {
    const { email, password } = req.body;

    if (!email || !password) {
      return res.status(400).json({ error: 'Email and password are required' });
    }

    const user = await dbGet('SELECT * FROM users WHERE email = ?', [email]);

    if (!user) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    const isValidPassword = await bcrypt.compare(password, user.password_hash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid credentials' });
    }

    await dbRun("UPDATE users SET status = 'online' WHERE id = ?", [user.id]);

    req.session.userId = user.id;

    res.json({
      id: user.id,
      username: user.username,
      email: user.email,
      avatar: user.avatar,
      status: 'online'
    });
  } catch (error) {
    console.error('Login error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/logout', async (req, res) => {
  try {
    if (req.session.userId) {
      await dbRun("UPDATE users SET status = 'offline' WHERE id = ?", [req.session.userId]);
    }
    
    req.session.destroy();
    res.json({ message: 'Logged out successfully' });
  } catch (error) {
    console.error('Logout error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/me', async (req, res) => {
  try {
    if (!req.session.userId) {
      return res.status(401).json({ error: 'Not authenticated' });
    }

    const user = await dbGet('SELECT id, username, email, avatar, status FROM users WHERE id = ?', [req.session.userId]);

    if (!user) {
      return res.status(404).json({ error: 'User not found' });
    }

    res.json(user);
  } catch (error) {
    console.error('Get user error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
