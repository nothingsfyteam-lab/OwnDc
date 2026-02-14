const express = require('express');
const session = require('express-session');
const path = require('path');
const http = require('http');
const os = require('os');
const { Server } = require('socket.io');
const { initDatabase } = require('./db');
const socketHandler = require('./socket');

const app = express();
const server = http.createServer(app);
const io = new Server(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"]
  }
});

// Get local IP address
function getLocalIP() {
  const interfaces = os.networkInterfaces();
  for (const name of Object.keys(interfaces)) {
    for (const iface of interfaces[name]) {
      // Skip internal and non-IPv4 addresses
      if (iface.family === 'IPv4' && !iface.internal) {
        return iface.address;
      }
    }
  }
  return 'localhost';
}

async function startServer() {
  try {
    await initDatabase();
    
    app.use(express.json());
    app.use(express.urlencoded({ extended: true }));
    app.use(express.static(path.join(__dirname, 'public')));

    app.use(session({
      secret: 'owndc-secret-key-change-in-production',
      resave: false,
      saveUninitialized: false,
      cookie: {
        secure: false,
        maxAge: 24 * 60 * 60 * 1000
      }
    }));

    // Routes
    const authRoutes = require('./routes/auth');
    const friendsRoutes = require('./routes/friends');
    const serversRoutes = require('./routes/servers');
    const channelsRoutes = require('./routes/channels');
    const messagesRoutes = require('./routes/messages');
    const groupsRoutes = require('./routes/groups');
    const reactionsRoutes = require('./routes/reactions');
    const threadsRoutes = require('./routes/threads');
    const uploadsRoutes = require('./routes/uploads');
    const usersRoutes = require('./routes/users');

    app.use('/api/auth', authRoutes);
    app.use('/api/friends', friendsRoutes);
    app.use('/api/servers', serversRoutes);
    app.use('/api/channels', channelsRoutes);
    app.use('/api/messages', messagesRoutes);
    app.use('/api/groups', groupsRoutes);
    app.use('/api/reactions', reactionsRoutes);
    app.use('/api/threads', threadsRoutes);
    app.use('/api/uploads', uploadsRoutes);
    app.use('/api/users', usersRoutes);

    app.get('/', (req, res) => {
      res.sendFile(path.join(__dirname, 'public', 'index.html'));
    });

    socketHandler(io);

    const PORT = process.env.PORT || 3000;
    const HOST = '0.0.0.0'; // Listen on all network interfaces
    const localIP = getLocalIP();

    server.listen(PORT, HOST, () => {
      console.log(`🚀 OwnDc server running on http://localhost:${PORT}`);
      console.log(`🌐 Network accessible at: http://${localIP}:${PORT}`);
      console.log(`📱 Open your browser and visit the URL above`);
    });
  } catch (error) {
    console.error('Failed to start server:', error);
    process.exit(1);
  }
}

startServer();

module.exports = { app, io };
