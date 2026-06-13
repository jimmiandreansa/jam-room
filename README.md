# Jam Room App

Collaborative “listen together” rooms built with **Next.js 14 (App Router)**, **TypeScript**, **Tailwind CSS**, **Supabase** (Postgres + Realtime), **Zustand**, and **react-youtube**.

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com/) project
- A [YouTube Data API v3](https://developers.google.com/youtube/v3/getting-started) key (for search)

## 1. Clone and install

```bash
npm install
```

## 2. Supabase schema

1. Open the Supabase dashboard → **SQL Editor**.
2. Paste and run `supabase/schema.sql`.
3. If you see errors that tables are **already** in `supabase_realtime` publication, remove those `alter publication` lines for the tables already listed, or ignore duplicate errors.

The script creates `rooms`, `queue`, and `current_play`, enables Realtime, and adds permissive RLS policies suitable for an MVP (open read/write for anonymous clients). **Tighten RLS before production** (e.g. auth-based policies).

**Existing database:** if you already applied an older `schema.sql` without `queue.position`, run `supabase/migration_queue_position.sql` once in the SQL editor so queue ordering and drag-and-drop work.

**Playback sync:** run `supabase/migration_current_play_is_playing.sql` once so `current_play.is_playing` exists — all clients then share play/pause from the transport bar.

## 3. Environment variables

Copy `.env.example` to `.env.local` and fill in values:

| Variable | Where it runs | Purpose |
| --- | --- | --- |
| `NEXT_PUBLIC_SUPABASE_URL` | Browser + server | Supabase **project URL** only (see note below) |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Browser + server | Supabase anon key |
| `YOUTUBE_API_KEY` | **Server only** | YouTube search API (`/api/youtube/search`) |

**`NEXT_PUBLIC_SUPABASE_URL`:** use exactly `https://<project-ref>.supabase.co` (no trailing `/rest/v1`). The JS client adds `/rest/v1` itself. If the URL already ends with `/rest/v1`, requests break with PostgREST **PGRST125** — *Invalid path specified in request URL*. The app normalizes this when possible, but fixing `.env` is best.

Never prefix the YouTube key with `NEXT_PUBLIC_` so it is not exposed to the client.

## 4. Run locally

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

### Invite link and joining

- **Direct room URL:** `https://<your-domain>/room/<room-uuid>` — share this with guests; opening it joins the room without pasting an ID on the home page.
- **Home with prefilled ID:** `https://<your-domain>/?room=<room-uuid>` — loads the home page with the join field filled so guests can tap **Gabung room**.

Inside a room, use **Salin tautan undangan** / **Salin ID room** to copy the same values.

## 5. Deploy on Vercel

1. Push the repo to GitHub (or connect your Git provider).
2. Create a Vercel project from the repo.
3. Add the same environment variables in **Project Settings → Environment Variables**.
4. Deploy. The app uses the public Supabase client in the browser and a Route Handler for YouTube search, so there are **no Node-only imports in client bundles** for those paths.

## How it works (MVP)

- **Home**: create a row in `rooms`, join by UUID, open a shared **`/room/<uuid>`** link, or open **`/?room=<uuid>`** to prefill the join field.
- **Room**: loads the queue and `current_play`; if nothing is playing but the queue has items, the first item is promoted into `current_play` so all clients agree on the video.
- **Realtime**: subscriptions on `queue` and `current_play` for the room keep the UI in sync.
- **End of track / Next**: any client with the YouTube player can advance the queue (`onEnd` + a small interval fallback when the tab is hidden so playback can continue if the host tab is backgrounded). Use **Next** under the video for a manual skip.
- **Host vs guest UI**: the browser that **creates** a room is marked host (`localStorage`); only guests see **Audio di perangkat ini** (default **Tanpa pemutar di sini** = muted embed + synced seek from `current_play.started_at`). Host always plays unmuted locally.
- **Play / Pause (transport icons)**: updates `current_play.is_playing` in Supabase; every client applies play/pause on their YouTube player via Realtime so host and guests stay in sync.
- **Host Picture-in-Picture**: the room host can enable auto PiP so a mini player opens when switching tabs (Chrome/Edge desktop, Document Picture-in-Picture + Media Session). A manual PiP button on the transport bar is available as a fallback.
- **Queue**: ordered by `position` (drag-and-drop for everyone). New rows get `max(position)+1`.
- **Zustand** (`store/jamStore.ts`): holds `roomId`, `queue`, and `currentVideo` for the room UI.

## Scripts

- `npm run dev` — development server
- `npm run build` — production build
- `npm run start` — run production build
- `npm run lint` — ESLint
