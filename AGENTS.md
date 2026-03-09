# AGENTS.md — alibye Integration Guide

Drop this into your agent's workspace to enable human time tracking.

## Setup
```bash
npm install -g alibye
# Or use npx: npx alibye <command>
```

## Core Workflow

### When Human Starts Work
```bash
alibye start "Task description" --project "ProjectName" --json -d .alibye
```

### When Human Finishes
```bash
alibye stop --json -d .alibye
```

### When Human Mentions Past Work
```bash
alibye log --start "09:00" --end "12:30" --desc "Client meeting" --project "Name" --json -d .alibye
```

### Daily Check-in
```bash
alibye status --json -d .alibye
```

### Weekly Timesheet
```bash
alibye report --weekly --json -d .alibye
```

### Export for Invoicing
```bash
alibye report --format csv -o timesheet.csv -d .alibye
```

## Setup Clients + Projects (First Time)
```bash
alibye client add "Client Name" --rate 150 -d .alibye
alibye project add "Project Name" --client "Client Name" --rate 100 -d .alibye
```

## Tips
- Always use `--json` for programmatic parsing
- Always use `-d .alibye` for consistent data location
- Use `alibye continue` when human resumes the same task
- Use `--tags` to categorize (e.g., "meeting,client,planning")
- Breaks: `alibye log --start 12:00 --end 12:30 --break`
- The rate cascade (project > client > default) auto-calculates billable amounts

## The Trio
- **clawck**: Track YOUR (agent) time
- **alibye**: Track HUMAN time
- **prophit**: Manage invoices from both
