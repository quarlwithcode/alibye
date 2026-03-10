# ⏱️ alibye

**All I Bill You Ever** — Human time tracking for AI-managed workflows.

The missing piece between [clawck](https://github.com/quarlwithcode/clawck) (AI agent time) and [prophit](https://github.com/quarlwithcode/prophit) (invoicing). alibye tracks *your* hours so your AI agent can manage your time, generate timesheets, remind you to track, and feed data into the billing pipeline.

## Install

```bash
npm install -g alibye
```

## Quick Start

```bash
# Set up a client, project, and task
alibye client add "Acme Corp" --rate 150
alibye project add "Website Redesign" --client "Acme Corp" --budget-hours 100
alibye task add "Build landing page" --project "Website Redesign" --rate 175

# Start tracking
alibye start "Building landing page" --task "Build landing page"

# ... do work ...

# Stop and see what you earned
alibye stop

# Check your dashboard
alibye status
```

## Rate Hierarchy

```
1. Entry rate override    (--rate on start/log/edit)
2. Task rate              (task.rate)
3. Work type rate         (worktype.rate)
4. Project rate           (project.rate)
5. Client rate            (client.rate)
6. Default rate           (config default_rate)
```

First non-null, non-zero value wins. If nothing is set and default is 0, entries are unbilled.

## Commands

### Timer
| Command | Description |
|---------|-------------|
| `alibye start [desc]` | Start a timer (`-p` project, `-c` client, `-k` task, `-w` worktype, `--rate`, `-t` tags, `--pomodoro`) |
| `alibye stop` | Stop timer, create entry with rounding + billing |
| `alibye status` | Dashboard: active timer, today, this week, quota, budget alerts |
| `alibye continue` | Restart the last timer |
| `alibye discard` | Discard timer without saving |

### Entries
| Command | Description |
|---------|-------------|
| `alibye log` | Manual entry (`--start`, `--end`, `--desc`, `-k` task, `-w` worktype, `--rate`, `--date`, `--yesterday`, `--break`) |
| `alibye list` | List entries (`--today`, `--week`, `--month`, `--last-month`, `--group`, `-k` task) |
| `alibye edit <id>` | Update an entry (`--task`, `--worktype`, `--tags`, `--rate`, `--billable`, `--date`) |
| `alibye delete <id>` | Remove an entry |

### Reports
| Command | Description |
|---------|-------------|
| `alibye report` | Summary by project/client/day/tag/task/worktype |
| `alibye report --weekly` | Weekly timesheet grid |
| `alibye report --month` | This month's summary |
| `alibye report --format csv` | CSV export |
| `alibye burn` | Budget burn report (`-p` project, `-c` client, `-k` task) |

### Tasks & Work Types
| Command | Description |
|---------|-------------|
| `alibye task add/list/edit/archive/summary` | Task management with budgets |
| `alibye worktype add/list/edit/delete` | Work type management with rates |

### Management
| Command | Description |
|---------|-------------|
| `alibye project add/list/edit/archive/summary` | Project management with budgets |
| `alibye client add/list/edit/archive/summary` | Client management with budgets |
| `alibye config set/get/view/reset` | Persistent configuration |
| `alibye tag list/delete` | Tag management |
| `alibye backup create/list/restore` | Database backup |

## Features

- **Timer + Manual Entry** — Start/stop or log time after the fact
- **Tasks & Work Types** — Organize work with dedicated rate/budget tracking
- **6-Level Rate Cascade** — Override > Task > Work Type > Project > Client > Default
- **Budget Tracking** — Hours and amount budgets with green/yellow/red/over status
- **Quota Tracking** — Daily and weekly hour targets with pace projection
- **Burn Reports** — Progress bars and projections for budgeted entities
- **Time Rounding** — Up, down, nearest to 1/5/6/10/15/30 min intervals
- **Config Persistence** — `config.json` with set/get/view/reset
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

## Documentation

- [Getting Started](GETTING_STARTED.md) — Install, concepts, first session
- [Agent Integration](AGENTS.md) — AI agent playbook
- [Agent Skill](SKILL.md) — Behavioral rules for AI
- [Human-Agent Pairing](QUICKSTART_SYNC.md) — Setup and progressive trust

## License

MIT
