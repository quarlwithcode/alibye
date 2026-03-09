# ⏱️ alibye

**All I Bill You Ever** — Human time tracking for AI-managed workflows.

The missing link between [clawck](https://github.com/quarlwithcode/clawck) (AI agent time) and [prophit](https://github.com/quarlwithcode/prophit) (invoicing). alibye tracks *your* hours so your AI agent can manage your time, generate timesheets, and feed data into the billing pipeline.

> Built by CubiCrew — Work Outside The Box

## Install

```bash
npm install -g alibye
```

## Quick Start

```bash
# Set up a client + project
alibye client add "Acme Corp" --rate 150
alibye project add "Website Redesign" --client "Acme Corp"

# Start tracking
alibye start "Building landing page" --project "Website Redesign"

# ... do work ...

# Stop and see your time
alibye stop

# Check your dashboard
alibye status
```

## Commands

### Timer
```bash
alibye start [description]       # Start a timer
alibye stop                       # Stop + create entry
alibye status                     # Dashboard (default)
alibye continue                   # Restart last timer
alibye discard                    # Discard without saving
```

### Manual Entry
```bash
alibye log --start 09:00 --end 12:30 --desc "Client meeting" --project "Website"
alibye list --today               # Today's entries
alibye list --week                # This week
alibye list --from 2026-03-01 --to 2026-03-07
alibye edit <id> --desc "Updated"
alibye delete <id>
```

### Reports
```bash
alibye report                     # Summary by project (default: this week)
alibye report --today             # Today
alibye report --group client      # Group by client
alibye report --group day         # Group by day
alibye report --group tag         # Group by tag
alibye report --weekly            # Weekly timesheet grid
alibye report --format csv -o timesheet.csv
alibye report --format json -o report.json
```

### Projects + Clients
```bash
alibye project add "Project Name" --client "Client" --rate 100
alibye project list
alibye project archive "Old Project"

alibye client add "Client Name" --email client@co.com --rate 150
alibye client list
alibye client archive "Old Client"
```

### Tags + Backup
```bash
alibye tag list
alibye tag delete "old-tag"

alibye backup create --reason "Before migration"
alibye backup list
alibye backup restore <path>
```

## Time Rounding

alibye supports professional rounding modes:

| Mode | Interval | Example: 7 min tracked |
|------|----------|----------------------|
| `none` | — | 7.00 min |
| `up` | 15 min | 15 min |
| `down` | 15 min | 0 min |
| `nearest` | 6 min | 6 min (0.1 hr) |
| `nearest` | 15 min | 0 min |
| `up` | 30 min | 30 min |

Configure rounding in the Alibye constructor or programmatically.

## Rate Cascade

Rates resolve in priority order:
1. **Project rate** (if set)
2. **Client rate** (if set)
3. **Default rate** (config)
4. **$0** (not billable by default)

## Pomodoro Mode

```bash
alibye start "Deep work" --pomodoro
# Default: 25 min work / 5 min break
# Configurable via constructor
```

## All Commands Support

- `--json` — Machine-readable JSON output
- `-d, --dir <path>` — Custom data directory (default: `.alibye`)
- `ALIBYE_DIR` environment variable

## Integration with AI Agents

alibye is designed to be managed by AI agents like [OpenClaw](https://openclaw.ai):

```bash
# Agent starts your timer when you mention work
alibye start "Code review for PR #42" --project "SaaS" --tags "review,code" --json

# Agent stops when you're done
alibye stop --json

# Agent generates your weekly timesheet
alibye report --weekly --json

# Agent exports for invoicing with prophit
alibye report --format csv -o timesheet.csv
```

## The Trio

| Tool | Tracks | Purpose |
|------|--------|---------|
| **clawck** | AI agent time | How long did the AI work? |
| **alibye** | Human time | How long did *you* work? |
| **prophit** | Money | How much do they owe you? |

Together: your AI agent tracks its own time (clawck), tracks your time (alibye), and manages your invoices (prophit).

## License

MIT — CubiCrew / Vince Quarles
