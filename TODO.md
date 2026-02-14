# Fix Authentication Issues - Todo List

## Issue
Frontend fetch calls don't include credentials, causing session cookies not to be sent to the API endpoints.

## Root Cause
The frontend JavaScript (app.js) was making fetch calls to the backend API without including `credentials: 'same-origin'`, which meant the session cookie wasn't being sent with requests. This caused `req.session.userId` to be undefined on the server, triggering the "Not authenticated" error.

## Fix Applied
Added `credentials: 'same-origin'` to all fetch calls that require authentication:
- /api/auth/me (checkAuth)
- /api/auth/login
- /api/auth/register
- /api/auth/logout
- /api/servers (GET, POST)
- /api/servers/:id
- /api/servers/join/:code
- /api/servers/:id/members
- /api/friends
- /api/friends/request
- /api/friends/accept
- /api/friends/decline
- /api/users/me
- /api/users/me/password
- /api/groups
- /api/groups/:id
- /api/channels
- /api/channels/:id/messages
- /api/messages (POST)
- /api/messages/dm/:id (GET, POST)

## Tasks Completed
- [x] 1. Add credentials to fetch calls for all authentication-related endpoints
- [x] 2. Fix: Servers can now be created/loaded
- [x] 3. Fix: Friends can now be added
- [x] 4. Fix: Friend requests can now be accepted

