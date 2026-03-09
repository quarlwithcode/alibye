# ⏱️ alibye

**All I Bill You Ever** — Human time tracking for AI-managed workflows.

The missing piece between [clawck](https://github.com/quarlwithcode/clawck) (AI agent time) and [prophit](https://github.com/quarlwithcode/prophit) (invoicing). alibye tracks *your* hours so your AI agent can manage your time, generate timesheets, remind you to track, and feed data into the billing pipeline.

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
alibye start "Building landing page" --project "Website Redesign"

# ... do work ...

# Stop and see what you earned
alibye stop

# Check your dashboard
alibye status
```

## Commands

### Timer
| Command | Description |
|---------|-------------|
| `alibye start [desc]` | Start a timer (`-p` project, `-c` client, `-t` tags, `--pomodoro`) |
| `alibye stop` | Stop timer, create entry with rounding + billing |
| `alibye status` | Dashboard: active timer, today, this week |
| `alibye continue` | Restart the last timer |
| `alibye discard` | Discard timer without saving |

### Entries
| Command | Description |
|---------|-------------|
| `alibye log` | Manual entry (`--start`, `--end`, `--desc`, `--break`) |
| `alibye list` | List entries (`--today`, `--week`, `--from`, `--to`) |
| `alibye edit <id>` | Update an entry |
| `alibye delete <id>` | Remove an entry |

### Reports
| Command | Description |
|---------|-------------|
| `alibye report` | Summary by project/client/day/tag |
| `alibye report --weekly` | Weekly timesheet grid |
| `alibye report --format csv` | CSV export |
| `alibye report --format json` | JSON export |

### Management
| Command | Description |
|---------|-------------|
| `alibye project add/list/archive` | Project management |
| `alibye client add/list/archive` | Client management |
| `alibye tag list/delete` | Tag management |
| `alibye backup create/list/restore` | Database backup |

## Features

- **Timer + Manual Entry** — Start/stop or log time after the fact
- **Time Rounding** — Up, down, nearest to 1/5/6/10/15/30 min intervals
- **Billable Rate Cascade** — Project rate > Client rate > Default rate
- **Pomodoro Mode** — Built-in work/break cycling
- **Break Tracking** — Separate break entries from work
- **Idle Detection** — Flag suspiciously long timer entries
- **Weekly Timesheets** — Mon-Sun grid with daily totals
- **CSV/JSON Export** — Feed into invoicing, accounting, or prophit
- **SQLite Storage** — Fast, portable, zero-config
- **VACUUM INTO Backups** — WAL-safe, auto-prune to 10

## Global Flags

| Flag | Description |
|------|-------------|
| `--json` | JSON output (all commands) |
| `-d, --dir <path>` | Data directory (default: `.alibye`, env: `ALIBYE_DIR`) |

## Pipeline Integration

```
alibye (human hours) → prophit (invoices) → ledgeyour (accounting)
clawck (AI hours)   ↗
```

## License

MIT
