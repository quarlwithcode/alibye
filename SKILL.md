# alibye — Agent Skill

## What
Human time tracking CLI. Start/stop timers, log manual entries, generate timesheets and reports. Tracks billable hours with rounding, rate cascade, and break detection.

## When to Use
- User says "track time", "start timer", "log hours", "timesheet", "how long did I work"
- Tracking human (not AI) work time
- Generating billing reports or CSV exports
- Managing projects/clients for time tracking

## Commands

```bash
# Timer
alibye start "task description" -p "Project" -c "Client" -t "tag1,tag2"
alibye stop
alibye status
alibye continue
alibye discard

# Manual entry
alibye log --start 09:00 --end 12:30 --desc "Client meeting" -p "Project"
alibye log --start 12:30 --end 13:00 --break   # Break time

# Reports
alibye report --today --group project
alibye report --weekly
alibye report --from 2026-03-01 --to 2026-03-07 --format csv -o timesheet.csv

# Management
alibye project add "Name" --client "Client" --rate 150
alibye client add "Name" --rate 100
alibye backup create
```

## Key Behaviors
- Rate cascade: project rate > client rate > default rate
- Rounding: configurable (none/up/down/nearest × 1/5/6/10/15/30 min)
- All commands support `--json` for programmatic use
- `-d/--dir` to specify data directory (default: `.alibye`)
- Tags are auto-created on first use
- Break entries are automatically non-billable

## Data
- SQLite database at `<dir>/alibye.db`
- Backups via VACUUM INTO (WAL-safe)
- Environment variable: `ALIBYE_DIR`
