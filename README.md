# Uptime Guard

A preventive-maintenance / lubrication-tracking system, built to digitize the paper "BF / CF /
DF Unit Weekly Lubrication Schedule" sheets used on the corrugator line (B Flute, C Flute, and
Double Facer units) into a proper role-based web application with scheduling, alerting, and a
permanent audit trail.

## Status: running locally, not yet deployed

The application runs against a local MySQL database with the full schema, auth, and business
logic in place. See [Running locally](#7-running-locally) below to get it going on a fresh
machine, or [Deploying](#8-deploying) for what changes once you take it off this machine.

---

## 1. Tech stack

| Layer | Choice |
|---|---|
| Framework | Next.js 16 (App Router, TypeScript, Turbopack) |
| Styling | Tailwind CSS v4, custom glassmorphism design system |
| Database | MySQL 8.4, accessed via Drizzle ORM (`drizzle-orm` + `mysql2`) |
| Auth | Custom: bcrypt password hashing + opaque session tokens in an httpOnly cookie, backed by a `sessions` table |
| File storage | Local disk (`uploads/`), served through an authenticated Next.js route |
| Charts | Recharts |
| Reports | jsPDF (PDF export), native CSV |
| Hosting (planned) | Local machine for now; not yet deployed |

Project lives at `D:\uptime-guard`. MySQL server lives at `D:\MySQL` (installed outside
`Program Files`/`C:` on purpose — see [Running locally](#7-running-locally)).

## 2. Role hierarchy

Four tiers, matching the roles that already existed on the paper sheets (Supervisor,
Production Engineer, Lead Operator, Operator crew):

| Role | Maps to (from the paper sheets) | Scope |
|---|---|---|
| **Super Admin** | Khalid (Supervision) | Everything, all units, only one who can add/archive machines, manage all accounts, configure alert timing |
| **Production Engineer** | Adeel & Umer (Reported By) | Everything Super Admin sees, minus account/machine-deletion/settings control |
| **Admin / Lead Operator** | Majid, Ashfaq, Riaz (Verified by) | Scoped to whichever unit(s) they're assigned to; manages tasks/sections/lubricants and Operator accounts within that scope |
| **Operator** | The named crew per unit (e.g. BF: Sharjeel, Wajid, Arif) | Scoped to assigned unit(s); can only mark a task's status |

Every account is individual and named — no shared logins. This used to be a database-level
guarantee (Postgres Row-Level Security); MySQL has no RLS equivalent, so the full permission
matrix now lives in application code at `src/lib/auth/authorize.ts`, applied explicitly by every
server action and data-fetching function (never assumed). See that file for the exact rule set —
it's a line-by-line port of the old RLS policies.

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
deliberate request: status changes must be permanently recorded and un-deletable. Under
Postgres this was enforced by simply not granting an UPDATE/DELETE RLS policy to anyone; MySQL
has no RLS, so it's enforced two ways now: the service layer never exposes an update/delete path
for these tables, **and** `db/migrations/0001_append_only_triggers.sql` installs `BEFORE
UPDATE`/`BEFORE DELETE` triggers that hard-reject any attempt at the database level, even from a
direct SQL client logged in as the app user.

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
| Hardcoded secrets / secrets in JS | None in code; all via env vars (`DATABASE_URL`, `SESSION_SECRET`, `CRON_SECRET`) |
| Public `.env` / secrets in git | `.env*` gitignored from the start |
| Weak auth | bcrypt password hashing (12 rounds), 8-char minimum enforced |
| Missing auth checks / unprotected admin routes | Every admin-tier page re-checks the role server-side and redirects; every server action re-derives the caller from the session and applies `src/lib/auth/authorize.ts` explicitly (no implicit RLS to fall back on) |
| Cross-user / cross-unit access | Enforced in the application's authorization layer, applied consistently across every data-fetching function and mutation — see `src/lib/auth/authorize.ts` |
| Open DB permissions | The app connects as a dedicated MySQL user (`uptime_guard`) with privileges scoped to the `uptime_guard` database only, not root |
| Cloud service misconfiguration | N/A currently — file storage is local disk behind an authenticated route (`src/app/api/files/...`), not a public bucket |
| Login leaking info | Generic "Invalid username or password" regardless of which part was wrong |
| Verbose prod errors | Server actions return generic messages, never raw DB error text |
| Input validation | Username pattern-restricted, comment/name length caps, photo type/size validated server-side (not just the HTML `accept` hint), filenames sanitized against path injection |
| SQL / NoSQL injection | All queries go through Drizzle's query builder (parameterized); no raw string-built SQL anywhere in app code |
| Append-only tampering | DB-level triggers reject UPDATE/DELETE on audit-critical tables even for a direct SQL client (see §3) |

## 6. Project structure

```
db/migrations/          Drizzle-generated MySQL migrations + hand-written append-only triggers
db/seed/                units/sections/lubricants seed, reviewed task import, first super-admin account
scripts/run-migrations.ts  Applies db/migrations/ to DATABASE_URL
src/lib/db/schema.ts    Drizzle schema -- source of truth for the database
src/lib/db/client.ts    mysql2 pool + Drizzle instance
src/lib/auth/           Session issuance/verification, current-profile lookup, authorization helpers (the RLS replacement)
src/lib/services/       Business logic that used to live in Postgres triggers/functions (status-event recording, alert sweep, activity log)
src/lib/storage/local.ts  Local-disk file storage helpers
src/app/api/files/      Authenticated route that serves uploaded photos (replaces Supabase Storage signed URLs)
src/app/api/cron/       Alert-sweep endpoint, meant to be hit on a schedule (replaces pg_cron)
src/app/actions/        Server actions (auth, tasks, machines, accounts, settings)
src/app/dashboard/      All authenticated screens (tasks, alerts, machines, accounts, analytics, activity, reports, settings)
src/lib/data/           Server-side data-fetching helpers per screen
```

## 7. Running locally

MySQL is installed at `D:\MySQL` (not under `Program Files`/`C:` — this machine's `C:` drive was
full at setup time). To bring it up on a fresh checkout:

1. Install MySQL 8.4+ somewhere with room (the zip/no-install distribution works fine, doesn't
   require admin rights the way the MSI installer does).
2. Point a `my.ini` at your chosen `datadir`, initialize it
   (`mysqld --initialize-insecure --defaults-file=...`), and start `mysqld` in the background.
   For a single local dev instance with no replication, add `skip-log-bin` to `my.ini` --
   otherwise `CREATE TRIGGER` fails for any DB user without the global `SUPER` privilege (see
   `db/migrations/0001_append_only_triggers.sql`).
3. Create the database and a dedicated app user (don't use `root` for the app itself):
   ```sql
   CREATE DATABASE uptime_guard CHARACTER SET utf8mb4 COLLATE utf8mb4_0900_ai_ci;
   CREATE USER 'uptime_guard'@'localhost' IDENTIFIED BY '<a real password>';
   GRANT ALL PRIVILEGES ON uptime_guard.* TO 'uptime_guard'@'localhost';
   ```
4. Copy `.env.local.example` to `.env.local` and fill in `DATABASE_URL` (using the user/password
   above), `SESSION_SECRET`, and `CRON_SECRET` (random 32-byte hex values --
   `node -e "console.log(require('crypto').randomBytes(32).toString('hex'))"`).
5. `npm install`
6. `npm run db:migrate` -- applies everything in `db/migrations/`, including the append-only
   triggers.
7. `npm run db:seed` -- loads the high-confidence units/sections/lubricants structural data.
8. Review `db/seed/tasks_reference.json` against the source PDFs (two rows per unit are flagged
   `_flag` for possible accidental duplication), then `npm run db:import-tasks`.
9. Set `SUPER_ADMIN_USERNAME` / `SUPER_ADMIN_PASSWORD` / `SUPER_ADMIN_FULL_NAME` in `.env.local`,
   run `npm run db:create-super-admin`, then unset them again.
10. `npm run dev`, log in as the account you just created.
11. Point something at `POST /api/cron/evaluate-alerts` (header
    `Authorization: Bearer <CRON_SECRET>`) on an hourly schedule -- e.g. a Windows Task Scheduler
    job running `curl` -- so due-soon/overdue/critical alerts actually get generated. Without
    this, only the instant "Not Working" alert path works.

## 8. Deploying

Two things about the current local setup are host-specific and need a decision before deploying
anywhere:

- **File storage** (`uploads/`, `src/lib/storage/local.ts`) needs a persistent volume on
  whatever host you pick -- it will not survive a redeploy on a stateless host (e.g. Vercel's
  default filesystem). Either provision a persistent disk, or swap `src/lib/storage/local.ts` and
  `src/app/api/files/...` for an object-storage backend (S3/R2/MinIO) if the target host doesn't
  offer one.
- **The alert sweep** (`POST /api/cron/evaluate-alerts`) needs an external scheduler pointed at
  it, same as locally -- Vercel Cron, GitHub Actions on a schedule, or your host's equivalent.

Everything else (MySQL connection via `DATABASE_URL`, session cookies, auth) is already
host-agnostic.

## 9. What's left

- Structured feature-by-feature testing against the live local database
- Decide on a deployment target and resolve the two items in §8 for it
- Remove test/sample data before go-live
- Generate the PDF test report as proof of QA