# alibye — Agent Skill

## What
Human time tracking CLI. Start/stop timers, log manual entries, manage tasks/work types with budgets, generate timesheets and reports. Tracks billable hours with 6-level rate cascade, rounding, quota tracking, and budget monitoring.

## When to Use
- User says "track time", "start timer", "log hours", "timesheet", "how long did I work"
- Tracking human (not AI) work time
- Generating billing reports or CSV exports
- Managing projects/clients/tasks for time tracking
- Checking budget status or burn rate
- Setting daily/weekly hour quotas

## Commands

```bash
# Timer
alibye start "task description" -p "Project" -k "Task" -w "WorkType" --rate 150 -t "tag1,tag2"
alibye stop
alibye status
alibye continue
alibye discard

# Manual entry
alibye log --start 09:00 --end 12:30 --desc "Client meeting" -p "Project" -k "Task"
alibye log --start 09:00 --end 09:30 --break   # Break time
alibye log --start 14:00 --end 17:00 --desc "Yesterday work" --yesterday

# Reports
alibye report --today --group project
alibye report --weekly
alibye report --month --group task
alibye report --from 2026-03-01 --to 2026-03-07 --format csv -o timesheet.csv
alibye burn -p "Project"

# Tasks
alibye task add "Build API" -p "Project" --rate 175 --budget-hours 40
alibye task list --project "Project"
alibye task summary "Build API"

# Work types
alibye worktype add "Development" --rate 150
alibye worktype add "Consulting" --rate 200

# Management
alibye project add "Name" --client "Client" --rate 150 --budget-hours 100
alibye project edit "Name" --budget-amount 15000
alibye project summary "Name"
alibye client add "Name" --rate 100 --budget-hours 200
alibye client summary "Name"

# Config
alibye config set default_rate 100
alibye config set weekly_quota_hours 40
alibye config set daily_quota_hours 8
alibye config view

alibye backup create
```

## Key Behaviors
- Rate cascade: override > task > work type > project > client > default rate
- Tasks auto-resolve project + client from linked entities
- Rounding: configurable (none/up/down/nearest x 1/5/6/10/15/30 min)
- Budget status: green (<70%), yellow (70-90%), red (90-100%), over (>100%)
- Quota tracking: daily/weekly targets with pace projection
- All commands support `--json` for programmatic use
- `-d/--dir` to specify data directory (default: `.alibye`)
- Tags are auto-created on first use
- Break entries are automatically non-billable
- Config persists to `config.json` in data directory

## Data
- SQLite database at `<dir>/alibye.db`
- Config at `<dir>/config.json`
- Backups via VACUUM INTO (WAL-safe)
- Environment variable: `ALIBYE_DIR`
