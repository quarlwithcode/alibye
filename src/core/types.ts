/**
 * ⏱️ alibye — Types & Schemas
 * Human time tracking for AI-managed workflows.
 */

import { z } from 'zod';

export const APP_VERSION = '0.1.1';
export const SCHEMA_VERSION = 2;

// ─── Rounding ─────────────────────────────────────────────

export const ROUNDING_MODES = ['none', 'up', 'down', 'nearest'] as const;
export type RoundingMode = typeof ROUNDING_MODES[number];

export const ROUNDING_INTERVALS = [1, 5, 6, 10, 15, 30] as const;
export type RoundingInterval = typeof ROUNDING_INTERVALS[number];

// ─── Entry Types ──────────────────────────────────────────

export const ENTRY_SOURCES = ['timer', 'manual', 'pomodoro', 'import'] as const;
export type EntrySource = typeof ENTRY_SOURCES[number];

export const TimeEntrySchema = z.object({
  id: z.string().uuid(),
  description: z.string().default(''),
  project_id: z.string().uuid().nullable(),
  client_id: z.string().uuid().nullable(),
  task_id: z.string().uuid().nullable(),
  work_type_id: z.string().uuid().nullable(),
  start: z.string(),              // ISO datetime
  end: z.string().nullable(),     // ISO datetime
  duration_ms: z.number().int().min(0),
  rounded_minutes: z.number().min(0),
  billable: z.boolean().default(true),
  rate: z.number().min(0).nullable(),      // $/hr — resolved via cascade
  entry_rate_override: z.number().min(0).nullable(),  // explicit --rate value
  amount: z.number().min(0).default(0),    // rounded_minutes/60 * rate
  source: z.enum(ENTRY_SOURCES).default('manual'),
  is_break: z.boolean().default(false),
  is_idle: z.boolean().default(false),
  created_at: z.string(),
  updated_at: z.string(),
});
export type TimeEntry = z.infer<typeof TimeEntrySchema>;

export const ProjectSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  client_id: z.string().uuid().nullable(),
  color: z.string().default('#3b82f6'),
  billable: z.boolean().default(true),
  rate: z.number().min(0).nullable(),
  budget_hours: z.number().min(0).nullable(),
  budget_amount: z.number().min(0).nullable(),
  archived: z.boolean().default(false),
  created_at: z.string(),
});
export type Project = z.infer<typeof ProjectSchema>;

export const ClientSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  email: z.string().optional(),
  rate: z.number().min(0).nullable(),
  budget_hours: z.number().min(0).nullable(),
  budget_amount: z.number().min(0).nullable(),
  archived: z.boolean().default(false),
  created_at: z.string(),
});
export type Client = z.infer<typeof ClientSchema>;

export const TaskSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  project_id: z.string().uuid().nullable(),
  client_id: z.string().uuid().nullable(),
  rate: z.number().min(0).nullable(),
  budget_hours: z.number().min(0).nullable(),
  budget_amount: z.number().min(0).nullable(),
  billable: z.boolean().default(true),
  archived: z.boolean().default(false),
  created_at: z.string(),
});
export type Task = z.infer<typeof TaskSchema>;

export const WorkTypeSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  rate: z.number().min(0).nullable(),
  created_at: z.string(),
});
export type WorkType = z.infer<typeof WorkTypeSchema>;

export const TagSchema = z.object({
  id: z.string().uuid(),
  name: z.string().min(1),
  created_at: z.string(),
});
export type Tag = z.infer<typeof TagSchema>;

// ─── Timer State ──────────────────────────────────────────

export const ActiveTimerSchema = z.object({
  id: z.string().uuid(),
  description: z.string().default(''),
  project_id: z.string().uuid().nullable(),
  client_id: z.string().uuid().nullable(),
  task_id: z.string().uuid().nullable(),
  work_type_id: z.string().uuid().nullable(),
  start: z.string(),
  billable: z.boolean().default(true),
  tags: z.array(z.string()).default([]),
  pomodoro: z.boolean().default(false),
  pomodoro_work_ms: z.number().int().default(25 * 60 * 1000),
  pomodoro_break_ms: z.number().int().default(5 * 60 * 1000),
  pomodoro_session: z.number().int().default(1),
});
export type ActiveTimer = z.infer<typeof ActiveTimerSchema>;

// ─── Config ───────────────────────────────────────────────

export interface AlibyeConfig {
  data_dir: string;
  default_rate: number;
  rounding_mode: RoundingMode;
  rounding_interval: RoundingInterval;
  idle_threshold_minutes: number;
  pomodoro_work_minutes: number;
  pomodoro_break_minutes: number;
  pomodoro_long_break_minutes: number;
  pomodoro_sessions_before_long: number;
  weekly_quota_hours: number;
  daily_quota_hours: number;
}

export const DEFAULT_CONFIG: AlibyeConfig = {
  data_dir: '.alibye',
  default_rate: 0,
  rounding_mode: 'none',
  rounding_interval: 1,
  idle_threshold_minutes: 120,
  pomodoro_work_minutes: 25,
  pomodoro_break_minutes: 5,
  pomodoro_long_break_minutes: 15,
  pomodoro_sessions_before_long: 4,
  weekly_quota_hours: 0,
  daily_quota_hours: 0,
};

// ─── Report Types ─────────────────────────────────────────

export interface SummaryRow {
  key: string;            // project name, client name, date, or tag
  entries: number;
  total_minutes: number;
  rounded_minutes: number;
  billable_minutes: number;
  billable_amount: number;
}

export interface WeeklyDay {
  date: string;           // YYYY-MM-DD
  day: string;            // Mon, Tue, etc.
  total_minutes: number;
  billable_minutes: number;
  entries: number;
}

export interface WeeklyTimesheet {
  week_start: string;
  week_end: string;
  days: WeeklyDay[];
  total_minutes: number;
  billable_minutes: number;
  billable_amount: number;
  total_entries: number;
}

export interface BudgetStatus {
  entity_type: 'project' | 'client' | 'task';
  entity_id: string;
  entity_name: string;
  budget_hours: number | null;
  budget_amount: number | null;
  used_hours: number;
  used_amount: number;
  remaining_hours: number | null;
  remaining_amount: number | null;
  percent_hours: number | null;
  percent_amount: number | null;
  status: 'green' | 'yellow' | 'red' | 'over';
}

export interface QuotaStatus {
  daily_target: number;
  daily_tracked: number;
  daily_remaining: number;
  daily_percent: number;
  weekly_target: number;
  weekly_tracked: number;
  weekly_remaining: number;
  weekly_percent: number;
  projected_week_total: number;
  on_pace: boolean;
}

export interface DashboardData {
  active_timer: ActiveTimer | null;
  elapsed_ms: number;
  today_minutes: number;
  today_entries: number;
  today_billable: number;
  week_minutes: number;
  week_billable: number;
  break_minutes_today: number;
  quota: QuotaStatus | null;
  budget_warnings: BudgetStatus[];
}

export interface BackupInfo {
  path: string;
  created_at: string;
  size_bytes: number;
  reason: string;
}
