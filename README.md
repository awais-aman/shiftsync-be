# ShiftSync — Backend

NestJS API for **ShiftSync**, a multi-location staff-scheduling platform built for a fictional restaurant group ("Coastal Eats") with 4 locations across 2 timezones. Frontend repo: [`shiftsync-fe`](https://github.com/awais-aman/shiftsync-fe).

## Tech stack

| Layer | Tech |
|---|---|
| Runtime | Node.js 22 |
| Framework | NestJS 11 (TypeScript, decorator-driven modules) |
| ORM | Prisma 6 (PostgreSQL) |
| Auth | Supabase Auth (JWT verified via JWKS) |
| Database | Supabase Postgres |
| Realtime | Supabase Realtime (Postgres CHANGES on the `notifications` table) |
| Validation | class-validator + class-transformer + Zod |
| API docs | `@nestjs/swagger` (OpenAPI at `/api/docs`) |
| Hosting | Railway |

The frontend is hosted on Vercel.

## Architecture

- **Modules per feature** under `src/`: `auth`, `locations`, `skills`, `team`, `shifts`, `availability`, `assignments`, `constraints`, `swaps`, `overtime`, `notifications`, `audit`, `on-duty`, `analytics`.
- **Repository layer** (`src/database/repositories/`) wraps every Prisma model so service code never speaks raw Prisma queries.
- **Constraint engine** (`src/constraints/constraint-engine.ts`) is a pure function evaluating 10 rules (skill, certification, availability, double-booking, min-rest, daily/weekly overtime, consecutive days). Used by both write paths (`AssignmentsService.create`) and the dry-run preview.
- **Manager-location scoping** is enforced through a shared `LocationScopeService` (`src/common/scope/`) — every list endpoint filters by the caller's role, every write asserts authority over the target location.
- **Audit + notifications** are fired from service write paths, never the controller, so any code path that mutates state stays observable.

## Local development

Requirements: Node 22+, npm, a Supabase project (free tier is fine).

```bash
git clone https://github.com/awais-aman/shiftsync-be.git
cd shiftsync-be
npm install

cp .env.example .env
# Fill in: SUPABASE_URL, SUPABASE_PUBLISHABLE_KEY, SUPABASE_SECRET_KEY,
#         DATABASE_URL (port 6543, ?pgbouncer=true), DIRECT_URL (port 5432)

npx prisma migrate deploy
npm run seed         # creates demo locations/staff/shifts (idempotent)
npm run start:dev
```

API: `http://localhost:4000/api`
Swagger: `http://localhost:4000/api/docs`

### Required env vars

```
SUPABASE_URL=https://<project>.supabase.co
SUPABASE_PUBLISHABLE_KEY=sb_publishable_...
SUPABASE_SECRET_KEY=sb_secret_...
DATABASE_URL=postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:6543/postgres?pgbouncer=true
DIRECT_URL=postgresql://postgres.<ref>:<password>@aws-...pooler.supabase.com:5432/postgres
PORT=4000              # optional, defaults to 4000; Railway will inject its own
CORS_ORIGIN=http://localhost:3000  # comma-separated list for production
```

## Deployment (Railway)

1. New project → Deploy from GitHub repo
2. **Variables**: paste every var from `.env` (Railway will inject its own `PORT`, no need to set it)
3. **Settings → Networking → Generate Domain** — note the URL
4. **Settings → Networking → edit domain** — set "port your app is listening to" to whatever Railway has set as `PORT` (default 8080); the app reads from `process.env.PORT` so they match automatically
5. **Settings → Deploy → Custom Start Command**: `npm run start:prod`
6. Trigger a redeploy
7. Hit `https://<your-railway-url>/api` — should return JSON
8. Update `CORS_ORIGIN` to your Vercel URL once the FE is deployed

## Seed credentials

`npm run seed` is idempotent — safe to re-run. Same password for all accounts:

```
password: CoastalEats!2026
```

| Role    | Email                              | Notes |
|---------|------------------------------------|-------|
| admin   | admin@coastaleats.test             | Sees everything; only role that can grant overtime overrides + export audit |
| manager | east-manager@coastaleats.test      | Manages Brooklyn + Boston (East coast) |
| manager | west-manager@coastaleats.test      | Manages Santa Monica + Berkeley (West coast) |
| staff   | sarah@coastaleats.test             | West coast (PT), bartender + server, pre-granted 7th-day override |
| staff   | john@coastaleats.test              | Cross-tz (Brooklyn + Santa Monica), bartender — drives the Timezone Tangle scenario |
| staff   | maria@coastaleats.test             | East coast, server + host |
| staff   | alex@coastaleats.test              | Berkeley only, line cook |
| staff   | priya@coastaleats.test             | East coast, server + host |
| staff   | tom@coastaleats.test               | Santa Monica only, line cook + server, has an in-flight drop request |

The seed also creates ~10 shifts across the next 14 days (mix of draft + published, premium Fri/Sat 17:00+), pre-existing assignments, an in-flight drop request (Tom) and swap request (John → Sarah), and one overtime override (Sarah).

## API contract

OpenAPI spec is exposed at `GET /api/docs-json`. All endpoints require a Supabase JWT bearer token; role-restricted endpoints use admin/manager/staff guards via the `@Roles()` decorator.

Key endpoint groups:
- `/api/me` — current user profile
- `/api/locations`, `/api/skills`, `/api/team` — admin-managed catalog + M:N joins
- `/api/shifts` — list/create/edit/publish/unpublish, scoped by role
- `/api/shifts/:id/assignments` — assign + dry-run + suggestions
- `/api/availability/me` — staff sets recurring + exceptions
- `/api/swap-requests` — full state machine (cancel/accept/claim/approve/reject)
- `/api/overtime/overrides` — admin/manager 7th-day exemptions
- `/api/notifications` — list + unread + channel preference
- `/api/audit` — read + admin-only CSV export
- `/api/on-duty` — currently active shifts grouped by location
- `/api/analytics/fairness` + `/analytics/overtime` — aggregate dashboards

## Decisions on intentional spec ambiguities

1. **De-certified staff & history** — past assignments are preserved. Future unpublished assignments are not auto-cleaned, but the constraint engine will reject any new assignment.
2. **Desired hours vs availability** — availability is a hard constraint; `desired_hours_per_week` is advisory and surfaces in fairness analytics (variance vs actual) and the suggestions ranker.
3. **Consecutive-days counting** — any shift `>= 1h` counts as a worked day. Overnight shifts count for the start day only.
4. **Edit after swap approval** — once approved, the swap is final; subsequent shift edits notify assignees but don't revert. Edit while a swap is in-flight auto-cancels the swap.
5. **Location spanning timezone boundary** — out of scope; one IANA tz per location.
6. **Cross-timezone staff (the "Timezone Tangle" scenario)** — each availability row carries its own timezone. When evaluating a shift, the engine only considers availability rows whose timezone matches the shift's location timezone. A staff member working both PT and ET locations therefore needs two availability rows (e.g. 09:00–17:00 in `America/New_York` *and* 09:00–17:00 in `America/Los_Angeles`). This keeps "9am–5pm" unambiguous: it always means 9am–5pm in *that* timezone, never an arbitrary translation between them.

## Time, DST & overnight handling

- All persisted times are `timestamptz`. Display always uses the **shift's location timezone** via `date-fns-tz`.
- Recurring availability windows store a `timezone` per row; the engine interprets each window in that tz. DST transitions are handled because the shift's UTC instant is converted to local wall-clock with `toZonedTime` before comparing minute-of-day — the same wall-clock window matches before and after a DST jump.
- **Overnight shifts** (e.g. 23:00–03:00) are split at midnight by the engine and each half is checked against availability for its own weekday. A staff member covering an overnight shift needs two recurring windows.

## Notifications & realtime

- Every meaningful event writes a row to `notifications`. The Supabase Realtime channel on that table (filtered by `user_id` via RLS) pushes inserts to the recipient's browser instantly.
- A notification arriving in the FE invalidates the relevant TanStack Query keys (swaps, shifts, assignments), so any open page refetches on the spot. Schedules update without refresh; swap state changes appear in real time.
- Each user picks `in_app` or `in_app_email` on their dashboard. When email is on, an `email_simulated=true` flag is set on the notification row and a `[email-sim]` line is logged on the BE.
- Concurrent-assignment conflicts: the DB-level `EXCLUDE GIST` constraint guarantees only one of two racing managers wins. The loser receives a 409 immediately and the FE surfaces the message as a toast.

## Scripts

```bash
npm run start:dev      # watch mode, hot reload
npm run start:prod     # production: node dist/main
npm run build          # nest build → dist/
npm run seed           # populate demo data (idempotent)
npm run lint
npm run format
npx prisma migrate deploy   # apply migrations
npx prisma studio           # open Prisma Studio at :5555
```
