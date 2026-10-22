# CinemaSync — Render ready

## Deploy
Upload the contents of this folder to the **root** of a private GitHub repository (keep `public/index.html` and `public/app.js` inside `public/`). Do **not** upload `.env` or `node_modules`.

Render: New Web Service → connect repository → Node → build `npm install` → start `npm start` → health path `/health`. Keep root directory empty. Set GOOGLE_FOLDER_ID, GOOGLE_CLIENT_ID, GOOGLE_CLIENT_SECRET, GOOGLE_REFRESH_TOKEN in Render Environment; API key is optional for OAuth mode. Render provides PORT.

## Features
- Two-person room, join, leave, host end, notifications, chat, Drive library/video streaming, YouTube sync, shared URL iframe.
- Third-party websites can refuse iframe embedding (CSP/X-Frame-Options). Their playback, clicks and scroll cannot be controlled by CinemaSync.
- Embedded audio/subtitle track switching is **not implemented**. External WebVTT subtitles are supported for Drive video.
- Rooms are held in memory and reset on Render instance restart. Free instance may sleep.
- Google Drive video passes through Render and consumes hosting bandwidth.
- Use only video content you have rights to access and share.
- Rotate previously exposed OAuth client secrets and refresh tokens before deploying.

## Local test
`npm install` then `npm start`, visit http://localhost:3000 and /health.
