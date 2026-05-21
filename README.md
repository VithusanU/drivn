# Drivn

**Stop organizing. Start executing.**

Drivn is a productivity PWA that cuts through decision fatigue by surfacing exactly one thing to do next — your *Next Best Action*. No folders, no tags, no system to maintain. Just open the app and get to work.

> Live at [getdrivn.app](https://getdrivn.app)

---

## What makes it different

Most productivity apps help you plan. Drivn helps you *start*. Instead of showing you a list of 40 tasks and making you decide what matters, Drivn's recommendation engine ranks everything in the background and surfaces the single highest-priority action every time you open the app.

- **Next Best Action** — one task, always front and centre, always ready
- **Voice task capture** — speak naturally and the app extracts the title, due date, and urgency automatically
- **Habit streaks** — essential vs. nice-to-have habits tracked daily
- **Focus sessions** — distraction-free timer tied to a specific task (keeps running in the background, fires a notification and chime on completion)
- **Momentum tracking** — daily streak and completion calendar
- **Push notifications** — daily reminders via Web Push API (PWA required)
- **Onboarding flow** — interactive first-run that captures your first task and marks it done before you leave

---

## Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 14 (App Router) |
| Language | TypeScript |
| Styling | Tailwind CSS |
| Animations | Framer Motion |
| State management | Zustand |
| Backend / Auth / DB | Supabase (PostgreSQL + RLS) |
| Voice input | Web Speech API (on-device, no API key) |
| Push notifications | Web Push API + Supabase Edge Functions + pg_cron |
| Analytics | PostHog |
| Error monitoring | Sentry |
| PWA | `manifest.json` + service worker |

---

## Features

### Next Best Action
The recommendation engine scores every active task based on urgency, due date, and recency. The top result is shown front and centre on the home screen — no scrolling, no deciding.

### Task management
- Quick-capture bar always visible at the bottom of the screen
- Priority levels: High / Medium / Low
- Optional due date and time estimate
- Grouped by Now / Soon / Later
- Focus session timer per task

### Voice task capture
Tap the microphone icon in the quick-capture bar and speak naturally. The app parses your phrase on-device (no external API) and fills in the task title, due date, and urgency automatically.

**Supported phrases (examples):**

| What you say | What gets created |
|---|---|
| "Cut grass sometime this week" | Title: Cut grass · Due: end of week |
| "Call doctor urgently today" | Title: Call doctor · Due: today · Priority: **High** |
| "Finish report by Friday" | Title: Finish report · Due: next Friday |
| "Send email ASAP" | Title: Send email · Priority: **High** |
| "Buy groceries in 3 days" | Title: Buy groceries · Due: 3 days from now |
| "Clean room whenever" | Title: Clean room · Priority: **Low** |

**Recognised time phrases:** today, tonight, tomorrow, day after tomorrow, this week, next week, in N days, in a few days, by [day name], next [day name]

**Urgency signals:** urgent / urgently / ASAP / immediately / critical → **High** · whenever / eventually / no rush / low priority → **Low**

The mic button only appears in browsers that support the Web Speech API (Chrome, Edge, Safari 15+). Firefox is not supported.

### Habit tracking
- Two tiers: Essential (must do daily) and Nice to have
- Three tracking modes: Simple toggle, Muscle groups (body sections), Amount (e.g. water intake in ml)
- Streaks per habit and accumulation logic for amount-type habits
- Scrollable strip on home screen, full management on the Habits tab

### Streaks & momentum
- Daily streak increments when at least one task is completed
- Longest streak recorded
- Monthly calendar heatmap on the Summary tab

### Push notifications
- Web Push via VAPID keys stored in Supabase Vault
- Daily reminder at a user-chosen local time
- Cron job runs every minute via pg_cron + Supabase Edge Function
- Requires PWA install (Add to Home Screen) on iOS Safari

### Onboarding
Four-screen interactive flow for new users:
1. Value proposition
2. First task capture (with deadline pills)
3. NBA reveal — see how Drivn surfaces your task
4. Reinforcement — mark it done, streak day 1 starts here

Shown once only (guarded by `onboarded_at` in the database). Replayable from Profile → Replay onboarding.

---

## Project structure

```
app/
├── (app)/              # Protected routes (auth required)
│   ├── page.tsx        # Home / dashboard
│   ├── habits/         # Habit management
│   ├── summary/        # Monthly calendar heatmap
│   ├── focus/[id]/     # Focus session
│   ├── profile/        # Settings, notifications, guide
│   └── admin/          # Admin metrics (owner only)
├── (auth)/             # Public routes
│   ├── login/          # Google OAuth + magic link
│   └── onboarding/     # 4-screen first-run flow
└── auth/callback/      # Supabase OAuth callback

components/
├── dashboard/          # Home screen widgets
│   ├── NextBestAction.tsx
│   ├── QuickCapture.tsx
│   ├── HabitStrip.tsx
│   ├── TaskGroups.tsx
│   └── MomentumCard.tsx
├── habits/             # Habit card + detail sheet
└── layout/             # Sidebar, bottom nav, app header

stores/                 # Zustand stores (taskStore, habitStore, userStore)
lib/
├── engine/             # Recommendation algorithm
├── voiceParser.ts      # NLP parser for voice task input (date, urgency, title extraction)
├── notifications.ts    # Push subscribe / unsubscribe / time helpers
├── analytics.ts        # PostHog event wrappers
└── supabase/           # Browser + server clients

supabase/
└── migrations/         # Sequential SQL migrations (001–006)
```

---

## Database schema

Six migration files build up the schema incrementally:

| Migration | What it adds |
|---|---|
| `001_initial_schema` | `user_profiles`, `tasks`, `habits`, `habit_completions`, `user_streaks`, streak RPC, seed function |
| `002_push_subscriptions` | `push_subscriptions` table with `reminder_time` (stored in UTC) |
| `003_spotify_requests` | `spotify_requests` table for access management |
| `004_habit_detail_columns` | `detail_type`, `detail_config` on habits; `details` JSONB on completions |
| `005_habit_priority` | `priority` column on habits (`essential` / `nice_to_have`) |
| `006_onboarding_flag` | `onboarded_at` on `user_profiles` (once-only onboarding guard) |

All tables use Row Level Security — users can only read and write their own data.

---

## Getting started

### Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) project
- (Optional) A PostHog project for analytics
- (Optional) Sentry for error monitoring

### 1. Clone and install

```bash
git clone https://github.com/VithusanU/drivn.git
cd drivn
npm install
```

### 2. Environment variables

Create `.env.local` in the project root:

```env
NEXT_PUBLIC_SUPABASE_URL=your_supabase_project_url
NEXT_PUBLIC_SUPABASE_ANON_KEY=your_supabase_anon_key

NEXT_PUBLIC_SPOTIFY_CLIENT_ID=your_spotify_client_id   # optional
NEXT_PUBLIC_APP_URL=http://localhost:3000

NEXT_PUBLIC_POSTHOG_KEY=your_posthog_key               # optional
NEXT_PUBLIC_SENTRY_DSN=your_sentry_dsn                 # optional
```

### 3. Run the migrations

In your Supabase project, open the SQL editor and run each file in `supabase/migrations/` in order (`001` → `006`).

### 4. Set up push notifications (optional)

1. Generate VAPID keys:
   ```bash
   npx web-push generate-vapid-keys
   ```
2. Store them as Supabase Vault secrets named `VAPID_PUBLIC_KEY` and `VAPID_PRIVATE_KEY`.
3. Deploy the `send-reminders` Edge Function from `supabase/functions/`.
4. Enable pg_cron in your Supabase project and schedule it to run every minute.

### 5. Start the dev server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000).

---

## Scripts

| Script | Description |
|---|---|
| `npm run dev` | Start development server |
| `npm run build` | Production build |
| `npm run start` | Start production server |
| `npm run lint` | ESLint |
| `npm run type-check` | TypeScript check (no emit) |

---

## Installing as a PWA

Drivn is designed to be used from the home screen — push notifications on iOS Safari only work when launched as a PWA.

- **iPhone (Safari):** Share → Add to Home Screen → Add
- **Android (Chrome):** Menu → Add to Home Screen or Install app
- **Desktop (Chrome / Edge):** Install icon in the address bar

---

## Contributing

This is a personal project, but issues and PRs are welcome. Please open an issue first to discuss larger changes.

---

## License

MIT
