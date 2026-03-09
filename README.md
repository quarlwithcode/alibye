# ⏱️ alibye

**All I Bill You Ever** — Human time tracking for AI-managed workflows.

The missing piece between [clawck](https://github.com/quarlwithcode/clawck) (AI agent time tracking) and [prophit](https://github.com/quarlwithcode/prophit) (invoicing). alibye tracks *your* hours so your AI agent can manage your time, generate timesheets, remind you to track, and feed data into the billing pipeline.

## Install

```bash
npm install -g alibye
```

## Quick Start

```bash
# Set up a client and project
alibye client add "Acme Corp" --rate 150
alibye project add "Website Redesign" --client "Acme Corp"

# Start tracking
alibye start "Building hero section" --project "Website Redesign"

# Check status anytime
alibye status

# Stop when done
alibye stop

# Or log time manually
alibye log --start 09:00 --end 11:30 --desc "Client meeting" --project "Website Redesign"

# See your week
alibye report --weekly
```

## Commands

### Timer
| Command | Description |
|---------|-------------|
| `alibye start [desc]` | Start a timer (`-p project`, `-c client`, `-t tags`, `--pomodoro`) |
| `alibye stop` | Stop timer, create entry with rounding + billing |
| `alibye status` | Dashboard: active timer, today, this week |
| `alibye continue` | Restart the last timer |
| `alibye discard` | Discard timer without saving |

### Entries
| Command | Description |
|---------|-------------|
| `alibye log` | Manual entry (`--start`, `--end`, `--desc`, `--break`) |
| `alibye list` | List entries (`--today`, `--week`, `--from`, `--to`) |
| `alibye edit <id>` | Update entry fields |
| `alibye delete <id>` | Remove an entry |

### Reports
| Command | Description |
|---------|-------------|
| `alibye report` | Summary by project/client/day/tag |
| `alibye report --weekly` | Weekly timesheet grid |
| `alibye report --format csv` | CSV export |
| `alibye report --format json -o report.json` | JSON file export |

### Management
| Command | Description |
|---------|-------------|
| `alibye project add/list/archive` | Project management |
| `alibye client add/list/archive` | Client management |
| `alibye tag list/delete` | Tag management |
| `alibye backup create/list/restore` | Database backup |

## Features

- **Timer + Manual Entry** — Start/stop or log after the fact
- **Time Rounding** — Up/down/nearest to 1/5/6/10/15/30 min intervals
- **Rate Cascade** — Project rate > Client rate > Default rate
- **Billable Tracking** — Auto-calculates amounts from rounded time × rate
- **Pomodoro Mode** — Built-in work/break cycles
- **Break Tracking** — Separate break entries from work
- **Tags** — Auto-created, comma-separated, filterable
- **Weekly Timesheet** — Mon-Sun grid with daily totals
- **Summary Reports** — Group by project, client, day, or tag
- **CSV/JSON Export** — For spreadsheets or pipeline integrations
- **Continue Last** — One command to restart your last task
- **SQLite Storage** — Fast, reliable, portable
- **Backup System** — VACUUM INTO (WAL-safe), auto-prune to 10

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` | JSON output for all commands |
| `-d, --dir <path>` | Data directory (default: `.alibye`, env: `ALIBYE_DIR`) |

## The Pipeline

```
You work → alibye tracks hours → prophit generates invoices → clawck tracks AI time
```

alibye is the human side of the CubiCrew time/billing ecosystem:
- **clawck** — AI agent execution time (automatic)
- **alibye** — Human working time (timer + manual)
- **prophit** — Invoice lifecycle management (billing)

## Part of CubiCrew

Built by [CubiCrew](https://cubicrew.com) — AI employees that work outside the box.

## License

MIT
