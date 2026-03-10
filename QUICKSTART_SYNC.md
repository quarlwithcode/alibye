# Human-Agent Pairing Guide

How to set up alibye for human-AI collaborative time tracking.

## Setup

```bash
# Install alibye globally
npm install -g alibye

# Set a consistent data directory
export ALIBYE_DIR=.alibye

# Configure defaults
alibye config set default_rate 100
alibye config set weekly_quota_hours 40
alibye config set daily_quota_hours 8
alibye config set rounding_mode nearest
alibye config set rounding_interval 15
```

## Verification

Test the integration:

```bash
alibye client add "Test Client" --rate 100
alibye project add "Test Project" --client "Test Client"
alibye start "Testing setup" --project "Test Project"
alibye stop
alibye status --json | head -1  # Should return valid JSON
alibye delete $(alibye list --today --json | node -e "process.stdin.on('data',d=>console.log(JSON.parse(d)[0].id))")
```

## First Session

1. **Human tells agent what they're working on**
   - Agent starts timer: `alibye start "description" -p "Project" -k "Task"`

2. **Human works, agent monitors**
   - Agent checks periodically: `alibye status --json`
   - If timer > 2 hours idle, agent asks about it

3. **Human finishes**
   - Agent stops timer: `alibye stop --json`
   - Agent checks budget: `alibye burn -p "Project" --json`
   - Agent reports results

## Progressive Trust Levels

### Level 1: Manual
Human runs all commands. Agent only reads status.
```bash
# Agent reads only
alibye status --json
alibye list --today --json
```

### Level 2: Assisted
Human approves, agent executes.
```
Human: "Start tracking my work on the API"
Agent: "Starting timer for API work on Project X?"
Human: "Yes"
Agent: alibye start "API work" -p "Project X"
```

### Level 3: Proactive
Agent starts/stops timers based on context. Human corrects when needed.
```
Agent: "I noticed you started working on the frontend. Timer started."
Agent: alibye start "Frontend development" -p "Website" -k "Build UI"
...
Agent: "You've been idle for 30 minutes. Should I stop the timer?"
```

### Level 4: Full Autonomy
Agent manages all time tracking. Human reviews weekly.
```
Agent: [auto-starts timer when human begins coding]
Agent: [auto-stops when human goes idle]
Agent: [logs retroactive entries from calendar/chat]
Agent: [generates weekly report every Friday]
Agent: [warns when budget is approaching limits]
```

## Agent Commands Reference

```bash
# Read operations (safe, always allowed)
alibye status --json -d .alibye
alibye list --today --json -d .alibye
alibye report --week --json -d .alibye
alibye burn -p "Project" --json -d .alibye
alibye config view --json -d .alibye

# Write operations (may need human approval)
alibye start "description" -p "Project" -k "Task" -d .alibye
alibye stop -d .alibye
alibye log --start HH:MM --end HH:MM --desc "text" -d .alibye
alibye edit <id> --desc "corrected" -d .alibye
```

## Correction Workflow

```
Human: "That last entry should be 2 hours, not 3"
Agent: alibye list --today --json  → finds the entry ID
Agent: alibye edit <id> --end 11:00  → adjusts end time
Agent: "Updated. The entry is now 2 hours at $150/hr = $300."
```
