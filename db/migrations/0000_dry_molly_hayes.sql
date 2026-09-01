CREATE TABLE `activity_log` (
	`id` varchar(36) NOT NULL,
	`actor_id` varchar(36),
	`action` varchar(32) NOT NULL,
	`table_name` varchar(64) NOT NULL,
	`record_id` varchar(36) NOT NULL,
	`before_data` json,
	`after_data` json,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `activity_log_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `alert_settings` (
	`id` varchar(36) NOT NULL,
	`task_id` varchar(36),
	`lead_time_days` int NOT NULL DEFAULT 2,
	`escalation_days` int NOT NULL DEFAULT 2,
	`updated_by` varchar(36),
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `alert_settings_id` PRIMARY KEY(`id`),
	CONSTRAINT `alert_settings_task_id_unique` UNIQUE(`task_id`)
);
--> statement-breakpoint
CREATE TABLE `alerts` (
	`id` varchar(36) NOT NULL,
	`task_id` varchar(36) NOT NULL,
	`type` enum('due_soon','overdue','critical','not_working') NOT NULL,
	`triggered_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`resolved_at` datetime,
	`acknowledged_by` varchar(36),
	CONSTRAINT `alerts_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `event_annotations` (
	`id` varchar(36) NOT NULL,
	`event_id` varchar(36) NOT NULL,
	`author_id` varchar(36) NOT NULL,
	`body` text NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `event_annotations_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `lubricants` (
	`id` varchar(36) NOT NULL,
	`name` varchar(255) NOT NULL,
	CONSTRAINT `lubricants_id` PRIMARY KEY(`id`),
	CONSTRAINT `lubricants_name_unique` UNIQUE(`name`)
);
--> statement-breakpoint
CREATE TABLE `sections` (
	`id` varchar(36) NOT NULL,
	`unit_id` varchar(36) NOT NULL,
	`code` varchar(64) NOT NULL,
	`name` varchar(255),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	CONSTRAINT `sections_id` PRIMARY KEY(`id`),
	CONSTRAINT `sections_unit_code_unique` UNIQUE(`unit_id`,`code`)
);
--> statement-breakpoint
CREATE TABLE `sessions` (
	`token_hash` varchar(64) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`expires_at` datetime NOT NULL,
	CONSTRAINT `sessions_token_hash` PRIMARY KEY(`token_hash`)
);
--> statement-breakpoint
CREATE TABLE `task_current_state` (
	`task_id` varchar(36) NOT NULL,
	`status` enum('working','not_working') NOT NULL DEFAULT 'working',
	`last_event_id` varchar(36),
	`last_changed_at` datetime,
	`next_due_at` datetime,
	`updated_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `task_current_state_task_id` PRIMARY KEY(`task_id`)
);
--> statement-breakpoint
CREATE TABLE `task_status_events` (
	`id` varchar(36) NOT NULL,
	`task_id` varchar(36) NOT NULL,
	`status` enum('working','not_working') NOT NULL,
	`comment` text,
	`photo_url` varchar(512),
	`recorded_by` varchar(36) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	CONSTRAINT `task_status_events_id` PRIMARY KEY(`id`)
);
--> statement-breakpoint
CREATE TABLE `tasks` (
	`id` varchar(36) NOT NULL,
	`section_id` varchar(36) NOT NULL,
	`description` text NOT NULL,
	`picture_url` varchar(512),
	`no_of_points` int NOT NULL DEFAULT 1,
	`lubrication_points` int NOT NULL DEFAULT 1,
	`frequency_label` varchar(32) NOT NULL,
	`frequency_days` int NOT NULL,
	`lubricant_id` varchar(36),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	`is_critical` boolean NOT NULL DEFAULT false,
	`picture_marker_x` float,
	`picture_marker_y` float,
	CONSTRAINT `tasks_id` PRIMARY KEY(`id`),
	CONSTRAINT `picture_marker_x_range` CHECK(`tasks`.`picture_marker_x` is null or (`tasks`.`picture_marker_x` >= 0 and `tasks`.`picture_marker_x` <= 1)),
	CONSTRAINT `picture_marker_y_range` CHECK(`tasks`.`picture_marker_y` is null or (`tasks`.`picture_marker_y` >= 0 and `tasks`.`picture_marker_y` <= 1))
);
--> statement-breakpoint
CREATE TABLE `units` (
	`id` varchar(36) NOT NULL,
	`code` varchar(32) NOT NULL,
	`name` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`archived_at` datetime,
	CONSTRAINT `units_id` PRIMARY KEY(`id`),
	CONSTRAINT `units_code_unique` UNIQUE(`code`)
);
--> statement-breakpoint
CREATE TABLE `user_unit_assignments` (
	`id` varchar(36) NOT NULL,
	`user_id` varchar(36) NOT NULL,
	`unit_id` varchar(36) NOT NULL,
	`assigned_by` varchar(36),
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`revoked_at` datetime,
	CONSTRAINT `user_unit_assignments_id` PRIMARY KEY(`id`),
	CONSTRAINT `assignments_user_unit_unique` UNIQUE(`user_id`,`unit_id`)
);
--> statement-breakpoint
CREATE TABLE `users` (
	`id` varchar(36) NOT NULL,
	`username` varchar(64) NOT NULL,
	`full_name` varchar(255) NOT NULL,
	`role` enum('super_admin','production_engineer','admin','operator') NOT NULL,
	`password_hash` varchar(255) NOT NULL,
	`created_at` datetime NOT NULL DEFAULT CURRENT_TIMESTAMP,
	`created_by` varchar(36),
	CONSTRAINT `users_id` PRIMARY KEY(`id`),
	CONSTRAINT `users_username_unique` UNIQUE(`username`)
);
--> statement-breakpoint
ALTER TABLE `activity_log` ADD CONSTRAINT `activity_log_actor_id_users_id_fk` FOREIGN KEY (`actor_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_settings` ADD CONSTRAINT `alert_settings_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alert_settings` ADD CONSTRAINT `alert_settings_updated_by_users_id_fk` FOREIGN KEY (`updated_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `alerts` ADD CONSTRAINT `alerts_acknowledged_by_users_id_fk` FOREIGN KEY (`acknowledged_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_annotations` ADD CONSTRAINT `event_annotations_event_id_task_status_events_id_fk` FOREIGN KEY (`event_id`) REFERENCES `task_status_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `event_annotations` ADD CONSTRAINT `event_annotations_author_id_users_id_fk` FOREIGN KEY (`author_id`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sections` ADD CONSTRAINT `sections_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `sessions` ADD CONSTRAINT `sessions_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_current_state` ADD CONSTRAINT `task_current_state_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_current_state` ADD CONSTRAINT `task_current_state_last_event_id_task_status_events_id_fk` FOREIGN KEY (`last_event_id`) REFERENCES `task_status_events`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_status_events` ADD CONSTRAINT `task_status_events_task_id_tasks_id_fk` FOREIGN KEY (`task_id`) REFERENCES `tasks`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `task_status_events` ADD CONSTRAINT `task_status_events_recorded_by_users_id_fk` FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_section_id_sections_id_fk` FOREIGN KEY (`section_id`) REFERENCES `sections`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `tasks` ADD CONSTRAINT `tasks_lubricant_id_lubricants_id_fk` FOREIGN KEY (`lubricant_id`) REFERENCES `lubricants`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_unit_assignments` ADD CONSTRAINT `user_unit_assignments_user_id_users_id_fk` FOREIGN KEY (`user_id`) REFERENCES `users`(`id`) ON DELETE cascade ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_unit_assignments` ADD CONSTRAINT `user_unit_assignments_unit_id_units_id_fk` FOREIGN KEY (`unit_id`) REFERENCES `units`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
ALTER TABLE `user_unit_assignments` ADD CONSTRAINT `user_unit_assignments_assigned_by_users_id_fk` FOREIGN KEY (`assigned_by`) REFERENCES `users`(`id`) ON DELETE no action ON UPDATE no action;--> statement-breakpoint
CREATE INDEX `idx_activity_log_table` ON `activity_log` (`table_name`,`record_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_actor` ON `activity_log` (`actor_id`);--> statement-breakpoint
CREATE INDEX `idx_activity_log_created` ON `activity_log` (`created_at`);--> statement-breakpoint
CREATE INDEX `idx_alerts_task_resolved` ON `alerts` (`task_id`,`resolved_at`);--> statement-breakpoint
CREATE INDEX `idx_annotations_event` ON `event_annotations` (`event_id`);--> statement-breakpoint
CREATE INDEX `idx_sections_unit` ON `sections` (`unit_id`);--> statement-breakpoint
CREATE INDEX `idx_status_events_task` ON `task_status_events` (`task_id`,`created_at`);--> statement-breakpoint
CREATE INDEX `idx_tasks_section` ON `tasks` (`section_id`);--> statement-breakpoint
CREATE INDEX `idx_unit_assignments_user` ON `user_unit_assignments` (`user_id`);--> statement-breakpoint
CREATE INDEX `idx_unit_assignments_unit` ON `user_unit_assignments` (`unit_id`);