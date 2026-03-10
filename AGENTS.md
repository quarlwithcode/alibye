# alibye — Agent Integration Playbook

## Decision Tree

```
Human mentions work → Is timer running?
  Yes → Remind them, continue
  No  → Start timer: alibye start "description" -p "Project" -k "Task" -d .alibye

Human stops working → Stop timer: alibye stop -d .alibye --json
Human says "I worked on X from 9-12" → alibye log --start 09:00 --end 12:00 --desc "X" -d .alibye
Human asks "how much this week" → alibye report --week --json -d .alibye
Human asks about budget → alibye burn -p "Project" --json -d .alibye
End of week → Generate weekly report and budget status
```

## Time Tracking Protocol

```bash
# Start timer when human begins a task
alibye start "Task description" -p "Project" -k "Task" -w "Development" -d .alibye

# Stop when they finish
alibye stop -d .alibye

# Check what's running
alibye status -d .alibye --json

# Log retroactively
alibye log --start 09:00 --end 12:00 --desc "Meeting" -p "Project" --yesterday -d .alibye
```

## AI Agent Responsibilities

1. **Remind to track** — If human starts working without a timer, nudge them
2. **Stop forgotten timers** — If idle > 2 hours, ask if they want to stop
3. **Log on their behalf** — "I worked on X from 9 to 12" → `alibye log`
4. **Generate reports** — Weekly summary, client breakdowns, CSV for invoicing
5. **Monitor budgets** — Check burn status, warn when approaching limits
6. **Track quotas** — Report daily/weekly progress against targets
7. **Feed into prophit** — Export CSV → create invoices from tracked hours

## Key Commands (JSON for parsing)

```bash
# Dashboard with quota + budget warnings
alibye status --json -d .alibye

# Today's entries
alibye list --today --json -d .alibye

# Weekly report
alibye report --weekly --json -d .alibye

# Monthly report by task
alibye report --month --group task --json -d .alibye

# Budget burn report
alibye burn -p "Project" --json -d .alibye

# CSV export for invoicing
alibye report --from 2026-03-01 --to 2026-03-07 --format csv -o timesheet.csv -d .alibye

# Config check
alibye config view --json -d .alibye
```

## Proactive Behaviors

- **Morning**: Check `alibye status --json` — remind human of quota target
- **Idle detection**: If timer > 2 hours with no activity, prompt to stop
- **Budget alerts**: After each stop, check `alibye burn` for entities approaching limits
- **End of day**: Generate summary of tracked time
- **End of week**: Generate weekly timesheet and quota status

## Correction Flow

If human says "that entry is wrong":
1. `alibye list --today --json` to find the entry
2. `alibye edit <id> --start 09:30 --end 11:00` to fix
3. Confirm the correction

## JSON Parsing Notes

- All commands support `--json` for structured output
- `status --json` returns `{ active_timer, quota, budget_warnings, ... }`
- `burn --json` returns `{ budget: BudgetStatus, entries: TimeEntry[] }`
- Entry IDs are UUIDs — use them for edit/delete
- Rates are resolved via cascade — check `entry.rate` for final value
- `entry.entry_rate_override` is non-null only when `--rate` was explicitly passed

## Pipeline

```
Human works → alibye tracks hours → prophit generates invoice → client pays
AI works   → clawck tracks hours ↗
```

## Important

- alibye tracks HUMAN time, clawck tracks AI time
- Always use `-d .alibye` (or set `ALIBYE_DIR`) for consistent data location
- `--json` flag on every command for programmatic parsing
- Break entries (`--break`) are automatically non-billable
- Tasks auto-resolve project + client when linked
