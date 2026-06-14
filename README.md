# Jam Room App

Collaborative “listen together” rooms built with **Next.js 14**, **TypeScript**, **Tailwind CSS**, **Supabase** (Postgres + Realtime + Auth), **Cloudflare R2** (audio storage), and **Zustand**.

See [docs/PRD.md](docs/PRD.md) for full product requirements.

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project (Google OAuth enabled)
- A [Cloudflare R2](https://developers.cloudflare.com/r2/) bucket + API token

## 1. Clone and install

```bash
npm install
```

## 2. Supabase schema

**New project:** run `supabase/schema.sql` in the Supabase SQL Editor.

**Existing YouTube MVP database:** run `supabase/migration_songs_and_song_id.sql` once (breaking change: replaces `video_id` with `song_id`).

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
| `R2_ACCOUNT_ID` | Server | Cloudflare account ID |
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
- **Room**: search the global song library, queue tracks, sync playback via Supabase Realtime.
- **Library**: authenticated users upload MP3s to R2; metadata stored in Supabase `songs`.
- **Playback**: HTML5 audio with signed R2 URLs; host/guest modes preserved from the original jam UX.
- **Queue**: ordered by `position`; references `song_id` instead of YouTube `video_id`.

## Deploy on Vercel

Add all environment variables in **Project Settings → Environment Variables**. Set Supabase redirect URLs for production.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint
