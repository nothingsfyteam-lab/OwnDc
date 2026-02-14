# OwnDc - Discord-like Voice & Chat Platform

A fully functional voice and chat platform where users can register, add friends, create channels, text chat in real-time, and make voice calls (1:1 and group).

## Features

- **User Authentication**: Register and login with session-based authentication
- **Friends System**: Send/accept/decline friend requests, see online status
- **Text Channels**: Create and join text channels with real-time messaging
- **Voice Channels**: Join voice channels with WebRTC peer-to-peer audio
- **Direct Messages**: Private messaging between friends
- **Groups**: Create group chats
- **Real-time Updates**: Live messaging, typing indicators, and online status
- **Dark Theme**: Discord-inspired UI design

## Tech Stack

- **Backend**: Node.js + Express
- **Real-time**: Socket.IO
- **Voice**: WebRTC (peer-to-peer via Socket.IO signaling)
- **Database**: SQLite via sqlite3
- **Auth**: Session-based with bcryptjs
- **Frontend**: Vanilla HTML / CSS / JS

## Installation

1. **Clone or download the project** to your local machine

2. **Install dependencies**:
   ```bash
   npm install
   ```

3. **Start the server**:
   ```bash
   npm start
   ```
   
   Or for development with auto-restart:
   ```bash
   npm run dev
   ```

4. **Open your browser** and navigate to:
   ```
    http://localhost:3000
    ```

## 🚀 Deployment

See **[DEPLOYMENT.md](DEPLOYMENT.md)** for detailed deployment instructions including:
- Deploy to Railway (Recommended - Free tier)
- Deploy to Render (Free tier)
- Deploy to Heroku
- Deploy to VPS/Dedicated Server
- Domain & SSL setup
- Environment variables

### Quick Deploy (Railway - Free)

1. Push your code to GitHub
2. Go to [railway.app](https://railway.app)
3. Click "New Project" → "Deploy from GitHub repo"
4. Select your repository
5. Done! Your app will be live at `https://your-project.up.railway.app`

## Usage

### Getting Started

1. **Register** a new account on the welcome screen
2. **Login** with your credentials
3. You'll see the main app interface with:
   - Server sidebar (left)
   - Channel/friends sidebar (middle)
   - Chat area (right)

### Features Guide

#### Adding Friends
- Click the user-plus icon in the bottom left
- Enter a username and click "Send Friend Request"
- Accept/decline incoming requests in the same modal

#### Creating Channels
- Click the + button in the server sidebar
- Choose between Text or Voice channel
- Enter a name and create

#### Text Chat
- Click on any text channel to open it
- Type messages in the input box at the bottom
- Press Enter or click the send button
- See real-time messages from other users

#### Voice Calls
- Join a voice channel by clicking on it
- Click "Join Voice" button in the header
- Allow microphone access when prompted
- Talk with other users in the channel
- Use Mute/Deafen/Disconnect controls

#### Direct Messages
- Click on any friend in the friends list
- Send private messages
- Real-time messaging with typing indicators

## File Structure

```
ownDc/
├── package.json          # Dependencies and scripts
├── server.js             # Main server entry point
├── db.js                 # Database initialization
├── socket.js             # Socket.IO event handlers
├── routes/
│   ├── auth.js           # Authentication routes
│   ├── friends.js        # Friends management
│   ├── channels.js       # Channel operations
│   ├── messages.js       # Messaging routes
│   └── groups.js         # Group management
├── public/
│   ├── index.html        # Main HTML file
│   ├── css/
│   │   └── style.css     # Styling
│   └── js/
│       └── app.js        # Frontend logic
└── database.sqlite       # SQLite database (created on first run)
```

## API Endpoints

### Authentication
- `POST /api/auth/register` - Register new user
- `POST /api/auth/login` - Login user
- `POST /api/auth/logout` - Logout user
- `GET /api/auth/me` - Get current user

### Friends
- `GET /api/friends` - Get friends list and requests
- `POST /api/friends/request` - Send friend request
- `POST /api/friends/accept` - Accept friend request
- `POST /api/friends/decline` - Decline friend request
- `DELETE /api/friends/:id` - Remove friend

### Channels
- `GET /api/channels` - List all channels
- `POST /api/channels` - Create channel
- `GET /api/channels/:id/messages` - Get channel messages
- `POST /api/channels/:id/join` - Join channel
- `POST /api/channels/:id/leave` - Leave channel
- `DELETE /api/channels/:id` - Delete channel

### Messages
- `POST /api/messages` - Send channel message
- `GET /api/dm/:userId` - Get direct messages
- `POST /api/dm/:userId` - Send direct message

### Groups
- `GET /api/groups` - List user's groups
- `POST /api/groups` - Create group
- `POST /api/groups/:id/members` - Add member
- `DELETE /api/groups/:id` - Delete group

## Socket.IO Events

### Client to Server
- `authenticate` - Authenticate socket connection
- `join-channel` - Join a text channel
- `leave-channel` - Leave a text channel
- `send-message` - Send a message to channel
- `send-dm` - Send direct message
- `typing` - Typing indicator
- `join-voice` - Join voice channel
- `leave-voice` - Leave voice channel
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - WebRTC ICE candidate

### Server to Client
- `authenticated` - Authentication confirmation
- `new-message` - New channel message
- `new-dm` - New direct message
- `user-typing` - User typing indicator
- `friend-request-received` - New friend request
- `friend-request-accepted-by` - Request accepted
- `friend-online` - Friend came online
- `friend-offline` - Friend went offline
- `user-joined-voice` - User joined voice
- `user-left-voice` - User left voice
- `offer` - WebRTC offer
- `answer` - WebRTC answer
- `ice-candidate` - WebRTC ICE candidate

## Testing

### Browser Testing
1. Open http://localhost:3000 in two different browser tabs
2. Register two different users
3. Send friend requests between them
4. Accept the requests
5. Create a channel and join from both users
6. Send messages and verify real-time updates
7. Join a voice channel and test audio

### Voice Testing
1. Create a voice channel
2. Join from User A (allow microphone)
3. Join from User B in another tab/browser
4. Speak into microphone
5. Verify audio is transmitted between users

## Security Notes

- Change the session secret in production
- Use HTTPS in production
- Implement rate limiting for production use
- Add input validation and sanitization
- Use environment variables for sensitive data

## Troubleshooting

### Port already in use
Change the port in `server.js`:
```javascript
const PORT = process.env.PORT || 3001;
```

### Database locked
Stop the server and delete `database.sqlite`, then restart.

### Microphone not working
- Ensure you're using HTTPS or localhost
- Check browser permissions
- Verify microphone is not being used by another app

## License

MIT
