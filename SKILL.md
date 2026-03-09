# alibye — SKILL.md

## What
Human time tracking CLI for AI-managed workflows. Track hours, manage projects/clients, generate timesheets, export for billing.

## When to Use
- Human starts/stops working on a task
- Need to log manual time entries
- Generate weekly timesheets or reports
- Export time data for invoicing (pairs with prophit)
- Track billable vs non-billable hours
- Manage projects, clients, and rates

## Commands

```bash
# Timer
alibye start "Task description" -p "Project" -c "Client" -t "tag1,tag2"
alibye stop
alibye status
alibye continue
alibye discard

# Manual entry
alibye log --start 09:00 --end 11:30 --desc "Meeting" -p "Project"
alibye log --start 12:00 --end 12:30 --break  # Break time

# Reports
alibye list --today
alibye list --week --project "Project Name"
alibye report --weekly
alibye report --group client --from 2026-03-01 --to 2026-03-31
alibye report --format csv -o timesheet.csv

# Management
alibye project add "Name" --client "Client" --rate 150
alibye client add "Name" --email "email@example.com" --rate 100
alibye tag list

# Backup
alibye backup create --reason "before migration"
alibye backup list
```

## Rate Cascade
Project rate > Client rate > Default rate. Set `--rate` on project or client.

## Time Rounding
Configure rounding mode (none/up/down/nearest) and interval (1/5/6/10/15/30 min).

## Integration
- **clawck**: AI agent time (automatic) — alibye is the human complement
- **prophit**: Feed alibye timesheets into prophit for invoice generation
- **JSON output**: All commands support `--json` for pipeline use

## Data
- SQLite database at `.alibye/alibye.db` (or `ALIBYE_DIR` env)
- Auto-backup with VACUUM INTO before migrations
- `-d/--dir` flag overrides data directory
