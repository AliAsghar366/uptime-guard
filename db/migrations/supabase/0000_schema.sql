-- Uptime Guard schema, converted from MySQL (db/migrations/0000_dry_molly_hayes.sql) to
-- Postgres for Supabase. Run this whole file in the Supabase SQL Editor (Project -> SQL Editor
-- -> New query), or via `psql "$SUPABASE_DB_URL" -f 0000_schema.sql`.
--
-- Notes:
--  * IDs stay varchar(36) (not native `uuid`) because the app generates them in JS
--    (crypto.randomUUID()) before insert, same as it does today against MySQL -- no DB-side
--    default is required, but harmless to have as a fallback.
--  * This does NOT enable Row-Level Security. The app connects with its own Postgres
--    connection string (not through Supabase's PostgREST/anon-key layer) and enforces
--    authorization in application code (src/lib/auth/authorize.ts), same as it does for MySQL
--    today. RLS is optional on top of this -- ask if you want it added.

create extension if not exists pgcrypto;

create type user_role as enum ('super_admin', 'production_engineer', 'admin', 'operator');
create type task_status as enum ('working', 'not_working');
create type alert_type as enum ('due_soon', 'overdue', 'critical', 'not_working');

-- --- Equipment hierarchy -----------------------------------------------------------------

create table units (
  id varchar(36) primary key default gen_random_uuid()::text,
  code varchar(32) not null unique,
  name varchar(255) not null,
  created_at timestamp not null default current_timestamp,
  archived_at timestamp
);

create table sections (
  id varchar(36) primary key default gen_random_uuid()::text,
  unit_id varchar(36) not null references units(id),
  code varchar(64) not null,
  name varchar(255),
  created_at timestamp not null default current_timestamp,
  archived_at timestamp,
  constraint sections_unit_code_unique unique (unit_id, code)
);
create index idx_sections_unit on sections (unit_id);

create table lubricants (
  id varchar(36) primary key default gen_random_uuid()::text,
  name varchar(255) not null unique
);

create table tasks (
  id varchar(36) primary key default gen_random_uuid()::text,
  section_id varchar(36) not null references sections(id),
  description text not null,
  picture_url varchar(512),
  no_of_points integer not null default 1,
  lubrication_points integer not null default 1,
  frequency_label varchar(32) not null,
  frequency_days integer not null,
  lubricant_id varchar(36) references lubricants(id),
  created_at timestamp not null default current_timestamp,
  archived_at timestamp,
  is_critical boolean not null default false,
  picture_marker_x real,
  picture_marker_y real,
  constraint picture_marker_x_range check (picture_marker_x is null or (picture_marker_x >= 0 and picture_marker_x <= 1)),
  constraint picture_marker_y_range check (picture_marker_y is null or (picture_marker_y >= 0 and picture_marker_y <= 1))
);
create index idx_tasks_section on tasks (section_id);

-- --- Users, auth, unit assignments -------------------------------------------------------

create table users (
  id varchar(36) primary key default gen_random_uuid()::text,
  username varchar(64) not null unique,
  full_name varchar(255) not null,
  role user_role not null,
  password_hash varchar(255) not null,
  created_at timestamp not null default current_timestamp,
  created_by varchar(36)
);

-- Opaque session tokens: the cookie holds the raw token, only its SHA-256 hash is stored here,
-- so a DB read/leak alone can't be replayed as a valid session.
create table sessions (
  token_hash varchar(64) primary key,
  user_id varchar(36) not null references users(id) on delete cascade,
  created_at timestamp not null default current_timestamp,
  expires_at timestamp not null
);

create table user_unit_assignments (
  id varchar(36) primary key default gen_random_uuid()::text,
  user_id varchar(36) not null references users(id) on delete cascade,
  unit_id varchar(36) not null references units(id),
  assigned_by varchar(36) references users(id),
  created_at timestamp not null default current_timestamp,
  revoked_at timestamp,
  constraint assignments_user_unit_unique unique (user_id, unit_id)
);
create index idx_unit_assignments_user on user_unit_assignments (user_id);
create index idx_unit_assignments_unit on user_unit_assignments (unit_id);

-- --- Status history, current-state cache, alerts ------------------------------------------

-- Append-only: no service-layer function ever updates/deletes a row here, and the triggers in
-- 0001_append_only_triggers.sql reject UPDATE/DELETE outright as a hard backstop -- this table
-- is the permanent audit trail of every check-off, ever.
create table task_status_events (
  id varchar(36) primary key default gen_random_uuid()::text,
  task_id varchar(36) not null references tasks(id),
  status task_status not null,
  comment text,
  photo_url varchar(512),
  recorded_by varchar(36) not null references users(id),
  created_at timestamp not null default current_timestamp
);
create index idx_status_events_task on task_status_events (task_id, created_at);

-- Append-only, same guarantee as task_status_events.
create table event_annotations (
  id varchar(36) primary key default gen_random_uuid()::text,
  event_id varchar(36) not null references task_status_events(id),
  author_id varchar(36) not null references users(id),
  body text not null,
  created_at timestamp not null default current_timestamp
);
create index idx_annotations_event on event_annotations (event_id);

-- Denormalized read-model, 1:1 with tasks. Only ever written by
-- src/lib/services/status-events.ts inside the same transaction as the event insert -- never
-- exposed as a direct client write.
create table task_current_state (
  task_id varchar(36) primary key references tasks(id),
  status task_status not null default 'working',
  last_event_id varchar(36) references task_status_events(id),
  last_changed_at timestamp,
  next_due_at timestamp,
  updated_at timestamp not null default current_timestamp
);

create table alert_settings (
  id varchar(36) primary key default gen_random_uuid()::text,
  -- null = plant-wide default row; non-null = per-task override.
  task_id varchar(36) unique references tasks(id),
  lead_time_days integer not null default 2,
  escalation_days integer not null default 2,
  updated_by varchar(36) references users(id),
  updated_at timestamp not null default current_timestamp
);

-- Read-only to clients; only src/lib/services writes here (status-events.ts for not_working,
-- alert-sweep.ts for due_soon/overdue/critical).
create table alerts (
  id varchar(36) primary key default gen_random_uuid()::text,
  task_id varchar(36) not null references tasks(id),
  type alert_type not null,
  triggered_at timestamp not null default current_timestamp,
  resolved_at timestamp,
  acknowledged_by varchar(36) references users(id)
);
create index idx_alerts_task_resolved on alerts (task_id, resolved_at);

-- --- Activity log --------------------------------------------------------------------------

-- Append-only, written only by src/lib/services/activity-log.ts at each mutation call site.
-- Readable by super_admin/production_engineer only (enforced in src/lib/data, not here).
create table activity_log (
  id varchar(36) primary key default gen_random_uuid()::text,
  actor_id varchar(36) references users(id),
  action varchar(32) not null,
  table_name varchar(64) not null,
  record_id varchar(36) not null,
  before_data jsonb,
  after_data jsonb,
  created_at timestamp not null default current_timestamp
);
create index idx_activity_log_table on activity_log (table_name, record_id);
create index idx_activity_log_actor on activity_log (actor_id);
create index idx_activity_log_created on activity_log (created_at);