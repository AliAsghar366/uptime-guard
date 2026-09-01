-- MySQL has no Row-Level Security, so unlike the old Postgres schema (which simply omitted
-- UPDATE/DELETE policies to make these tables append-only for every role, including
-- super_admin), that guarantee has to be a hard DB-level rule here instead. These triggers
-- reject any UPDATE/DELETE outright, as a backstop behind the service layer never exposing
-- such an operation in the first place.
--
-- No DELIMITER directive here on purpose: DELIMITER is a client-side parsing convenience for
-- the interactive `mysql` CLI, not real SQL -- the driver sends each statement below as a
-- single query already (split by Drizzle's own breakpoint markers, omitted from this comment
-- since the literal marker text would itself get matched as a split point), and the server
-- parses a CREATE TRIGGER body's internal semicolons correctly on its own.

CREATE TRIGGER task_status_events_no_update BEFORE UPDATE ON task_status_events
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'task_status_events is append-only and cannot be updated';
END;
--> statement-breakpoint
CREATE TRIGGER task_status_events_no_delete BEFORE DELETE ON task_status_events
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'task_status_events is append-only and cannot be deleted';
END;
--> statement-breakpoint
CREATE TRIGGER event_annotations_no_update BEFORE UPDATE ON event_annotations
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'event_annotations is append-only and cannot be updated';
END;
--> statement-breakpoint
CREATE TRIGGER event_annotations_no_delete BEFORE DELETE ON event_annotations
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'event_annotations is append-only and cannot be deleted';
END;
--> statement-breakpoint
CREATE TRIGGER alerts_no_update BEFORE UPDATE ON alerts
FOR EACH ROW BEGIN
  IF NOT (
    -- Allow only resolved_at/acknowledged_by to change (the not_working auto-resolve and the
    -- alert-sweep service both only ever touch those two columns) -- everything else about an
    -- alert, once fired, is immutable.
    NEW.id = OLD.id AND NEW.task_id = OLD.task_id AND NEW.type = OLD.type
    AND NEW.triggered_at = OLD.triggered_at
  ) THEN
    SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'alerts rows are immutable except resolved_at/acknowledged_by';
  END IF;
END;
--> statement-breakpoint
CREATE TRIGGER alerts_no_delete BEFORE DELETE ON alerts
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'alerts is append-only and cannot be deleted';
END;
--> statement-breakpoint
CREATE TRIGGER activity_log_no_update BEFORE UPDATE ON activity_log
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'activity_log is append-only and cannot be updated';
END;
--> statement-breakpoint
CREATE TRIGGER activity_log_no_delete BEFORE DELETE ON activity_log
FOR EACH ROW BEGIN
  SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'activity_log is append-only and cannot be deleted';
END;