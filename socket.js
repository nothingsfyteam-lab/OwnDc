const { getDb } = require('./db');

const userSockets = new Map();
const voiceChannels = new Map();

function dbGet(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return resolve(null);
    db.get(query, params, (err, row) => {
      if (err) reject(err);
      else resolve(row);
    });
  });
}

function dbAll(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return resolve([]);
    db.all(query, params, (err, rows) => {
      if (err) reject(err);
      else resolve(rows);
    });
  });
}

function dbRun(query, params = []) {
  return new Promise((resolve, reject) => {
    const db = getDb();
    if (!db) return resolve({ changes: 0 });
    db.run(query, params, function(err) {
      if (err) reject(err);
      else resolve({ id: this.lastID, changes: this.changes });
    });
  });
}

async function getOnlineFriends(userId, io) {
  const friends = await dbAll(`
    SELECT u.id, u.username, u.avatar, u.status
    FROM friends f
    JOIN users u ON (f.friend_id = u.id AND f.user_id = ?) OR (f.user_id = u.id AND f.friend_id = ?)
    WHERE (f.user_id = ? OR f.friend_id = ?) AND f.status = 'accepted' AND u.status = 'online'
  `, [userId, userId, userId, userId]);

  return friends.filter(f => f.id !== userId);
}

async function broadcastToFriends(userId, event, data, io) {
  const friends = await getOnlineFriends(userId, io);
  friends.forEach(friend => {
    const socketId = userSockets.get(friend.id);
    if (socketId) {
      io.to(socketId).emit(event, data);
    }
  });
}

module.exports = (io) => {
  io.on('connection', (socket) => {
    console.log(`User connected: ${socket.id}`);
    let currentUser = null;
    let currentChannel = null;
    let currentVoiceChannel = null;

    socket.on('authenticate', async (userId) => {
      try {
        const user = await dbGet('SELECT id, username, avatar, status FROM users WHERE id = ?', [userId]);
        
        if (user) {
          currentUser = user;
          userSockets.set(userId, socket.id);
          
          await dbRun("UPDATE users SET status = 'online' WHERE id = ?", [userId]);
          
          socket.emit('authenticated', { success: true, user });
          
          broadcastToFriends(userId, 'friend-online', {
            userId: user.id,
            username: user.username,
            avatar: user.avatar
          }, io);

          io.emit('user-status-change', {
            userId: user.id,
            status: 'online'
          });
        }
      } catch (error) {
        console.error('Authentication error:', error);
        socket.emit('authenticated', { success: false, error: 'Authentication failed' });
      }
    });

    socket.on('join-channel', (channelId) => {
      if (currentChannel) {
        socket.leave(currentChannel);
      }
      
      currentChannel = channelId;
      socket.join(channelId);
      
      socket.to(channelId).emit('user-joined-channel', {
        userId: currentUser?.id,
        username: currentUser?.username,
        channelId
      });
    });

    socket.on('leave-channel', (channelId) => {
      socket.leave(channelId);
      
      socket.to(channelId).emit('user-left-channel', {
        userId: currentUser?.id,
        username: currentUser?.username,
        channelId
      });
      
      if (currentChannel === channelId) {
        currentChannel = null;
      }
    });

    socket.on('send-message', (data) => {
      const { channelId, content, messageId, timestamp } = data;
      
      socket.to(channelId).emit('new-message', {
        id: messageId,
        channel_id: channelId,
        content,
        timestamp,
        sender_id: currentUser?.id,
        sender_username: currentUser?.username,
        sender_avatar: currentUser?.avatar
      });
    });

    socket.on('typing', (data) => {
      const { channelId, isTyping } = data;
      socket.to(channelId).emit('user-typing', {
        userId: currentUser?.id,
        username: currentUser?.username,
        channelId,
        isTyping
      });
    });

    socket.on('send-dm', (data) => {
      const { receiverId, content, messageId, timestamp } = data;
      
      const receiverSocketId = userSockets.get(receiverId);
      if (receiverSocketId) {
        io.to(receiverSocketId).emit('new-dm', {
          id: messageId,
          content,
          timestamp,
          sender_id: currentUser?.id,
          sender_username: currentUser?.username,
          sender_avatar: currentUser?.avatar,
          receiver_id: receiverId
        });
      }
    });

    socket.on('join-voice', (channelId) => {
      if (!voiceChannels.has(channelId)) {
        voiceChannels.set(channelId, new Set());
      }
      
      const channelUsers = voiceChannels.get(channelId);
      
      socket.to(channelId).emit('user-joined-voice', {
        userId: currentUser?.id,
        username: currentUser?.username,
        avatar: currentUser?.avatar,
        channelId
      });
      
      const existingUsers = Array.from(channelUsers).map(userId => {
        const userSocket = Array.from(io.sockets.sockets.values()).find(s => 
          userSockets.get(userId) === s.id
        );
        if (userSocket) {
          return dbGet('SELECT id, username, avatar FROM users WHERE id = ?', [userId]);
        }
        return null;
      }).filter(Boolean);

      Promise.all(existingUsers).then(users => {
        socket.emit('voice-channel-users', {
          channelId,
          users: users.filter(u => u)
        });
      });

      channelUsers.add(currentUser?.id);
      currentVoiceChannel = channelId;
      socket.join(`voice-${channelId}`);
    });

    socket.on('leave-voice', (channelId) => {
      if (voiceChannels.has(channelId)) {
        voiceChannels.get(channelId).delete(currentUser?.id);
      }
      
      socket.to(`voice-${channelId}`).emit('user-left-voice', {
        userId: currentUser?.id,
        username: currentUser?.username,
        channelId
      });
      
      socket.leave(`voice-${channelId}`);
      currentVoiceChannel = null;
    });

    socket.on('offer', (data) => {
      const { targetUserId, offer } = data;
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('offer', {
          userId: currentUser?.id,
          username: currentUser?.username,
          offer
        });
      }
    });

    socket.on('answer', (data) => {
      const { targetUserId, answer } = data;
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('answer', {
          userId: currentUser?.id,
          answer
        });
      }
    });

    socket.on('ice-candidate', (data) => {
      const { targetUserId, candidate } = data;
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('ice-candidate', {
          userId: currentUser?.id,
          candidate
        });
      }
    });

    socket.on('friend-request', (data) => {
      const { targetUserId, friendshipId } = data;
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('friend-request-received', {
          friendshipId,
          from: {
            id: currentUser?.id,
            username: currentUser?.username,
            avatar: currentUser?.avatar
          }
        });
      }
    });

    socket.on('friend-request-accepted', (data) => {
      const { targetUserId } = data;
      const targetSocketId = userSockets.get(targetUserId);
      if (targetSocketId) {
        io.to(targetSocketId).emit('friend-request-accepted-by', {
          user: {
            id: currentUser?.id,
            username: currentUser?.username,
            avatar: currentUser?.avatar,
            status: 'online'
          }
        });
      }
    });

    socket.on('disconnect', async () => {
      console.log(`User disconnected: ${socket.id}`);
      
      if (currentUser) {
        await dbRun("UPDATE users SET status = 'offline' WHERE id = ?", [currentUser.id]);
        
        userSockets.delete(currentUser.id);
        
        if (currentVoiceChannel && voiceChannels.has(currentVoiceChannel)) {
          voiceChannels.get(currentVoiceChannel).delete(currentUser.id);
          socket.to(`voice-${currentVoiceChannel}`).emit('user-left-voice', {
            userId: currentUser.id,
            username: currentUser.username,
            channelId: currentVoiceChannel
          });
        }
        
        broadcastToFriends(currentUser.id, 'friend-offline', {
          userId: currentUser.id,
          username: currentUser.username
        }, io);

        io.emit('user-status-change', {
          userId: currentUser.id,
          status: 'offline'
        });
      }
    });
  });
};
