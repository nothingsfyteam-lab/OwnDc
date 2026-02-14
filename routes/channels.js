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
    const channels = await dbAll(`
      SELECT 
        c.id,
        c.name,
        c.type,
        c.owner_id,
        c.created_at,
        u.username as owner_username,
        COUNT(cm.user_id) as member_count
      FROM channels c
      JOIN users u ON c.owner_id = u.id
      LEFT JOIN channel_members cm ON c.id = cm.channel_id
      GROUP BY c.id
      ORDER BY c.created_at DESC
    `);

    const myChannels = await dbAll(`
      SELECT c.id, c.name, c.type
      FROM channels c
      JOIN channel_members cm ON c.id = cm.channel_id
      WHERE cm.user_id = ?
    `, [req.session.userId]);

    res.json({
      all: channels,
      mine: myChannels
    });
  } catch (error) {
    console.error('Get channels error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name, type = 'text' } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Channel name is required' });
    }

    const channelId = uuidv4();

    await dbRun(
      'INSERT INTO channels (id, name, type, owner_id) VALUES (?, ?, ?, ?)',
      [channelId, name.trim(), type, req.session.userId]
    );

    await dbRun(
      'INSERT INTO channel_members (id, channel_id, user_id) VALUES (?, ?, ?)',
      [uuidv4(), channelId, req.session.userId]
    );

    const channel = await dbGet(`
      SELECT c.*, u.username as owner_username
      FROM channels c
      JOIN users u ON c.owner_id = u.id
      WHERE c.id = ?
    `, [channelId]);

    res.status(201).json(channel);
  } catch (error) {
    console.error('Create channel error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.get('/:id/messages', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    const isMember = await dbGet('SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [id, req.session.userId]);

    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this channel' });
    }

    const messages = await dbAll(`
      SELECT 
        m.id,
        m.content,
        m.timestamp,
        u.id as sender_id,
        u.username as sender_username,
        u.avatar as sender_avatar
      FROM messages m
      JOIN users u ON m.sender_id = u.id
      WHERE m.channel_id = ?
      ORDER BY m.timestamp DESC
      LIMIT ? OFFSET ?
    `, [id, parseInt(limit), parseInt(offset)]);

    res.json(messages.reverse());
  } catch (error) {
    console.error('Get channel messages error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/join', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const channel = await dbGet('SELECT * FROM channels WHERE id = ?', [id]);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    const existing = await dbGet('SELECT * FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [id, req.session.userId]);

    if (existing) {
      return res.status(409).json({ error: 'Already a member' });
    }

    await dbRun(
      'INSERT INTO channel_members (id, channel_id, user_id) VALUES (?, ?, ?)',
      [uuidv4(), id, req.session.userId]
    );

    res.json({ message: 'Joined channel successfully' });
  } catch (error) {
    console.error('Join channel error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/leave', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const result = await dbRun('DELETE FROM channel_members WHERE channel_id = ? AND user_id = ?',
      [id, req.session.userId]);

    if (result.changes === 0) {
      return res.status(404).json({ error: 'Not a member of this channel' });
    }

    res.json({ message: 'Left channel successfully' });
  } catch (error) {
    console.error('Leave channel error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const channel = await dbGet('SELECT * FROM channels WHERE id = ?', [id]);
    if (!channel) {
      return res.status(404).json({ error: 'Channel not found' });
    }

    if (channel.owner_id !== req.session.userId) {
      return res.status(403).json({ error: 'Only the owner can delete this channel' });
    }

    await dbRun('DELETE FROM channels WHERE id = ?', [id]);

    res.json({ message: 'Channel deleted successfully' });
  } catch (error) {
    console.error('Delete channel error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
