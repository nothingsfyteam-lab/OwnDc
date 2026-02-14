const sqlite3 = require('sqlite3').verbose();
const path = require('path');

const dbPath = path.join(__dirname, 'database.sqlite');
let db = null;

function initDatabase() {
  return new Promise((resolve, reject) => {
    db = new sqlite3.Database(dbPath, (err) => {
      if (err) {
        console.error('Error opening database:', err);
        reject(err);
        return;
      }
      console.log('Connected to SQLite database');
      
      db.serialize(() => {
        // Enable foreign keys
        db.run('PRAGMA foreign_keys = ON');
        
        // Create tables
        db.run(`
          CREATE TABLE IF NOT EXISTS users (
            id TEXT PRIMARY KEY,
            username TEXT UNIQUE NOT NULL,
            email TEXT UNIQUE NOT NULL,
            password_hash TEXT NOT NULL,
            avatar TEXT DEFAULT 'default-avatar.png',
            status TEXT DEFAULT 'offline',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS friends (
            id TEXT PRIMARY KEY,
            user_id TEXT NOT NULL,
            friend_id TEXT NOT NULL,
            status TEXT DEFAULT 'pending' CHECK (status IN ('pending', 'accepted', 'blocked')),
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (friend_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(user_id, friend_id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS channels (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            type TEXT DEFAULT 'text' CHECK (type IN ('text', 'voice')),
            owner_id TEXT NOT NULL,
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS channel_members (
            id TEXT PRIMARY KEY,
            channel_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(channel_id, user_id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS messages (
            id TEXT PRIMARY KEY,
            channel_id TEXT,
            sender_id TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (channel_id) REFERENCES channels(id) ON DELETE CASCADE,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS groups (
            id TEXT PRIMARY KEY,
            name TEXT NOT NULL,
            owner_id TEXT NOT NULL,
            avatar TEXT DEFAULT 'default-group.png',
            created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (owner_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS group_members (
            id TEXT PRIMARY KEY,
            group_id TEXT NOT NULL,
            user_id TEXT NOT NULL,
            role TEXT DEFAULT 'member' CHECK (role IN ('owner', 'admin', 'member')),
            joined_at DATETIME DEFAULT CURRENT_TIMESTAMP,
            FOREIGN KEY (group_id) REFERENCES groups(id) ON DELETE CASCADE,
            FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE,
            UNIQUE(group_id, user_id)
          )
        `);

        db.run(`
          CREATE TABLE IF NOT EXISTS direct_messages (
            id TEXT PRIMARY KEY,
            sender_id TEXT NOT NULL,
            receiver_id TEXT NOT NULL,
            content TEXT NOT NULL,
            timestamp DATETIME DEFAULT CURRENT_TIMESTAMP,
            read_at DATETIME,
            FOREIGN KEY (sender_id) REFERENCES users(id) ON DELETE CASCADE,
            FOREIGN KEY (receiver_id) REFERENCES users(id) ON DELETE CASCADE
          )
        `, (err) => {
          if (err) {
            console.error('Error creating tables:', err);
            reject(err);
          } else {
            console.log('Database initialized successfully');
            resolve();
          }
        });
      });
    });
  });
}

function getDb() {
  return db;
}

module.exports = { initDatabase, getDb };
