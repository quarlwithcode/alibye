# Getting Started with alibye

## Install

```bash
npm install -g alibye
```

## Concepts

**alibye** tracks your working hours with billing support. Core concepts:

- **Client** — Who you bill (e.g., "Acme Corp")
- **Project** — What you're working on (e.g., "Website Redesign")
- **Task** — Specific work items within a project (e.g., "Build landing page")
- **Work Type** — Category of work with its own rate (e.g., "Development", "Consulting")
- **Entry** — A recorded time period with duration, billing, and associations
- **Rate Cascade** — Automatic rate resolution: override > task > work type > project > client > default

## First Client & Project

```bash
alibye client add "Acme Corp" --rate 100 --email billing@acme.com
alibye project add "Website Redesign" --client "Acme Corp" --rate 150 --budget-hours 100
```

The project rate ($150/hr) overrides the client rate ($100/hr) for entries on this project.

## First Task

```bash
alibye task add "Build landing page" --project "Website Redesign" --budget-hours 20
```

Tasks inherit the project's client automatically. Optional: set a task-specific rate with `--rate`.

## Track Time

### Timer (recommended)

```bash
alibye start "Building the hero section" --task "Build landing page"
# ... work ...
alibye stop
```

### Manual entry

```bash
alibye log --start 09:00 --end 12:30 --desc "Client meeting" --project "Website Redesign"
alibye log --start 14:00 --end 17:00 --desc "Yesterday's work" --yesterday
```

### Breaks

```bash
alibye log --start 12:00 --end 13:00 --break
```

## Dashboard

```bash
alibye status
```

Shows: active timer, today's hours/earnings, weekly totals, quota progress (if configured), and budget warnings.

## Reports

```bash
alibye report --today                    # Today's summary
alibye report --week --group task        # Weekly by task
alibye report --month                    # Monthly summary
alibye report --weekly                   # 7-day timesheet grid
alibye report --format csv -o report.csv # CSV export
```

## Rate Hierarchy

When a timer stops or entry is logged, the rate is resolved in order:

1. **`--rate` flag** on the command (explicit override)
2. **Task rate** if task is set
3. **Work type rate** if work type is set
4. **Project rate** if project is set
5. **Client rate** if client is set
6. **Default rate** from config

First non-zero value wins.

## Budgets

Set budgets on projects, clients, or tasks:

```bash
alibye project edit "Website Redesign" --budget-hours 100 --budget-amount 15000
alibye burn -p "Website Redesign"    # See burn report with progress bar
```

Budget status colors: green (<70%), yellow (70-90%), red (90-100%), over (>100%).

## Quotas

Set daily/weekly hour targets:

```bash
alibye config set daily_quota_hours 8
alibye config set weekly_quota_hours 40
```

The dashboard shows your progress and pace projection.

## Configuration

```bash
alibye config set default_rate 100       # Default billing rate
alibye config set rounding_mode up       # Round durations up
alibye config set rounding_interval 15   # Round to 15-minute blocks
alibye config view                       # See all settings
```

## Export & Pipeline

```bash
alibye report --from 2026-03-01 --to 2026-03-31 --format csv -o march.csv
```

This feeds into the billing pipeline:
```
alibye (human hours) → prophit (invoices) → ledgeyour (accounting)
```
