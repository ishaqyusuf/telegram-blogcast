# 📻 telegram-blogcast

> Turn your Telegram channel subscriptions into a personal, interactive learning library.

---

## The Problem

Telegram channels are incredible for educational content — audio lessons, image breakdowns, long-form text threads. But they're built for *delivery*, not *engagement*. You can't like a post to save it for later. You can't leave a timestamped note on an audio. You can't build a playlist of the lessons you keep coming back to.

**telegram-blogcast** solves this by pulling that content into a purpose-built app where you actually own your learning experience.

---

## What It Does

- 🎧 **Blogcast player** — audio content from Telegram channels surfaced in a podcast-style player with playback controls, speed, and progress tracking
- 🖼️ **Visual feed** — educational images and carousels in a clean, readable format
- 📝 **Text threads** — long-form posts rendered as articles
- ❤️ **Reactions & likes** — engage with content the way you want
- 💬 **Comments** — annotate and discuss specific posts
- 📚 **Personal library** — save anything to your own collection
- 🎵 **Playlists** — queue audio content in your own order
- 🔄 **Background sync** — new content from channels lands automatically

---

## Stack

| Layer            | Tech                             |
| ---------------- | -------------------------------- |
| Monorepo         | Turborepo + Bun                  |
| API              | Hono.js on Node                  |
| Web app          | Next.js + shadcn/ui              |
| Mobile app       | Expo (Expo Router) + NativeWind  |
| Shared UI        | shadcn + custom components       |
| Database         | Prisma                           |
| Auth             | Better Auth (`packages/auth`)    |
| Background jobs  | Trigger.dev (`packages/trigger`) |
| Observability    | Better Stack                     |
| Telegram sync    | MTProto via GramJS               |
| End-to-end types | tRPC                             |

---

## Project Structure

```
telegram-blogcast/
├── apps/
│   ├── api/              # Hono.js REST + tRPC server
│   ├── expo-app/         # React Native mobile app (Expo Router)
│   └── www/              # Next.js web app
│
└── packages/
    ├── auth/             # Better Auth config, session helpers
    ├── db/               # Prisma schema + client
    ├── trigger/          # Trigger.dev jobs (channel sync, media processing)
    ├── tsconfig/         # Shared TypeScript configs
    ├── ui/               # Shared component library (shadcn base)
    └── utils/            # Shared utilities, types, constants
```

---

## Getting Started

### Prerequisites

- [Bun](https://bun.sh) `>= 1.0`
- [Telegram API credentials](https://my.telegram.org/apps) (api_id + api_hash)
- PostgreSQL database

### 1. Clone and install

```bash
git clone https://github.com/your-username/telegram-blogcast.git
cd telegram-blogcast
bun install
```

### 2. Configure environment

Copy the example env files and fill in your credentials:

```bash
cp apps/api/.env.example        apps/api/.env
cp apps/www/.env.example        apps/www/.env
cp apps/expo-app/.env.example   apps/expo-app/.env
```

Key variables:

```env
# Telegram
TELEGRAM_API_ID=
TELEGRAM_API_HASH=
TELEGRAM_STRING_SESSION=     # generate once, see below

# Database
DATABASE_URL=

# Auth
AUTH_SECRET=                 # openssl rand -base64 32

# Trigger.dev
TRIGGER_SECRET_KEY=

# Better Stack
BETTERSTACK_TOKEN=
```

### 3. Generate a Telegram session

```bash
bun run gen-session
```

### 4. Set up the database

```bash
bun db:push      # apply schema
bun db:seed      # optional seed data
```

### 5. Run everything

```bash
bun dev          # starts all apps in parallel via Turborepo
```

Individual apps:

```bash
bun dev --filter=api
bun dev --filter=www
bun dev --filter=expo-app
```

---

## Key Workflows

### Channel Sync

Trigger.dev jobs in `packages/trigger` poll subscribed Telegram channels via the MTProto API. New messages are parsed, media is downloaded and stored, and records are written to the database via Prisma.

```
Telegram Channel
      ↓  (MTProto / GramJS)
  trigger job
      ↓
  Prisma → PostgreSQL
      ↓
  tRPC → apps/api
      ↓
  www / expo-app
```

### Media Processing

Audio files are fetched using Bot API `file_id` resolution (MTProto forward → Bot API capture) and stored with metadata. The Expo app streams audio directly; the web app uses a custom player component.

---

## Scripts

| Command           | Description                      |
| ----------------- | -------------------------------- |
| `bun dev`         | Start all apps                   |
| `bun build`       | Build all apps                   |
| `bun lint`        | Lint all packages                |
| `bun db:push`     | Push Prisma schema               |
| `bun db:studio`   | Open Prisma Studio               |
| `bun db:seed`     | Seed database                    |
| `bun gen-session` | Generate Telegram string session |
| `bun test`        | Run all tests                    |

---

## Roadmap

- [ ] Channel subscription management UI
- [ ] Offline download for audio content
- [ ] Transcript generation (Whisper)
- [ ] Smart playlists (by topic, channel, duration)
- [ ] Push notifications for new content
- [ ] Web audio player with waveform
- [ ] Highlight & annotation on text posts
- [ ] Cross-device sync for playback position

---

## Why Telegram?

Telegram has quietly become one of the richest ecosystems for informal education — especially in communities that aren't well-served by mainstream platforms. Channels post everything from recorded lectures to explained research papers to language lessons. This project is about giving that content the reading and listening experience it deserves.

---

## Contributing

PRs are welcome. For large changes, open an issue first to discuss direction. Please follow the project conventions:

- **File names** → `kebab-case`
- **Components** → `PascalCase`
- **Functions/variables** → `camelCase`
- **Constants** → `SCREAMING_SNAKE_CASE`

---

## License

MIT © [your name]