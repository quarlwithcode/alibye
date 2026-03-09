# alibye — Agent Integration

Drop this into your AI agent's instructions to integrate human time tracking.

## Time Tracking Protocol

When your human starts work, track their time:

```bash
# Start timer when human begins a task
alibye start "Task description" -p "Project" -c "Client" -d .alibye

# Stop when they finish
alibye stop -d .alibye

# Check what's running
alibye status -d .alibye --json
```

## AI Agent Responsibilities

1. **Remind to track** — If human starts working without a timer, nudge them
2. **Stop forgotten timers** — If idle > 2 hours, ask if they want to stop
3. **Log on their behalf** — "I worked on X from 9 to 12" → `alibye log --start 09:00 --end 12:00 --desc "X"`
4. **Generate reports** — Weekly summary, client breakdowns, CSV for invoicing
5. **Feed into prophit** — Export CSV → create invoices from tracked hours

## Key Commands for Agents

```bash
# Dashboard (JSON for parsing)
alibye status --json -d .alibye

# Today's entries
alibye list --today --json -d .alibye

# Weekly report
alibye report --weekly --json -d .alibye

# CSV export for invoicing
alibye report --from 2026-03-01 --to 2026-03-07 --format csv -o timesheet.csv -d .alibye
```

## Pipeline

```
Human works → alibye tracks hours → prophit generates invoice → client pays
AI works   → clawck tracks hours ↗
```

## Important
- alibye tracks HUMAN time, clawck tracks AI time
- Always use `-d .alibye` (or set ALIBYE_DIR) for consistent data location
- `--json` flag on every command for programmatic parsing
- Break entries (`--break`) are automatically non-billable
