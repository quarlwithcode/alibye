# alibye — AGENTS.md

Drop this into your agent's workspace to enable human time tracking.

## Setup

```bash
npm install -g alibye
# Or use npx: npx alibye <command>
```

## Agent Integration Guide

### When Your Human Starts Work
```bash
alibye start "Task description" -p "ProjectName" --json -d .alibye
```

### When Your Human Stops Work
```bash
alibye stop --json -d .alibye
```

### Check If Timer Is Running
```bash
alibye status --json -d .alibye
```
Parse the JSON — `active_timer` will be non-null if running.

### Log Time on Behalf of Human
```bash
alibye log --start "2026-03-09T09:00:00" --end "2026-03-09T11:30:00" \
  --desc "Client meeting" -p "ProjectName" --json -d .alibye
```

### Generate Reports
```bash
# Weekly timesheet (JSON)
alibye report --weekly --format json -d .alibye

# CSV export for invoicing
alibye report --from 2026-03-01 --to 2026-03-31 --format csv -o timesheet.csv -d .alibye

# Summary by client
alibye report --group client --json -d .alibye
```

### Remind Human to Track
Check dashboard periodically. If no timer running and it's work hours:
```bash
alibye status --json -d .alibye
# If active_timer is null during work hours → nudge human
```

### Pipeline: alibye → prophit
```bash
# Export time data
alibye report --from 2026-03-01 --to 2026-03-31 --format json -o time-data.json -d .alibye
# Feed into prophit for invoice generation (future integration)
```

## Relationship to clawck
- **clawck** tracks YOUR time (AI agent execution)
- **alibye** tracks THEIR time (human working hours)
- Both feed into **prophit** for billing

## Key Flags
- `--json` — Always use for programmatic access
- `-d .alibye` — Explicit data directory
- `-p "Project"` — Associate with project
- `-c "Client"` — Associate with client
- `-t "tag1,tag2"` — Add tags
