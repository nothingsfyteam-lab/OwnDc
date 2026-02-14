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

router.post('/', requireAuth, async (req, res) => {
  try {
    const { channelId, content } = req.body;
    
    if (!channelId || !content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Channel ID and content are required' });
    }

    const isMember = await dbGet('SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [channelId, req.session.userId]);

    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this channel' });
    }

    const messageId = uuidv4();
    await dbRun(
      'INSERT INTO messages (id, channel_id, sender_id, content) VALUES (?, ?, ?, ?)',
      [messageId, channelId, req.session.userId, content.trim()]
    );

    const message = await dbGet(`
      SELECT 
        m.id,
        m.content,
        m.timestamp,
        u.id as sender_id,
        u.username as sender_username,
        u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.id = ?
    `, [messageId]);

    res.status(201).json(message);
  } catch (error) {
    console.error('Send message error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/dm/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { limit = 50, before } = req.query;

    let query = `
      SELECT 
        dm.id,
        dm.content,
        dm.timestamp,
        dm.read_at,
        sender.id as sender_id,
        sender.username as sender_username,
        sender.avatar as sender_avatar,
        receiver.id as receiver_id,
        receiver.username as receiver_username
      FROM direct_messages dm
      JOIN users sender ON dm.sender_id = sender.id
      JOIN users receiver ON dm.receiver_id = receiver.id
      WHERE (dm.sender_id = ? AND dm.receiver_id = ?) OR (dm.sender_id = ? AND dm.receiver_id = ?)
    `;

    const params = [req.session.userId, userId, userId, req.session.userId];

    if (before) {
      query += ` AND dm.timestamp < ?`;
      params.push(before);
    }

    query += ` ORDER BY dm.timestamp DESC LIMIT ?`;
    params.push(parseInt(limit));

    const messages = await dbAll(query, params);

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get DM error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/dm/:userId', requireAuth, async (req, res) => {
  try {
    const { userId } = req.params;
    const { content } = req.body;
    
    if (!content || content.trim().length === 0) {
      return res.status(400).json({ error: 'Content is required' });
    }

    const receiver = await dbGet('SELECT id FROM users WHERE id = ?', [userId]);
    if (!receiver) {
      return res.status(404).json({ error: 'User not found' });
    }

    const messageId = uuidv4();
    await dbRun(
      'INSERT INTO direct_messages (id, sender_id, receiver_id, content) VALUES (?, ?, ?, ?)',
      [messageId, req.session.userId, userId, content.trim()]
    );

    const message = await dbGet(`
      SELECT 
        dm.id,
        dm.content,
        dm.timestamp,
        sender.id as sender_id,
        sender.username as sender_username,
        sender.avatar as sender_avatar,
        receiver.id as receiver_id,
        receiver.username as receiver_username
      FROM direct_messages dm
      JOIN users sender ON dm.sender_id = sender.id
      JOIN users receiver ON dm.receiver_id = receiver.id
      WHERE dm.id = ?
    `, [messageId]);

    res.status(201).json(message);
  } catch (error) {
    console.error('Send DM error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
