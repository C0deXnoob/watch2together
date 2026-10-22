# CinemaSync Next (prototype)

## Setup
1. Install Node.js 20+.
2. Copy `.env.example` to `.env` and fill in your **newly rotated** Google OAuth credentials and folder ID. Do not commit or share `.env`.
3. Run `npm install` then `npm start`.
4. Open http://localhost:3000 in two browser windows. Create a room, join it from the other window, and select a video.
5. To watch from another city, deploy the Node.js app to an HTTPS host supporting WebSockets and streaming bandwidth. Do not expose the local server directly without authentication and rate limiting.

## Modes
- Google Drive: recursively lists nested folder movies and streams authorized files via server with Range support. Compatible MP4 (H.264/AAC) recommended. MKV and HEVC often do not play in browsers.
- YouTube: video IDs via YouTube IFrame Player API, basic synchronized play/pause/seek. Embedding may be disabled by video owner; autoplay may require user gesture. No video data through TURN.
- Other websites: share a URL with both users and open separately. **Does not synchronize arbitrary site playback**, bypass iframe/DRM restrictions, or share tabs. Browser extension plus site-specific integrations would be needed for supported sites.
- Subtitles: local .vtt files (each user chooses their own); no embedded multi-audio switching yet. For that, a separate FFmpeg remux/transcode + HLS multi-rendition pipeline is required.

## Limitations
This is a fresh prototype because the uploaded ZIP contained only empty directories. It is not a patch to the user's last working version. OAuth and playback have not been live-tested against the user's private Drive. Rooms are in memory, no persistent state, no access control on stream endpoint beyond the discovered library, no rate limiting; do not deploy publicly without hardening. Google Drive streaming goes through the Node host and consumes host bandwidth, not Metered TURN bandwidth. Credentials previously posted in chat must be rotated and refresh token revoked.
