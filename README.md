# Relay — Messaging Platform

An independent, original-brand messaging starter inspired by common chat apps. This project is separate from all other repositories and is not affiliated with Telegram or another messaging provider.

## Features
- Responsive web UI for mobile and desktop
- Account registration/sign-in with salted scrypt password hashes
- Signed expiring bearer tokens
- Search users, create direct conversations and group conversations
- Send text messages, poll for new messages, and show unread counts
- Editable display name and bio through the API
- Local JSON persistence for development
- Node built-in HTTP server; no third-party runtime packages required

## Requirements
- Node.js 20+

## Run locally
```bash
npm test
npm start
```
Then open `http://localhost:3000`.

## Important production gaps
This is a functional starter, not a production-scale Telegram replacement. It does not yet implement end-to-end encryption, voice/video calls, bots, channels/broadcast lists, message reactions, reliable push notifications, multi-device key management, abuse reporting, or scalable database/media infrastructure. The polling client is for a small prototype, not high-volume use. Set a strong `APP_SECRET`, use HTTPS, and replace JSON persistence with a managed database before public deployment. Uploaded attachments are not implemented in this version.

## API overview
- `GET /api/health`
- `POST /api/auth/register`
- `POST /api/auth/login`
- `GET/PATCH /api/me`
- `GET /api/users?q=...`
- `GET/POST /api/chats`
- `GET/POST /api/chats/:id/messages`
- `POST /api/logout`
