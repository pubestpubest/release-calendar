# PRD: Sprint Timetable Planner

**Project**: release-calendar  
**Date**: 2026-06-08  
**Status**: Draft

---

## Problem Statement

Small dev teams with FE, BE, and Mobile roles plan sprint tasks in text form (Notion, spreadsheets, chat). This is painful to re-arrange and impossible to visualize:

- Cannot easily see parallel workloads per role
- Hard to spot dependency ordering (e.g. BE API must land before FE/Mobile can consume it)
- Rearranging priorities means manual recalculation of the whole timeline
- No shared, live view of who is working on what and when

---

## Goal

An internal web tool where each role pastes their sprint task list, the app builds a visual timetable, and anyone can drag tasks to re-order or shift them — with the calendar updating instantly.

---

## Users

| Role | What they do |
|------|-------------|
| FE dev | Pastes FE task list, views FE lane, adjusts order |
| BE dev | Pastes BE task list, views BE lane, flags dependency completion |
| Mobile dev | Pastes Mobile task list, views Mobile lane |
| Lead / PM | Reads the combined timetable, checks for gaps or bottlenecks |

All roles share one sprint board. No authentication needed for MVP.

---

## Core Concepts

### Manday
One manday = one working day of one person. The sprint has 10 working days (2 weeks).

### Task
A single work item for one role.

```
<ticket-id or label> <description> <mandays>
```

Examples:
```
SM-2848 Change phone number 0.5
SM-722 bug 2
SM-3246 SCB Idempotent 1.5
[POC] SCB V2 0.5
SM-3168 3125 Community notification 0.5+0.5
SM-3165 Charge ID Filter 0.75
```

Manday value may be:
- A decimal: `1.5`
- A compound sum: `0.5+0.5` (parsed as 1.0)
- A whole number: `2`

The task ID / label is everything before the last whitespace-separated number token.

### Lane
One horizontal row on the timetable per role: FE, BE, Mobile.

### Dependency
A task in one lane that must end before another lane's task can start. For the initial use case: BE tasks commonly block FE and Mobile tasks for the same ticket. Dependencies are optional and manually set.

---

## Features

### 1. Task Input

Each role has a text area where they paste tasks in the format above (one per line).

- Parse on paste / on blur
- Ignore blank lines and comment lines starting with `#`
- Show a preview list of parsed tasks with manday totals
- Warn if total mandays exceed 10 (sprint capacity)
- Allow inline editing of individual tasks after parse

### 2. Sprint Timetable (Calendar View)

A Gantt-style horizontal calendar:

- X-axis: working days 1–10 (Day 1 … Day 10), optionally showing real dates if a sprint start date is set
- Y-axis: three lanes — FE, BE, Mobile
- Each task is a colored bar spanning its manday duration, placed sequentially within its lane
- Tasks are packed left (start as early as possible by default)
- Color-coded by role; ticket ID and short name shown inside the bar (truncated)
- Tooltip on hover: full ticket name, mandays, start day, end day

#### Sprint Start Date (optional)
If set, Day 1 maps to a real calendar date (skipping weekends). Days are labeled Mon 9 Jun, Tue 10 Jun, etc.

### 3. Drag and Drop Reorder

Within a lane, tasks can be dragged left/right to reorder priority. The timetable recalculates immediately — tasks always pack left after reorder.

- Drag handle on task bar
- Visual drop preview while dragging
- Undo last reorder (Ctrl+Z / Cmd+Z)

### 4. Dependency Linking

User can draw a dependency from task A (in any lane) to task B (in another lane). This means B cannot start until A ends.

- Right-click a task → "Add dependency to…" then click target task
- Dependency shown as an arrow between bars
- Target task shifts right if needed; tasks after it in its lane shift accordingly
- Delete dependency from the same context menu

Use case: SM-3246 BE task must finish before SM-3246 FE task begins.

### 5. Task Management Page

A table view listing all tasks across all roles:

| # | Ticket | Description | Role | Mandays | Start Day | End Day | Dependencies |
|---|--------|-------------|------|---------|-----------|---------|--------------|

- Filter by role
- Sort by start day or manday size
- Edit ticket ID, description, mandays inline
- Delete a task
- Add a task manually (without re-pasting)

### 6. Sprint Settings

- Sprint name (e.g. "Sprint 42")
- Sprint start date (optional)
- Working days per sprint (default 10)
- Capacity override per role (e.g. BE only has 8 days due to leave)

---

## Data Model

```ts
type Role = 'FE' | 'BE' | 'Mobile'

interface Task {
  id: string            // uuid
  ticketId: string      // e.g. "SM-2848" or "[POC]"
  description: string
  mandays: number       // parsed, decimal
  role: Role
  order: number         // position within lane (0-indexed)
}

interface Dependency {
  fromTaskId: string    // predecessor
  toTaskId: string      // successor (cannot start until predecessor ends)
}

interface Sprint {
  id: string
  name: string
  startDate: string | null   // ISO date or null
  workingDays: number        // default 10
  capacityOverride: Partial<Record<Role, number>>
  tasks: Task[]
  dependencies: Dependency[]
}
```

Sprint data is persisted in `localStorage` for MVP (no backend).

---

## Pages / Routes

| Route | Purpose |
|-------|---------|
| `/` | Timetable view (calendar + input panel) |
| `/tasks` | Task management table |
| `/settings` | Sprint settings |

---

## UX Layout — Timetable View

```
┌──────────────────────────────────────────────────────────────┐
│  Sprint 42  [Sprint 42 ▾]          Start: 09 Jun 2026  [✎]  │
├──────────────────────────────────────────────────────────────┤
│  [FE Input ▾]  [BE Input ▾]  [Mobile Input ▾]               │
│                                                              │
│  Day   1    2    3    4    5    6    7    8    9   10        │
│  FE  [SM-2848──][SM-722────────────][SM-3246──]...          │
│  BE  [SM-722──────][SM-3246──────────]...                   │
│  MOB [SM-2848──][SM-3246────────]...                        │
│                                                              │
│  ← arrows showing dependencies                              │
└──────────────────────────────────────────────────────────────┘
```

Input panel: collapsible drawer per role. User pastes raw text, clicks "Apply". Drawer shows parsed task count and total mandays.

---

## Non-Goals (MVP)

- User accounts / auth
- Multi-sprint history (only one sprint at a time in MVP)
- Real-time collaboration (no websockets; single-user per browser)
- Time-of-day scheduling (mandays only, not hours)
- Automated dependency detection
- External Jira/Linear integration (ticket IDs are just labels)

---

## Tech Stack

This project is already a Next.js 16 + React 19 + Tailwind 4 + TypeScript app.

Recommended additions:
- `@dnd-kit/core` + `@dnd-kit/sortable` — drag and drop (lighter than react-beautiful-dnd, maintained)
- `zustand` — client state (tasks, sprint config)
- `date-fns` — date arithmetic for working day calculation
- No backend, no database for MVP — `localStorage` via zustand persist middleware

---

## Success Criteria

1. A user can paste a raw task list for their role and see tasks appear as bars on the timetable within 1 second.
2. Dragging a task to a new position updates all bar positions without page reload.
3. Adding a dependency visually shifts the blocked task to the correct start day.
4. Total manday count and per-role load are visible without manual calculation.
5. The timetable is readable on a 1280px laptop screen without horizontal scroll for a 10-day sprint.

---

## Open Questions

1. Should tasks within a lane be allowed to overlap (parallel work by same role)? — **Tentative: no, sequential only per lane for MVP**
2. Should compound mandays like `0.5+0.5` (same ticket, two chunks) be split into two bars or one? — **Tentative: one bar, sum as total**
3. Do we need a "half-day" visual grid, or is per-day granularity sufficient? — **Tentative: per-day grid, half-day tasks show as half-width bars**
4. Export to image / PDF for sharing in Slack? — **Post-MVP**
