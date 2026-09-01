import { sql } from "drizzle-orm";
import {
  boolean,
  check,
  datetime,
  float,
  index,
  int,
  json,
  mysqlEnum,
  mysqlTable,
  text,
  uniqueIndex,
  varchar,
} from "drizzle-orm/mysql-core";

const id = (name = "id") => varchar(name, { length: 36 }).primaryKey().$defaultFn(() => crypto.randomUUID());
const createdAt = (name = "created_at") => datetime(name, { mode: "date" }).notNull().default(sql`CURRENT_TIMESTAMP`);

export const USER_ROLES = ["super_admin", "production_engineer", "admin", "operator"] as const;
export type UserRole = (typeof USER_ROLES)[number];

export const TASK_STATUSES = ["working", "not_working"] as const;
export type TaskStatus = (typeof TASK_STATUSES)[number];

export const ALERT_TYPES = ["due_soon", "overdue", "critical", "not_working"] as const;
export type AlertType = (typeof ALERT_TYPES)[number];

// --- Equipment hierarchy -----------------------------------------------------------------

export const units = mysqlTable("units", {
  id: id(),
  code: varchar("code", { length: 32 }).notNull().unique(),
  name: varchar("name", { length: 255 }).notNull(),
  createdAt: createdAt(),
  archivedAt: datetime("archived_at", { mode: "date" }),
});

export const sections = mysqlTable(
  "sections",
  {
    id: id(),
    unitId: varchar("unit_id", { length: 36 }).notNull().references(() => units.id),
    code: varchar("code", { length: 64 }).notNull(),
    name: varchar("name", { length: 255 }),
    createdAt: createdAt(),
    archivedAt: datetime("archived_at", { mode: "date" }),
  },
  (t) => [
    uniqueIndex("sections_unit_code_unique").on(t.unitId, t.code),
    index("idx_sections_unit").on(t.unitId),
  ]
);

export const lubricants = mysqlTable("lubricants", {
  id: id(),
  name: varchar("name", { length: 255 }).notNull().unique(),
});

export const tasks = mysqlTable(
  "tasks",
  {
    id: id(),
    sectionId: varchar("section_id", { length: 36 }).notNull().references(() => sections.id),
    description: text("description").notNull(),
    pictureUrl: varchar("picture_url", { length: 512 }),
    noOfPoints: int("no_of_points").notNull().default(1),
    lubricationPoints: int("lubrication_points").notNull().default(1),
    frequencyLabel: varchar("frequency_label", { length: 32 }).notNull(),
    frequencyDays: int("frequency_days").notNull(),
    lubricantId: varchar("lubricant_id", { length: 36 }).references(() => lubricants.id),
    createdAt: createdAt(),
    archivedAt: datetime("archived_at", { mode: "date" }),
    isCritical: boolean("is_critical").notNull().default(false),
    pictureMarkerX: float("picture_marker_x"),
    pictureMarkerY: float("picture_marker_y"),
  },
  (t) => [
    index("idx_tasks_section").on(t.sectionId),
    check("picture_marker_x_range", sql`${t.pictureMarkerX} is null or (${t.pictureMarkerX} >= 0 and ${t.pictureMarkerX} <= 1)`),
    check("picture_marker_y_range", sql`${t.pictureMarkerY} is null or (${t.pictureMarkerY} >= 0 and ${t.pictureMarkerY} <= 1)`),
  ]
);

// --- Users, auth, unit assignments -------------------------------------------------------

export const users = mysqlTable("users", {
  id: id(),
  username: varchar("username", { length: 64 }).notNull().unique(),
  fullName: varchar("full_name", { length: 255 }).notNull(),
  role: mysqlEnum("role", USER_ROLES).notNull(),
  passwordHash: varchar("password_hash", { length: 255 }).notNull(),
  createdAt: createdAt(),
  createdBy: varchar("created_by", { length: 36 }),
});

// Opaque session tokens: the cookie holds the raw token, only its SHA-256 hash is stored here,
// so a DB read/leak alone can't be replayed as a valid session.
export const sessions = mysqlTable("sessions", {
  tokenHash: varchar("token_hash", { length: 64 }).primaryKey(),
  userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
  createdAt: createdAt(),
  expiresAt: datetime("expires_at", { mode: "date" }).notNull(),
});

export const userUnitAssignments = mysqlTable(
  "user_unit_assignments",
  {
    id: id(),
    userId: varchar("user_id", { length: 36 }).notNull().references(() => users.id, { onDelete: "cascade" }),
    unitId: varchar("unit_id", { length: 36 }).notNull().references(() => units.id),
    assignedBy: varchar("assigned_by", { length: 36 }).references(() => users.id),
    createdAt: createdAt(),
    revokedAt: datetime("revoked_at", { mode: "date" }),
  },
  (t) => [
    uniqueIndex("assignments_user_unit_unique").on(t.userId, t.unitId),
    index("idx_unit_assignments_user").on(t.userId),
    index("idx_unit_assignments_unit").on(t.unitId),
  ]
);

// --- Status history, current-state cache, alerts ------------------------------------------

// Append-only: no service-layer function ever updates/deletes a row here, and a DB trigger
// (see db/migrations, added after drizzle-kit generate) rejects UPDATE/DELETE outright as a
// hard backstop -- this table is the permanent audit trail of every check-off, ever.
export const taskStatusEvents = mysqlTable(
  "task_status_events",
  {
    id: id(),
    taskId: varchar("task_id", { length: 36 }).notNull().references(() => tasks.id),
    status: mysqlEnum("status", TASK_STATUSES).notNull(),
    comment: text("comment"),
    photoUrl: varchar("photo_url", { length: 512 }),
    recordedBy: varchar("recorded_by", { length: 36 }).notNull().references(() => users.id),
    createdAt: createdAt(),
  },
  (t) => [index("idx_status_events_task").on(t.taskId, t.createdAt)]
);

// Append-only, same guarantee as task_status_events.
export const eventAnnotations = mysqlTable(
  "event_annotations",
  {
    id: id(),
    eventId: varchar("event_id", { length: 36 }).notNull().references(() => taskStatusEvents.id),
    authorId: varchar("author_id", { length: 36 }).notNull().references(() => users.id),
    body: text("body").notNull(),
    createdAt: createdAt(),
  },
  (t) => [index("idx_annotations_event").on(t.eventId)]
);

// Denormalized read-model, 1:1 with tasks. Only ever written by
// src/lib/services/status-events.ts inside the same transaction as the event insert -- never
// exposed as a direct client write.
export const taskCurrentState = mysqlTable("task_current_state", {
  taskId: varchar("task_id", { length: 36 }).primaryKey().references(() => tasks.id),
  status: mysqlEnum("status", TASK_STATUSES).notNull().default("working"),
  lastEventId: varchar("last_event_id", { length: 36 }).references(() => taskStatusEvents.id),
  lastChangedAt: datetime("last_changed_at", { mode: "date" }),
  nextDueAt: datetime("next_due_at", { mode: "date" }),
  updatedAt: createdAt("updated_at"),
});

export const alertSettings = mysqlTable("alert_settings", {
  id: id(),
  // null = plant-wide default row; non-null = per-task override.
  taskId: varchar("task_id", { length: 36 }).unique().references(() => tasks.id),
  leadTimeDays: int("lead_time_days").notNull().default(2),
  escalationDays: int("escalation_days").notNull().default(2),
  updatedBy: varchar("updated_by", { length: 36 }).references(() => users.id),
  updatedAt: createdAt("updated_at"),
});

// Read-only to clients; only src/lib/services writes here (status-events.ts for not_working,
// alert-sweep.ts for due_soon/overdue/critical).
export const alerts = mysqlTable(
  "alerts",
  {
    id: id(),
    taskId: varchar("task_id", { length: 36 }).notNull().references(() => tasks.id),
    type: mysqlEnum("type", ALERT_TYPES).notNull(),
    triggeredAt: createdAt("triggered_at"),
    resolvedAt: datetime("resolved_at", { mode: "date" }),
    acknowledgedBy: varchar("acknowledged_by", { length: 36 }).references(() => users.id),
  },
  (t) => [index("idx_alerts_task_resolved").on(t.taskId, t.resolvedAt)]
);

// --- Activity log --------------------------------------------------------------------------

// Append-only, written only by src/lib/services/activity-log.ts at each mutation call site.
// Readable by super_admin/production_engineer only (enforced in src/lib/data, not here).
export const activityLog = mysqlTable(
  "activity_log",
  {
    id: id(),
    actorId: varchar("actor_id", { length: 36 }).references(() => users.id),
    action: varchar("action", { length: 32 }).notNull(),
    tableName: varchar("table_name", { length: 64 }).notNull(),
    recordId: varchar("record_id", { length: 36 }).notNull(),
    beforeData: json("before_data").$type<Record<string, unknown>>(),
    afterData: json("after_data").$type<Record<string, unknown>>(),
    createdAt: createdAt(),
  },
  (t) => [
    index("idx_activity_log_table").on(t.tableName, t.recordId),
    index("idx_activity_log_actor").on(t.actorId),
    index("idx_activity_log_created").on(t.createdAt),
  ]
);