# 🎙️ OwnDc WebRTC Documentation

OwnDc provides a production-ready WebRTC implementation for real-time communication between users.

## ✅ Available Features

### 1. 🎤 Voice Calls (1-on-1)
*   **High Quality Audio**: Includes echo cancellation, noise suppression, and automatic gain control.
*   **Real-time Signaling**: Instant call initiation and acceptance via Socket.IO.
*   **Mute/Deafen**: Full control over your audio input and output.

### 2. 📹 Video Calls (1-on-1)
*   **HD Video**: Support for 720p video streams with automatic fallback to basic quality.
*   **Live Preview**: See yourself and your friend in a dynamic video grid.
*   **Camera Toggle**: Quickly enable or disable your camera during a call.

### 3. 🖥️ Screen Sharing
*   **Integrated Sharing**: Share any window or screen directly within the video call interface.
*   **High Performance**: Uses `getDisplayMedia` API with optimized video track replacement.
*   **Auto-Detection**: Automatically restores camera view when screen sharing is stopped.

## 🛠️ Technical Implementation

### Peer-to-Peer Architecture
*   **ICE Servers**: Configuration includes 9 reliable Google STUN servers for maximum NAT traversal success.
*   **TURN Relay**: Integrated OpenRelay TURN server support for environments where direct P2P connections are restricted.
*   **Signaling**: Robust signaling protocol handling Offers, Answers, and ICE Candidates via Socket.IO.

### Key Files
*   `socket.js`: Backend signaling and call state management.
*   `public/js/app.js`: Frontend WebRTC logic, media stream management, and UI controls.
*   `public/index.html`: Optimized call interfaces for voice and video.

## 🚀 Deployment for WebRTC
WebRTC requires a secure context (HTTPS) in production.
*   **Railway Ready**: The application is pre-configured for Railway deployment with environment-based signaling.
*   **STUN/TURN Fallback**: Designed to work reliably across different network configurations.

---
*Documentation generated on 2026-02-14*
