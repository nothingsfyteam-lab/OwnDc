/**
 * OwnDc - Main Application Logic
 * Handles authentication, messaging, voice calls, and real-time updates
 */

// Global State
let currentUser = null;
let socket = null;
let currentChannel = null;
let currentView = 'home';
let channels = [];
let friends = [];
let groups = [];
let selectedChannelType = 'text';

// Voice State
let localStream = null;
let peerConnections = new Map();
let isMuted = false;
let isDeafened = false;
let currentVoiceChannel = null;
let voiceParticipants = new Map();

// Typing State
let typingTimeout = null;

// Initialize
window.addEventListener('DOMContentLoaded', () => {
  checkAuth();
});

// ==================== AUTHENTICATION ====================

async function checkAuth() {
  try {
    const response = await fetch('/api/auth/me');
    if (response.ok) {
      currentUser = await response.json();
      showApp();
      initializeSocket();
    } else {
      showAuth();
    }
  } catch (error) {
    console.error('Auth check error:', error);
    showAuth();
  }
}

function showAuth() {
  document.getElementById('auth-container').classList.remove('hidden');
  document.getElementById('app-container').classList.add('hidden');
  showLogin();
}

function showApp() {
  document.getElementById('auth-container').classList.add('hidden');
  document.getElementById('app-container').classList.remove('hidden');
  updateUserPanel();
  loadData();
}

function showLogin() {
  document.getElementById('login-form').classList.remove('hidden');
  document.getElementById('register-form').classList.add('hidden');
}

function showRegister() {
  document.getElementById('login-form').classList.add('hidden');
  document.getElementById('register-form').classList.remove('hidden');
}

async function handleLogin() {
  const email = document.getElementById('login-email').value;
  const password = document.getElementById('login-password').value;
  const errorDiv = document.getElementById('login-error');

  if (!email || !password) {
    errorDiv.textContent = 'Please fill in all fields';
    return;
  }

  try {
    const response = await fetch('/api/auth/login', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password })
    });

    if (response.ok) {
      currentUser = await response.json();
      showApp();
      initializeSocket();
    } else {
      const error = await response.json();
      errorDiv.textContent = error.error || 'Login failed';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error. Please try again.';
  }
}

async function handleRegister() {
  const username = document.getElementById('register-username').value;
  const email = document.getElementById('register-email').value;
  const password = document.getElementById('register-password').value;
  const errorDiv = document.getElementById('register-error');

  if (!username || !email || !password) {
    errorDiv.textContent = 'Please fill in all fields';
    return;
  }

  if (password.length < 6) {
    errorDiv.textContent = 'Password must be at least 6 characters';
    return;
  }

  try {
    const response = await fetch('/api/auth/register', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username, email, password })
    });

    if (response.ok) {
      currentUser = await response.json();
      showApp();
      initializeSocket();
    } else {
      const error = await response.json();
      errorDiv.textContent = error.error || 'Registration failed';
    }
  } catch (error) {
    errorDiv.textContent = 'Network error. Please try again.';
  }
}

async function logout() {
  try {
    await fetch('/api/auth/logout', { method: 'POST' });
    if (socket) socket.disconnect();
    currentUser = null;
    showAuth();
  } catch (error) {
    console.error('Logout error:', error);
  }
}

// ==================== SOCKET.IO ====================

function initializeSocket() {
  socket = io();

  socket.on('connect', () => {
    console.log('Socket connected');
    socket.emit('authenticate', currentUser.id);
  });

  socket.on('authenticated', (data) => {
    if (data.success) {
      console.log('Socket authenticated');
    }
  });

  socket.on('new-message', (message) => {
    if (currentChannel && currentChannel.id === message.channel_id) {
      displayMessage(message);
      scrollToBottom();
    }
  });

  socket.on('new-dm', (message) => {
    if (currentChannel && currentChannel.type === 'dm' && 
        (currentChannel.userId === message.sender_id || currentChannel.userId === message.receiver_id)) {
      displayMessage(message);
      scrollToBottom();
    }
  });

  socket.on('user-typing', (data) => {
    if (currentChannel && currentChannel.id === data.channelId) {
      showTypingIndicator(data.username, data.isTyping);
    }
  });

  socket.on('friend-request-received', (data) => {
    showNotification('New friend request from ' + data.from.username, 'info');
    loadFriends();
  });

  socket.on('friend-request-accepted-by', (data) => {
    showNotification(data.user.username + ' accepted your friend request', 'success');
    loadFriends();
  });

  socket.on('friend-online', (data) => {
    updateFriendStatus(data.userId, 'online');
    showNotification(data.username + ' is now online', 'info');
  });

  socket.on('friend-offline', (data) => {
    updateFriendStatus(data.userId, 'offline');
  });

  // Voice Events
  socket.on('user-joined-voice', (data) => {
    if (currentVoiceChannel === data.channelId) {
      addVoiceParticipant(data);
      initiatePeerConnection(data.userId);
    }
  });

  socket.on('user-left-voice', (data) => {
    if (currentVoiceChannel === data.channelId) {
      removeVoiceParticipant(data.userId);
      closePeerConnection(data.userId);
    }
  });

  socket.on('voice-channel-users', (data) => {
    data.users.forEach(user => {
      if (user.id !== currentUser.id) {
        addVoiceParticipant(user);
        initiatePeerConnection(user.id);
      }
    });
  });

  // WebRTC Signaling
  socket.on('offer', async (data) => {
    await handleOffer(data.userId, data.offer);
  });

  socket.on('answer', async (data) => {
    await handleAnswer(data.userId, data.answer);
  });

  socket.on('ice-candidate', async (data) => {
    await handleIceCandidate(data.userId, data.candidate);
  });
}

// ==================== DATA LOADING ====================

async function loadData() {
  await Promise.all([
    loadChannels(),
    loadFriends(),
    loadGroups()
  ]);
}

async function loadChannels() {
  try {
    const response = await fetch('/api/channels');
    if (response.ok) {
      const data = await response.json();
      channels = data.all;
      renderChannels();
    }
  } catch (error) {
    console.error('Error loading channels:', error);
  }
}

async function loadFriends() {
  try {
    const response = await fetch('/api/friends');
    if (response.ok) {
      const data = await response.json();
      friends = data.friends;
      renderFriends();
      renderFriendRequests(data.pendingRequests);
    }
  } catch (error) {
    console.error('Error loading friends:', error);
  }
}

async function loadGroups() {
  try {
    const response = await fetch('/api/groups');
    if (response.ok) {
      groups = await response.json();
      renderGroups();
    }
  } catch (error) {
    console.error('Error loading groups:', error);
  }
}

// ==================== UI RENDERING ====================

function updateUserPanel() {
  document.getElementById('user-name').textContent = currentUser.username;
  document.getElementById('user-avatar').textContent = currentUser.username.charAt(0).toUpperCase();
}

function renderChannels() {
  const textContainer = document.getElementById('text-channels');
  const voiceContainer = document.getElementById('voice-channels');
  
  textContainer.innerHTML = '';
  voiceContainer.innerHTML = '';

  channels.forEach(channel => {
    const channelEl = document.createElement('div');
    channelEl.className = 'channel-item' + (currentChannel?.id === channel.id ? ' active' : '');
    channelEl.onclick = () => selectChannel(channel);
    
    if (channel.type === 'text') {
      channelEl.innerHTML = `<i class="fas fa-hashtag"></i><span>${channel.name}</span>`;
      textContainer.appendChild(channelEl);
    } else {
      channelEl.innerHTML = `<i class="fas fa-volume-up"></i><span>${channel.name}</span>`;
      voiceContainer.appendChild(channelEl);
    }
  });
}

function renderFriends() {
  const container = document.getElementById('friends-list');
  container.innerHTML = '';

  friends.forEach(friend => {
    const friendEl = document.createElement('div');
    friendEl.className = 'friend-item' + (currentChannel?.type === 'dm' && currentChannel?.userId === friend.id ? ' active' : '');
    friendEl.onclick = () => openDM(friend);
    
    const avatarLetter = friend.username.charAt(0).toUpperCase();
    const statusClass = friend.user_status === 'online' ? 'online' : 'offline';
    
    friendEl.innerHTML = `
      <div class="friend-avatar">${avatarLetter}</div>
      <div class="status-indicator ${statusClass}"></div>
      <span class="friend-name">${friend.username}</span>
    `;
    
    container.appendChild(friendEl);
  });
}

function renderGroups() {
  const container = document.getElementById('groups-list');
  container.innerHTML = '';

  groups.forEach(group => {
    const groupEl = document.createElement('div');
    groupEl.className = 'group-item' + (currentChannel?.type === 'group' && currentChannel?.id === group.id ? ' active' : '');
    groupEl.onclick = () => selectGroup(group);
    
    const avatarLetter = group.name.charAt(0).toUpperCase();
    
    groupEl.innerHTML = `
      <div class="group-avatar">${avatarLetter}</div>
      <span class="group-name">${group.name}</span>
    `;
    
    container.appendChild(groupEl);
  });
}

function renderFriendRequests(requests) {
  const container = document.getElementById('friend-requests-list');
  if (!container) return;
  
  container.innerHTML = '';

  requests.forEach(request => {
    const requestEl = document.createElement('div');
    requestEl.className = 'friend-request-item';
    
    const avatarLetter = request.username.charAt(0).toUpperCase();
    
    requestEl.innerHTML = `
      <div class="friend-request-info">
        <div class="friend-avatar">${avatarLetter}</div>
        <span>${request.username}</span>
      </div>
      <div class="friend-request-actions">
        <button class="accept-btn" onclick="acceptFriendRequest('${request.friendship_id}')">Accept</button>
        <button class="decline-btn" onclick="declineFriendRequest('${request.friendship_id}')">Decline</button>
      </div>
    `;
    
    container.appendChild(requestEl);
  });
}

// ==================== CHANNEL/DM/GROUP SELECTION ====================

async function selectChannel(channel) {
  if (currentChannel?.id === channel.id) return;

  if (currentChannel) {
    socket.emit('leave-channel', currentChannel.id);
  }

  currentChannel = channel;
  currentView = 'channel';
  
  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('messages-list').innerHTML = '';
  document.getElementById('message-input-container').style.display = 'block';
  document.getElementById('header-title').textContent = channel.name;
  document.getElementById('header-icon').className = channel.type === 'voice' ? 'fas fa-volume-up' : 'fas fa-hashtag';
  document.getElementById('message-input').placeholder = `Message #${channel.name}`;
  
  const voiceBtn = document.getElementById('voice-join-btn');
  voiceBtn.style.display = channel.type === 'voice' ? 'flex' : 'none';
  
  renderChannels();
  
  socket.emit('join-channel', channel.id);
  
  if (channel.type === 'text') {
    await loadChannelMessages(channel.id);
  }
}

async function openDM(friend) {
  if (currentChannel?.type === 'dm' && currentChannel?.userId === friend.id) return;

  currentChannel = {
    type: 'dm',
    userId: friend.id,
    name: friend.username,
    id: `dm-${friend.id}`
  };
  currentView = 'dm';
  
  document.getElementById('welcome-screen').classList.add('hidden');
  document.getElementById('messages-list').innerHTML = '';
  document.getElementById('message-input-container').style.display = 'block';
  document.getElementById('header-title').textContent = friend.username;
  document.getElementById('header-icon').className = 'fas fa-user';
  document.getElementById('message-input').placeholder = `Message @${friend.username}`;
  document.getElementById('voice-join-btn').style.display = 'none';
  
  renderFriends();
  
  await loadDMMessages(friend.id);
}

async function selectGroup(group) {
  showNotification('Group chat coming soon!', 'info');
}

function showHome() {
  currentChannel = null;
  currentView = 'home';
  
  document.getElementById('welcome-screen').classList.remove('hidden');
  document.getElementById('messages-list').innerHTML = '';
  document.getElementById('message-input-container').style.display = 'none';
  document.getElementById('header-title').textContent = 'Welcome';
  document.getElementById('header-icon').className = 'fas fa-home';
  document.getElementById('voice-join-btn').style.display = 'none';
  
  renderChannels();
}

// ==================== MESSAGES ====================

async function loadChannelMessages(channelId) {
  try {
    const response = await fetch(`/api/channels/${channelId}/messages`);
    if (response.ok) {
      const messages = await response.json();
      messages.forEach(msg => displayMessage(msg));
      scrollToBottom();
    }
  } catch (error) {
    console.error('Error loading messages:', error);
  }
}

async function loadDMMessages(userId) {
  try {
    const response = await fetch(`/api/messages/dm/${userId}`);
    if (response.ok) {
      const messages = await response.json();
      messages.forEach(msg => displayMessage(msg));
      scrollToBottom();
    }
  } catch (error) {
    console.error('Error loading DMs:', error);
  }
}

function displayMessage(message) {
  const container = document.getElementById('messages-list');
  
  const messageEl = document.createElement('div');
  messageEl.className = 'message';
  
  const isOwn = message.sender_id === currentUser.id;
  const avatarLetter = message.sender_username?.charAt(0).toUpperCase() || '?';
  const time = new Date(message.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  
  messageEl.innerHTML = `
    <div class="message-avatar">${avatarLetter}</div>
    <div class="message-content">
      <div class="message-header">
        <span class="message-author">${message.sender_username || 'Unknown'}</span>
        <span class="message-time">${time}</span>
      </div>
      <div class="message-text">${escapeHtml(message.content)}</div>
    </div>
  `;
  
  container.appendChild(messageEl);
}

async function sendMessage() {
  const input = document.getElementById('message-input');
  const content = input.value.trim();
  
  if (!content || !currentChannel) return;
  
  input.value = '';
  
  try {
    if (currentChannel.type === 'dm') {
      const response = await fetch(`/api/messages/dm/${currentChannel.userId}`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ content })
      });
      
      if (response.ok) {
        const message = await response.json();
        displayMessage(message);
        scrollToBottom();
        
        socket.emit('send-dm', {
          receiverId: currentChannel.userId,
          content,
          messageId: message.id,
          timestamp: message.timestamp
        });
      }
    } else {
      const response = await fetch('/api/messages', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ channelId: currentChannel.id, content })
      });
      
      if (response.ok) {
        const message = await response.json();
        displayMessage(message);
        scrollToBottom();
        
        socket.emit('send-message', {
          channelId: currentChannel.id,
          content,
          messageId: message.id,
          timestamp: message.timestamp
        });
      }
    }
  } catch (error) {
    console.error('Error sending message:', error);
  }
}

function handleMessageKeypress(event) {
  if (event.key === 'Enter') {
    sendMessage();
  }
}

function handleTyping() {
  if (!currentChannel || currentChannel.type === 'dm') return;
  
  socket.emit('typing', {
    channelId: currentChannel.id,
    isTyping: true
  });
  
  clearTimeout(typingTimeout);
  typingTimeout = setTimeout(() => {
    socket.emit('typing', {
      channelId: currentChannel.id,
      isTyping: false
    });
  }, 3000);
}

function showTypingIndicator(username, isTyping) {
  const indicator = document.getElementById('typing-indicator');
  if (isTyping) {
    indicator.textContent = `${username} is typing...`;
  } else {
    indicator.textContent = '';
  }
}

function scrollToBottom() {
  const container = document.getElementById('messages-container');
  container.scrollTop = container.scrollHeight;
}

// ==================== FRIENDS ====================

function showAddFriend() {
  openModal('add-friend-modal');
  loadFriends();
}

async function sendFriendRequest() {
  const username = document.getElementById('friend-username').value.trim();
  if (!username) return;
  
  try {
    const response = await fetch('/api/friends/request', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ username })
    });
    
    if (response.ok) {
      const data = await response.json();
      showNotification('Friend request sent!', 'success');
      document.getElementById('friend-username').value = '';
      
      socket.emit('friend-request', {
        targetUserId: data.friend.id,
        friendshipId: data.friendship_id
      });
    } else {
      const error = await response.json();
      showNotification(error.error, 'error');
    }
  } catch (error) {
    showNotification('Failed to send friend request', 'error');
  }
}

async function acceptFriendRequest(friendshipId) {
  try {
    const response = await fetch('/api/friends/accept', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId })
    });
    
    if (response.ok) {
      const data = await response.json();
      showNotification('Friend request accepted!', 'success');
      loadFriends();
      
      const db = await fetch('/api/friends').then(r => r.json());
      const friend = db.friends.find(f => f.friendship_id === friendshipId);
      if (friend) {
        socket.emit('friend-request-accepted', { targetUserId: friend.id });
      }
    }
  } catch (error) {
    showNotification('Failed to accept request', 'error');
  }
}

async function declineFriendRequest(friendshipId) {
  try {
    await fetch('/api/friends/decline', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ friendshipId })
    });
    loadFriends();
  } catch (error) {
    console.error('Error declining request:', error);
  }
}

function updateFriendStatus(userId, status) {
  const friend = friends.find(f => f.id === userId);
  if (friend) {
    friend.user_status = status;
    renderFriends();
  }
}

// ==================== CHANNELS ====================

function showCreateChannel() {
  openModal('create-channel-modal');
}

function selectChannelType(type) {
  selectedChannelType = type;
  document.querySelectorAll('.type-btn').forEach(btn => {
    btn.classList.remove('active');
  });
  document.querySelector(`.type-btn[data-type="${type}"]`).classList.add('active');
}

async function createChannel() {
  const name = document.getElementById('channel-name').value.trim();
  if (!name) return;
  
  try {
    const response = await fetch('/api/channels', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name, type: selectedChannelType })
    });
    
    if (response.ok) {
      const channel = await response.json();
      showNotification('Channel created!', 'success');
      closeModal('create-channel-modal');
      document.getElementById('channel-name').value = '';
      await loadChannels();
      selectChannel(channel);
    }
  } catch (error) {
    showNotification('Failed to create channel', 'error');
  }
}

// ==================== GROUPS ====================

function showCreateGroup() {
  openModal('create-group-modal');
}

async function createGroup() {
  const name = document.getElementById('group-name').value.trim();
  if (!name) return;
  
  try {
    const response = await fetch('/api/groups', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name })
    });
    
    if (response.ok) {
      showNotification('Group created!', 'success');
      closeModal('create-group-modal');
      document.getElementById('group-name').value = '';
      loadGroups();
    }
  } catch (error) {
    showNotification('Failed to create group', 'error');
  }
}

// ==================== VOICE CALLS (WebRTC) ====================

async function toggleVoiceChannel() {
  if (currentVoiceChannel) {
    leaveVoiceChannel();
  } else {
    await joinVoiceChannel();
  }
}

async function joinVoiceChannel() {
  if (!currentChannel || currentChannel.type !== 'voice') return;
  
  try {
    localStream = await navigator.mediaDevices.getUserMedia({ audio: true, video: false });
    
    currentVoiceChannel = currentChannel.id;
    document.getElementById('voice-overlay').classList.remove('hidden');
    document.getElementById('voice-join-btn').innerHTML = '<i class="fas fa-phone-slash"></i> Leave Voice';
    document.getElementById('voice-join-btn').style.background = 'var(--danger)';
    
    // Add self to participants
    addVoiceParticipant({
      userId: currentUser.id,
      username: currentUser.username,
      avatar: currentUser.avatar,
      isSelf: true
    });
    
    socket.emit('join-voice', currentChannel.id);
    
    showNotification('Joined voice channel', 'success');
  } catch (error) {
    console.error('Error accessing microphone:', error);
    showNotification('Could not access microphone', 'error');
  }
}

function leaveVoiceChannel() {
  if (currentVoiceChannel) {
    socket.emit('leave-voice', currentVoiceChannel);
    
    // Close all peer connections
    peerConnections.forEach((pc, userId) => {
      closePeerConnection(userId);
    });
    
    // Stop local stream
    if (localStream) {
      localStream.getTracks().forEach(track => track.stop());
      localStream = null;
    }
    
    currentVoiceChannel = null;
    voiceParticipants.clear();
    
    document.getElementById('voice-overlay').classList.add('hidden');
    document.getElementById('voice-participants').innerHTML = '';
    
    if (currentChannel?.type === 'voice') {
      document.getElementById('voice-join-btn').innerHTML = '<i class="fas fa-phone"></i> Join Voice';
      document.getElementById('voice-join-btn').style.background = 'var(--success)';
    }
    
    isMuted = false;
    isDeafened = false;
    updateVoiceButtons();
  }
}

function addVoiceParticipant(user) {
  if (voiceParticipants.has(user.userId)) return;
  
  voiceParticipants.set(user.userId, user);
  
  const container = document.getElementById('voice-participants');
  const participantEl = document.createElement('div');
  participantEl.className = 'voice-participant';
  participantEl.id = `voice-participant-${user.userId}`;
  
  const avatarLetter = user.username?.charAt(0).toUpperCase() || '?';
  
  participantEl.innerHTML = `
    <div class="voice-participant-avatar ${user.isSelf ? '' : ''}">${avatarLetter}</div>
    <span class="voice-participant-name">${user.username}${user.isSelf ? ' (You)' : ''}</span>
  `;
  
  container.appendChild(participantEl);
}

function removeVoiceParticipant(userId) {
  voiceParticipants.delete(userId);
  const el = document.getElementById(`voice-participant-${userId}`);
  if (el) el.remove();
}

async function initiatePeerConnection(userId) {
  if (!localStream) return;
  
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });
  
  peerConnections.set(userId, pc);
  
  // Add local stream
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });
  
  // Handle remote stream
  pc.ontrack = (event) => {
    const audio = new Audio();
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
  };
  
  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        targetUserId: userId,
        candidate: event.candidate
      });
    }
  };
  
  // Create offer
  try {
    const offer = await pc.createOffer();
    await pc.setLocalDescription(offer);
    
    socket.emit('offer', {
      targetUserId: userId,
      offer: offer
    });
  } catch (error) {
    console.error('Error creating offer:', error);
  }
}

async function handleOffer(userId, offer) {
  if (!localStream) return;
  
  const pc = new RTCPeerConnection({
    iceServers: [
      { urls: 'stun:stun.l.google.com:19302' },
      { urls: 'stun:stun1.l.google.com:19302' }
    ]
  });
  
  peerConnections.set(userId, pc);
  
  // Add local stream
  localStream.getTracks().forEach(track => {
    pc.addTrack(track, localStream);
  });
  
  // Handle remote stream
  pc.ontrack = (event) => {
    const audio = new Audio();
    audio.srcObject = event.streams[0];
    audio.autoplay = true;
  };
  
  // Handle ICE candidates
  pc.onicecandidate = (event) => {
    if (event.candidate) {
      socket.emit('ice-candidate', {
        targetUserId: userId,
        candidate: event.candidate
      });
    }
  };
  
  try {
    await pc.setRemoteDescription(offer);
    const answer = await pc.createAnswer();
    await pc.setLocalDescription(answer);
    
    socket.emit('answer', {
      targetUserId: userId,
      answer: answer
    });
  } catch (error) {
    console.error('Error handling offer:', error);
  }
}

async function handleAnswer(userId, answer) {
  const pc = peerConnections.get(userId);
  if (pc) {
    try {
      await pc.setRemoteDescription(answer);
    } catch (error) {
      console.error('Error handling answer:', error);
    }
  }
}

async function handleIceCandidate(userId, candidate) {
  const pc = peerConnections.get(userId);
  if (pc) {
    try {
      await pc.addIceCandidate(new RTCIceCandidate(candidate));
    } catch (error) {
      console.error('Error handling ICE candidate:', error);
    }
  }
}

function closePeerConnection(userId) {
  const pc = peerConnections.get(userId);
  if (pc) {
    pc.close();
    peerConnections.delete(userId);
  }
}

function toggleMute() {
  if (localStream) {
    isMuted = !isMuted;
    localStream.getAudioTracks().forEach(track => {
      track.enabled = !isMuted;
    });
    updateVoiceButtons();
  }
}

function toggleDeafen() {
  isDeafened = !isDeafened;
  peerConnections.forEach(pc => {
    pc.getReceivers().forEach(receiver => {
      if (receiver.track) {
        receiver.track.enabled = !isDeafened;
      }
    });
  });
  updateVoiceButtons();
}

function updateVoiceButtons() {
  const muteBtn = document.getElementById('mute-btn');
  const deafenBtn = document.getElementById('deafen-btn');
  
  muteBtn.classList.toggle('muted', isMuted);
  muteBtn.innerHTML = isMuted ? '<i class="fas fa-microphone-slash"></i><span>Unmute</span>' : '<i class="fas fa-microphone"></i><span>Mute</span>';
  
  deafenBtn.classList.toggle('deafened', isDeafened);
  deafenBtn.innerHTML = isDeafened ? '<i class="fas fa-deaf"></i><span>Undeafen</span>' : '<i class="fas fa-headphones"></i><span>Deafen</span>';
}

function showChannelMembers() {
  showNotification('Channel members feature coming soon!', 'info');
}

// ==================== UI UTILITIES ====================

function openModal(modalId) {
  document.getElementById(modalId).classList.remove('hidden');
}

function closeModal(modalId) {
  document.getElementById(modalId).classList.add('hidden');
}

function toggleSection(sectionId) {
  const section = document.getElementById(sectionId);
  const chevron = document.getElementById(sectionId === 'friends-list' ? 'friends-chevron' : 'groups-chevron');
  
  if (section.style.display === 'none') {
    section.style.display = 'block';
    chevron.style.transform = 'rotate(0deg)';
  } else {
    section.style.display = 'none';
    chevron.style.transform = 'rotate(-90deg)';
  }
}

function showNotification(message, type = 'info') {
  const container = document.getElementById('notifications');
  
  const notification = document.createElement('div');
  notification.className = `notification ${type}`;
  
  const icon = type === 'success' ? 'check-circle' : type === 'error' ? 'exclamation-circle' : 'info-circle';
  
  notification.innerHTML = `
    <i class="fas fa-${icon}"></i>
    <span>${message}</span>
  `;
  
  container.appendChild(notification);
  
  setTimeout(() => {
    notification.style.opacity = '0';
    notification.style.transform = 'translateX(100%)';
    setTimeout(() => notification.remove(), 300);
  }, 3000);
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

// Close modals on outside click
window.onclick = function(event) {
  if (event.target.classList.contains('modal')) {
    event.target.classList.add('hidden');
  }
};
