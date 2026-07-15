# Jam Room App

Collaborative “listen together” rooms built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, **Supabase** (Postgres + Realtime + Auth), **YouTube** (in-room playback), **Cloudflare R2** (My Library audio storage), and **Zustand**.

See [docs/PRD.md](docs/PRD.md) for full product requirements.

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project (Google OAuth enabled)
- A [YouTube Data API v3](https://developers.google.com/youtube/v3/getting-started) key (in-room search)
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket + API token (optional — only for the My Library upload feature)

## 1. Clone and install

```bash
npm install
```

## 2. Supabase schema

**New project:** run `supabase/schema.sql` in the Supabase SQL Editor.

**Existing R2/song_id database:** run `supabase/migration_revert_to_youtube.sql` once (breaking change: replaces `song_id` with `video_id` on `queue` / `current_play` and clears their rows; `songs` / `profiles` are kept for My Library).

Also run legacy migrations if needed:

- `supabase/migration_queue_position.sql`
- `supabase/migration_current_play_is_playing.sql`
- `supabase/migration_queue_added_by_label.sql`

### Google OAuth

1. Supabase Dashboard → **Authentication** → **Providers** → enable **Google**.
2. Add redirect URL: `http://localhost:3000/auth/callback` (and your production URL).
3. Configure Google Cloud OAuth client with the Supabase callback URL from the dashboard.

## 3. Cloudflare R2

1. Create a bucket (e.g. `jam-songs`).
2. Create an R2 API token with read/write access.
3. Configure CORS on the bucket to allow `PUT` from your app origin.

Object layout:

- Audio: `songs/{user_id}/{uuid}.mp3`
- Covers: `covers/{user_id}/{uuid}.{ext}`

## 4. Environment variables

Copy `.env.example` to `.env.local`:

| Variable | Scope | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Public | Supabase project URL (no `/rest/v1` suffix) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Public | Supabase anon key |
| `YOUTUBE_API_KEY` | Server | YouTube Data API v3 key (in-room search) |
| `R2_ACCOUNT_ID` | Server | Cloudflare account ID (My Library only) |
| `R2_ACCESS_KEY_ID` | Server | R2 API token access key |
| `R2_SECRET_ACCESS_KEY` | Server | R2 API token secret |
| `R2_BUCKET_NAME` | Server | Bucket name |
| `R2_PUBLIC_URL` | Optional | Custom domain for stored URLs |

## 5. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

- **Jam rooms** — no login required (create/join/play).
- **My Library** (`/library`) — Google sign-in required to upload MP3s to the public catalog.

## How it works

- **Home**: create or join a room without login.
- **Room**: search YouTube, queue tracks, sync playback via Supabase Realtime; live member list (presence) and per-device volume.
- **Playback**: YouTube IFrame player; host/guest modes, host Picture-in-Picture, and end-of-track notifications.
- **Queue**: ordered by `position`; references YouTube `video_id`.
- **Library** (standalone): authenticated users upload MP3s to R2 with metadata in Supabase `songs`. Note: library tracks are **not** playable inside rooms (rooms are YouTube-only).

## Deploy on Vercel

Add all environment variables in **Project Settings → Environment Variables**. Set Supabase redirect URLs for production.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint
