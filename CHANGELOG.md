# Changelog

## [0.1.1] — 2026-03-10

### Added
- **Tasks**: CRUD with project/client auto-resolution, budgets, archive, summary
- **Work Types**: CRUD with unique name, rate, delete
- **6-Level Rate Cascade**: entry override > task > work type > project > client > default
- **Budget Tracking**: Hours and amount budgets on projects, clients, tasks with status colors (green/yellow/red/over)
- **Quota Tracking**: Daily and weekly hour targets with pace projection
- **Burn Reports**: `alibye burn` with progress bars and projections
- **Config Persistence**: `config.json` with `alibye config set/get/view/reset`
- **Enhanced Timer**: `--task/-k`, `--worktype/-w`, `--rate` flags on start
- **Enhanced Log**: `--task/-k`, `--worktype/-w`, `--rate`, `--date`, `--yesterday` flags
- **Enhanced Edit**: `--task`, `--worktype`, `--tags`, `--rate`, `--billable/--no-billable`, `--date` flags
- **Enhanced List**: `--month`, `--last-month`, `--group` (project/client/task/day)
- **Enhanced Report**: `--month`, `--last-month`, `--group task`, `--group worktype`
- **Project Edit**: `alibye project edit` with name, rate, client, billable, color, budget fields
- **Client Edit**: `alibye client edit` with name, email, rate, budget fields
- **Entity Summaries**: `alibye project/client/task summary` with budget status
- **Dashboard Enhancements**: Task name in timer, quota progress bars, budget warnings
- **CSV Export**: Now includes Task and WorkType columns
- `GETTING_STARTED.md` — Human walkthrough guide
- `QUICKSTART_SYNC.md` — Human-agent pairing guide

### Changed
- Schema v1 → v2 migration (all backward compatible, nullable columns)
- `entry_rate_override` field stores explicit `--rate` values separately from resolved rate
- `continueLast` carries task_id and work_type_id
- Updated `AGENTS.md`, `SKILL.md`, `README.md` for new features

## [0.1.0] — 2026-03-09

### Added
- Initial release: POC (proof of concept)
- Start/stop timer with project, client, tags, billable tracking
- Manual time entry logging
- Project, client, and tag management
- Time rounding engine (none, up, down, nearest — 1/5/6/10/15/30 min intervals)
- Billable rate cascade (entry > project > client > default)
- Summary, detailed, and weekly timesheet reports
- Pomodoro mode (configurable work/break intervals)
- Idle detection flagging
- Break tracking with work-to-break ratio
- Database backup system (VACUUM INTO, auto-prune, manifest)
- Continue last timer feature
- CSV, JSON export
- AGENTS.md integration guide for AI-managed time tracking
