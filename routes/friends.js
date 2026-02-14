const express = require('express');
const { v4: uuidv4 } = require('uuid');
const { getDb } = require('../db');

const router = express.Router();

function requireAuth(req, res, next) {
  if (!req.session.userId) {
    return res.status(401).json({ error: 'Not authenticated' });
  }
  next();
}

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

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
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

router.get('/', requireAuth, async (req, res) => {
  try {
    const friends = await dbAll(`
      SELECT 
        f.id as friendship_id,
        f.status,
        u.id,
        u.username,
        u.avatar,
        u.status as user_status
      FROM friends f
      JOIN users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
      WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted'
    `, [req.session.userId, req.session.userId, req.session.userId, req.session.userId]);

    const pendingRequests = await dbAll(`
      SELECT 
        f.id as friendship_id,
        f.status,
        u.id,
        u.username,
        u.avatar,
        u.status as user_status
      FROM friends f
      JOIN users u ON f.user_id = u.id
      WHERE f.friend_id = ? AND f.status = 'pending'
    `, [req.session.userId]);

    const sentRequests = await dbAll(`
      SELECT 
        f.id as friendship_id,
        f.status,
        u.id,
        u.username,
        u.avatar,
        u.status as user_status
      FROM friends f
      JOIN users u ON f.friend_id = u.id
      WHERE f.user_id = ? AND f.status = 'pending'
    `, [req.session.userId]);

    res.json({
      friends: friends.filter(f => f.id !== req.session.userId),
      pendingRequests,
      sentRequests
    });
  } catch (error) {
    console.error('Get friends error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/request', requireAuth, async (req, res) => {
  try {
    const { username } = req.body;

    const friend = await dbGet('SELECT id, username FROM users WHERE username = ?', [username]);
    if (!friend) {
      return res.status(404).json({ error: 'User not found' });
    }

    if (friend.id === req.session.userId) {
      return res.status(400).json({ error: 'Cannot add yourself' });
    }

    const existing = await dbGet(`
      SELECT * FROM friends 
      WHERE (user_id = ? AND friend_id = ?) OR (user_id = ? AND friend_id = ?)
    `, [req.session.userId, friend.id, friend.id, req.session.userId]);

    if (existing) {
      return res.status(409).json({ error: 'Friend request already exists' });
    }

    const friendshipId = uuidv4();
    await dbRun(
      'INSERT INTO friends (id, user_id, friend_id, status) VALUES (?, ?, ?, ?)',
      [friendshipId, req.session.userId, friend.id, 'pending']
    );

    res.status(201).json({
      message: 'Friend request sent',
      friendship_id: friendshipId,
      friend: {
        id: friend.id,
        username: friend.username
      }
    });
  } catch (error) {
    console.error('Send friend request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/accept', requireAuth, async (req, res) => {
  try {
    const { friendshipId } = req.body;

    const friendship = await dbGet('SELECT * FROM friends WHERE id = ? AND friend_id = ? AND status = ?',
      [friendshipId, req.session.userId, 'pending']);

    if (!friendship) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    await dbRun("UPDATE friends SET status = 'accepted' WHERE id = ?", [friendshipId]);

    const friend = await dbGet('SELECT id, username, avatar, status FROM users WHERE id = ?', [friendship.user_id]);

    res.json({
      message: 'Friend request accepted',
      friend
    });
  } catch (error) {
    console.error('Accept friend request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/decline', requireAuth, async (req, res) => {
  try {
    const { friendshipId } = req.body;

    const result = await dbRun('DELETE FROM friends WHERE id = ? AND friend_id = ? AND status = ?',
      [friendshipId, req.session.userId, 'pending']);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Friend request not found' });
    }

    res.json({ message: 'Friend request declined' });
  } catch (error) {
    console.error('Decline friend request error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbRun(`
      DELETE FROM friends 
      WHERE id = ? AND (user_id = ? OR friend_id = ?)
    `, [id, req.session.userId, req.session.userId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Friend not found' });
    }

    res.json({ message: 'Friend removed' });
  } catch (error) {
    console.error('Remove friend error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
