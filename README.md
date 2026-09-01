# Uptime Guard

A preventive-maintenance / lubrication-tracking system, built to digitize the paper "BF / CF /
DF Unit Weekly Lubrication Schedule" sheets used on the corrugator line (B Flute, C Flute, and
Double Facer units) into a proper role-based web application with scheduling, alerting, and a
permanent audit trail.

## Status: running on Supabase, ready to deploy

The application runs against a hosted Supabase Postgres database and Supabase Storage, with the
full schema, auth, and business logic in place. See [Running locally](#7-running-locally) below
to get it going on a fresh machine, or [Deploying](#8-deploying) for what's needed to take it
live.

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Styling | Tailwind CSS v4, custom glassmorphism design system |
| Database | Postgres, hosted on Supabase, accessed via Drizzle ORM (`drizzle-orm` + `postgres`) through Supabase's connection pooler |
| Auth | Custom: bcrypt password hashing + opaque session tokens in an httpOnly cookie, backed by a `sessions` table -- not Supabase Auth |
| File storage | Supabase Storage (two private buckets: `reference-photos`, `task-photos`), served through an authenticated Next.js route |
| Charts | Recharts |
| Reports | jsPDF (PDF export), native CSV |
| Hosting (planned) | Vercel -- `vercel.json` configures the alert-sweep cron; see [Deploying](#8-deploying) |

Project lives at `D:\uptime-guard`. Originally built against local MySQL + local disk storage,
then migrated to Supabase (Postgres + Storage) -- see `db/migrations/supabase/` for the
Postgres-flavored schema and append-only triggers.

## 2. Role hierarchy

Four tiers, matching the roles that already existed on the paper sheets (Supervisor,
Production Engineer, Lead Operator, Operator crew):

| Role | Maps to (from the paper sheets) | Scope |
|---|---|---|
| **Super Admin** | Khalid (Supervision) | Everything, all units, only one who can add/archive machines, manage all accounts, configure alert timing |
| **Production Engineer** | Adeel & Umer (Reported By) | Everything Super Admin sees, minus account/machine-deletion/settings control |
| **Admin / Lead Operator** | Majid, Ashfaq, Riaz (Verified by) | Scoped to whichever unit(s) they're assigned to; manages tasks/sections/lubricants and Operator accounts within that scope |
| **Operator** | The named crew per unit (e.g. BF: Sharjeel, Wajid, Arif) | Scoped to assigned unit(s); can only mark a task's status |

Every account is individual and named — no shared logins. This was originally a database-level
guarantee via Postgres Row-Level Security. It's back on Postgres now (Supabase), but RLS still
isn't used: the app authenticates its own users with custom session cookies rather than Supabase
Auth, so there's no `auth.uid()` for RLS policies to key off -- the app's DB connection uses the
`postgres` role (the table owner, which bypasses RLS by default regardless), and Storage access
separately uses the `service_role` key for the same reason. The full permission matrix instead
lives in application code at `src/lib/auth/authorize.ts`, applied explicitly by every server
action and data-fetching function (never assumed) — see that file for the exact rule set.

## 3. Data model

```
units (BF / CF / DF, extensible)
  └─ sections (RS-1, QF-P(CF), HPH-A II, ...)
       └─ tasks (one lubrication point: description, picture, points, frequency, lubricant)
            └─ task_status_events   (append-only: every "OK" / "Not Working" check-off, ever)
                 └─ event_annotations (Admin-tier+ comments on a specific event)
            └─ task_current_state   (cached "where things stand now", rebuilt from events)
            └─ alerts               (due-soon / overdue / critical / not-working, with history)

users (one row per person, all 4 roles, holds the bcrypt password hash)
sessions (opaque session tokens, SHA-256 hashed, revocable)
user_unit_assignments (who can see/act on which unit(s), revocable not deletable)
activity_log (generic before/after audit trail, permanently append-only)
alert_settings (lead-time / escalation-day configuration, global default + optional per-task)
lubricants (shared reference list: Gadus S2 V220, Gleitmo 591, extensible)
```

**Nothing is ever hard-deleted.** Units/sections/tasks use `archived_at` (soft delete).
`task_status_events`, `event_annotations`, `alerts`, and `activity_log` are append-only —
corrections happen by inserting a new event, not editing history. This was a specific,
deliberate request: status changes must be permanently recorded and un-deletable. It's enforced
two ways: the service layer never exposes an update/delete path for these tables, **and**
`db/migrations/supabase/0001_append_only_triggers.sql` installs `BEFORE UPDATE`/`BEFORE DELETE`
PL/pgSQL triggers that hard-reject any attempt at the database level, even from a direct SQL
client connected as the `postgres` role.

## 4. Features built

**Auth & accounts**
- Username + password login, sessions backed by a DB-verified httpOnly cookie
  (`src/lib/auth/session.ts`) — no third-party auth service involved
- Individual login per person, all 4 roles
- Super Admin/Admin can create accounts and assign one, several, or all units per Operator/Admin

**Day-to-day use**
- Task checklist scoped to whatever unit(s) the logged-in account can see
- Mark a point "OK" or "Not Working", with an optional comment and an optional photo
- "Not Working" fires an immediate alert (separate from routine due-date alerts) and stays
  flagged until someone with scope over that unit clears it
- Machine/task profile page: full chronological history for a single lubrication point —
  every check-off, who did it, comments, photos, and the alert history for that point
- Admin-tier+ can attach a comment to any existing event without altering the original entry

**Scheduling & alerts**
- Due dates auto-calculated from each task's frequency (Weekly / 2 Weeks / Monthly)
- Configurable lead time ("due soon" warning window) and escalation window (when an overdue
  item becomes "critical"), set plant-wide by Super Admin
- `evaluateTaskAlerts()` (`src/lib/services/alert-sweep.ts`), exposed at
  `POST /api/cron/evaluate-alerts`, generates and auto-resolves due-soon/overdue/critical alert
  history — meant to be hit on a schedule (see [Running locally](#7-running-locally))
- Alerts list: active + historical, scoped per role (Operator sees their own, Admin sees their
  unit(s), Super Admin/Production Engineer see everything)

**Admin tools**
- Machine management: add new units/sections/tasks, edit, archive (Super Admin only for
  archiving), add new lubricant types
- Accounts screen: create accounts, assign/revoke unit access
- Alert settings screen (Super Admin only): plant-wide lead-time/escalation configuration
- Activity log (Super Admin/Production Engineer only): generic "who changed what, when" feed
  across every table
- Analytics dashboard: compliance stats, status breakdown by unit, 30-day check-off activity
  trend — automatically scoped to whatever the viewer has access to
- CSV and PDF export of check-off history

**Design**
- Custom glassmorphism UI (translucent panels, backdrop blur) built around the color palette
  from the Uptime Guard logo (navy background, blue/teal accents, red/amber for alerts)

## 5. Security hardening applied

Mapped against the checklist this project was specifically built against:

| Concern | How it's handled |
|---|---|
| Hardcoded secrets / secrets in JS | None in code; all via env vars (`DATABASE_URL`, `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `CRON_SECRET`) |
| Public `.env` / secrets in git | `.env*` gitignored from the start |
| Weak auth | bcrypt password hashing (12 rounds), 8-char minimum enforced |
| Missing auth checks / unprotected admin routes | Every admin-tier page re-checks the role server-side and redirects; every server action re-derives the caller from the session and applies `src/lib/auth/authorize.ts` explicitly (no RLS to fall back on -- see §2) |
| Cross-user / cross-unit access | Enforced in the application's authorization layer, applied consistently across every data-fetching function and mutation — see `src/lib/auth/authorize.ts` |
| Open DB permissions | The app connects to Supabase Postgres over the connection pooler with a project-specific password, not a shared/public credential |
| Cloud service misconfiguration | Both Storage buckets (`reference-photos`, `task-photos`) are private, not public; reads and writes go through the `service_role` key from trusted server code only, gated by `src/app/api/files/...`'s own session + unit-scope check -- never a public bucket URL |
| Login leaking info | Generic "Invalid username or password" regardless of which part was wrong |
| Verbose prod errors | Server actions return generic messages, never raw DB error text |
| Input validation | Username pattern-restricted, comment/name length caps, photo type/size validated server-side (not just the HTML `accept` hint), filenames sanitized against path injection |
| SQL / NoSQL injection | All queries go through Drizzle's query builder (parameterized); no raw string-built SQL anywhere in app code |
| Append-only tampering | DB-level triggers reject UPDATE/DELETE on audit-critical tables even for a direct SQL client (see §3) |

## 6. Project structure

```
db/migrations/supabase/   Hand-written Postgres schema + append-only triggers (0000/0001), plus
                           anything drizzle-kit generate adds after this point
db/migrations/             Original MySQL migrations, kept for history -- no longer applied
db/seed/                units/sections/lubricants seed, reviewed task import, first super-admin account
scripts/run-migrations.ts  Applies db/migrations/supabase/ to DATABASE_URL via drizzle-kit's migrator
src/lib/db/schema.ts    Drizzle schema (pg-core) -- source of truth for the database
src/lib/db/client.ts    postgres.js client (via Supabase's connection pooler) + Drizzle instance
src/lib/auth/           Session issuance/verification, current-profile lookup, authorization helpers (the RLS replacement)
src/lib/services/       Business logic that used to live in Postgres triggers/functions (status-event recording, alert sweep, activity log)
src/lib/storage/supabase.ts  Supabase Storage helpers (service_role client, upload/download)
src/app/api/files/      Authenticated route that serves photos from Supabase Storage
src/app/api/cron/       Alert-sweep endpoint (GET + POST), meant to be hit on a schedule -- vercel.json wires up GET hourly on Vercel
src/app/actions/        Server actions (auth, tasks, machines, accounts, settings)
src/app/dashboard/      All authenticated screens (tasks, alerts, machines, accounts, analytics, activity, reports, settings)
src/lib/data/           Server-side data-fetching helpers per screen
```

## 7. Running locally

The database and file storage are hosted on Supabase — nothing to install locally beyond Node.
To bring it up on a fresh checkout:

1. Create a Supabase project (or use an existing one).
2. In the SQL Editor, run `db/migrations/supabase/0000_schema.sql`, then
   `db/migrations/supabase/0001_append_only_triggers.sql` (order matters — the triggers
   reference tables the first file creates).
3. Create two **private** Storage buckets: `reference-photos` and `task-photos` (Storage ->
   New bucket -> leave "Public bucket" off).
4. Copy `.env.local.example` to `.env.local` and fill in:
   - `DATABASE_URL` — the **connection pooling** string from Project Settings -> Database (not
     the direct `db.<ref>.supabase.co` host — that one resolves IPv6-only and will fail to
     connect on networks without an outbound IPv6 route). Format:
     `postgresql://postgres.<ref>:<password>@aws-0-<region>.pooler.supabase.com:5432/postgres`
   - `SUPABASE_URL` and `SUPABASE_SERVICE_ROLE_KEY` — from Project Settings -> API.
   - `SESSION_SECRET` and `CRON_SECRET` — random 32-byte hex values, e.g.
     `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`.
5. `npm install`
6. `npm run db:seed` -- loads the high-confidence units/sections/lubricants structural data.
7. Review `db/seed/tasks_reference.json` against the source PDFs (two rows per unit are flagged
   `_flag` for possible accidental duplication), then `npm run db:import-tasks`.
8. Set `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` / `SUPER_ADMIN_FULL_NAME` in `.env.local`,
   run `npm run db:create-super-admin`, then unset them again.
9. `npm run dev`, log in as the account you just created.
10. Point something at `GET` or `POST /api/cron/evaluate-alerts` (header
    `Authorization: Bearer <CRON_SECRET>`) on an hourly schedule -- e.g. a Windows Task Scheduler
    job running `curl`, or Vercel Cron once deployed (see §8) -- so due-soon/overdue/critical
    alerts actually get generated. Without this, only the instant "Not Working" alert path works.

## 8. Deploying

The two things that used to block deploying off this machine are both resolved: file storage is
Supabase Storage (not local disk), and the alert sweep responds to `GET` (not just `POST`) so
Vercel Cron can trigger it directly. To deploy to Vercel:

1. Import the GitHub repo into Vercel (Next.js is auto-detected, no build config needed).
2. Set the same env vars as `.env.local` (§7) in the Vercel project settings: `DATABASE_URL`,
   `SUPABASE_URL`, `SUPABASE_SERVICE_ROLE_KEY`, `SESSION_SECRET`, `CRON_SECRET`.
3. `vercel.json` already defines an hourly cron hitting `/api/cron/evaluate-alerts` -- **hourly
   cron schedules require Vercel's Pro plan**; on the free Hobby tier, cron jobs can only run
   once a day, so change the schedule to something like `0 3 * * *` if you're on Hobby.
4. Deploy. Vercel automatically sends `Authorization: Bearer $CRON_SECRET` on cron-triggered
   requests when `CRON_SECRET` is set as an env var, matching what the route already expects --
   no extra wiring needed.

Any other Node-capable host (a VPS, Railway, Render, Fly.io) works too, since nothing left in the
app depends on the local filesystem or a specific host's cron mechanism -- just run
`GET /api/cron/evaluate-alerts` on a schedule via whatever that host offers (plain cron, GitHub
Actions, etc.).

## 9. What's left

- Structured feature-by-feature testing against the live Supabase database
- Schedule the alert-sweep cron on whatever host you land on (see §8)
- Remove test/sample data before go-live
- Generate the PDF test report as proof of QA