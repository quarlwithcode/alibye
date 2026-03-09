# SKILL.md — alibye

## What
Human time tracking CLI for AI-managed workflows. Start/stop timers, log manual entries, manage projects/clients, generate reports and timesheets.

## When to Use
- Human needs to track billable hours
- AI agent managing human's time/schedule
- Generating timesheets for invoicing (pairs with prophit)
- Project/client time allocation reports

## Commands

### Timer Flow
```bash
alibye start "Task description" --project "Name" --client "Name" --tags "tag1,tag2"
alibye stop
alibye status          # Dashboard
alibye continue        # Restart last
alibye discard         # Drop without saving
```

### Manual Entry
```bash
alibye log --start 09:00 --end 12:30 --desc "Meeting" --project "Name"
alibye list --today
alibye list --week --project "Name"
```

### Reports
```bash
alibye report --today --group project
alibye report --weekly
alibye report --format csv -o timesheet.csv
alibye report --json
```

### Management
```bash
alibye client add "Name" --rate 150
alibye project add "Name" --client "Name" --rate 100
alibye tag list
alibye backup create
```

## Key Flags
- `--json` — All commands support JSON output
- `-d, --dir <path>` — Data directory (default: `.alibye`)
- `ALIBYE_DIR` — Environment variable override

## Rate Cascade
Project rate > Client rate > Default rate > $0

## Integration Pattern
1. Human mentions work → agent runs `alibye start`
2. Human finishes → agent runs `alibye stop`
3. End of week → agent runs `alibye report --weekly --json`
4. Invoice time → export CSV for prophit

## Data
SQLite database at `<data_dir>/alibye.db`. Automatic WAL-safe backups.
