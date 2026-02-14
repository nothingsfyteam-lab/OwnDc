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
    const groups = await dbAll(`
      SELECT 
        g.id,
        g.name,
        g.avatar,
        g.created_at,
        u.username as owner_username,
        COUNT(gm.user_id) as member_count
      FROM groups g
      JOIN users u ON g.owner_id = u.id
      LEFT JOIN group_members gm ON g.id = gm.group_id
      WHERE g.id IN (
        SELECT group_id FROM group_members WHERE user_id = ?
      )
      GROUP BY g.id
      ORDER BY g.created_at DESC
    `, [req.session.userId]);

    res.json(groups);
  } catch (error) {
    console.error('Get groups error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/', requireAuth, async (req, res) => {
  try {
    const { name } = req.body;
    
    if (!name || name.trim().length === 0) {
      return res.status(400).json({ error: 'Group name is required' });
    }

    const groupId = uuidv4();

    await dbRun(
      'INSERT INTO groups (id, name, owner_id) VALUES (?, ?, ?)',
      [groupId, name.trim(), req.session.userId]
    );

    await dbRun(
      'INSERT INTO group_members (id, group_id, user_id, role) VALUES (?, ?, ?, ?)',
      [uuidv4(), groupId, req.session.userId, 'owner']
    );

    const group = await dbGet(`
      SELECT g.*, u.username as owner_username
      FROM groups g
      JOIN users u ON g.owner_id = u.id
      WHERE g.id = ?
    `, [groupId]);

    res.status(201).json(group);
  } catch (error) {
    console.error('Create group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.post('/:id/members', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;
    const { userId } = req.body;

    const group = await dbGet('SELECT * FROM groups WHERE id = ?', [id]);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    const isMember = await dbGet('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, req.session.userId]);

    if (!isMember) {
      return res.status(403).json({ error: 'Not a member of this group' });
    }

    const existing = await dbGet('SELECT * FROM group_members WHERE group_id = ? AND user_id = ?',
      [id, userId]);

    if (existing) {
      return res.status(409).json({ error: 'User is already a member' });
    }

    await dbRun(
      'INSERT INTO group_members (id, group_id, user_id) VALUES (?, ?, ?)',
      [uuidv4(), id, userId]
    );

    res.json({ message: 'Member added successfully' });
  } catch (error) {
    console.error('Add member error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

router.delete('/:id', requireAuth, async (req, res) => {
  try {
    const { id } = req.params;

    const group = await dbGet('SELECT * FROM groups WHERE id = ?', [id]);
    if (!group) {
      return res.status(404).json({ error: 'Group not found' });
    }

    if (group.owner_id !== req.session.userId) {
      return res.status(403).json({ error: 'Only the owner can delete this group' });
    }

    await dbRun('DELETE FROM groups WHERE id = ?', [id]);

    res.json({ message: 'Group deleted successfully' });
  } catch (error) {
    console.error('Delete group error:', error);
    res.status(500).json({ error: 'Server error' });
  }
});

module.exports = router;
