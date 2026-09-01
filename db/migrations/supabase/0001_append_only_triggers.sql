-- Postgres equivalent of db/migrations/0001_append_only_triggers.sql.
--
-- Same intent as the MySQL version: these tables must be append-only for every role, including
-- whatever role the app connects as -- not just enforced in application code. Postgres has no
-- SIGNAL statement; the equivalent is a PL/pgSQL trigger function that RAISEs an exception,
-- attached via CREATE TRIGGER ... EXECUTE FUNCTION.
--
-- Two generic functions (reject_update / reject_delete) cover the plain append-only tables;
-- `alerts` gets its own function since it allows resolved_at/acknowledged_by to change.

create or replace function reject_update() returns trigger as $$
begin
  raise exception '% is append-only and cannot be updated', TG_TABLE_NAME;
end;
$$ language plpgsql;

create or replace function reject_delete() returns trigger as $$
begin
  raise exception '% is append-only and cannot be deleted', TG_TABLE_NAME;
end;
$$ language plpgsql;

create trigger task_status_events_no_update before update on task_status_events
for each row execute function reject_update();

create trigger task_status_events_no_delete before delete on task_status_events
for each row execute function reject_delete();

create trigger event_annotations_no_update before update on event_annotations
for each row execute function reject_update();

create trigger event_annotations_no_delete before delete on event_annotations
for each row execute function reject_delete();

create trigger activity_log_no_update before update on activity_log
for each row execute function reject_update();

create trigger activity_log_no_delete before delete on activity_log
for each row execute function reject_delete();

-- alerts: allow only resolved_at/acknowledged_by to change (the not_working auto-resolve and
-- the alert-sweep service both only ever touch those two columns) -- everything else about an
-- alert, once fired, is immutable.
create or replace function alerts_reject_immutable_update() returns trigger as $$
begin
  if not (
    NEW.id = OLD.id and NEW.task_id = OLD.task_id and NEW.type = OLD.type
    and NEW.triggered_at = OLD.triggered_at
  ) then
    raise exception 'alerts rows are immutable except resolved_at/acknowledged_by';
  end if;
  return NEW;
end;
$$ language plpgsql;

create trigger alerts_no_update before update on alerts
for each row execute function alerts_reject_immutable_update();

create trigger alerts_no_delete before delete on alerts
for each row execute function reject_delete();