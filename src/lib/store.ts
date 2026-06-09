'use client'

import { create } from 'zustand'
import type { SprintState, Sprint, Block, Role, Task } from './types'
import { uid, parseMandays, workingDays, mondayOf, addDays, ymd, ROLES } from './helpers'
import { createClient } from './supabase/client'

interface StoreState extends SprintState {
  loading: boolean
  // mutations
  loadFromSupabase: () => Promise<void>
  updateTask: (id: string, patch: Partial<{ ticket: string; title: string }>) => void
  setRoleEffort: (taskId: string, role: Role, str: string) => void
  addTask: (opts: { ticket: string; title: string; md: Record<Role, string> }) => void
  deleteTask: (id: string) => void
  deleteBlock: (id: string) => void
  moveBlock: (id: string, start: number) => void
  updateSprint: (patch: Partial<Sprint>) => void
  clearAll: () => void
}

/* ---- empty sprint for first-run ---- */
function freshSprint(): Sprint {
  const start = mondayOf(new Date())
  const end   = addDays(start, 11)
  return { id: uid('s'), name: 'Sprint 1', start: ymd(start), end: ymd(end) }
}

function initialState(): SprintState {
  return { sprint: freshSprint(), tasks: {}, blocks: [] }
}

/* ---- helpers ---- */
function laneEnd(blocks: Block[], role: Role) {
  return blocks.filter((b) => b.role === role).reduce((m, b) => Math.max(m, b.start + b.mandays), 0)
}

/* ---- Supabase client ---- */
function db() {
  try { return createClient() } catch { return null }
}

/* ---- sync helpers (fire-and-forget) ---- */
async function dbUpsertSprint(sprint: Sprint) {
  const supabase = db(); if (!supabase) return
  await supabase.from('sprints').upsert({ id: sprint.id, name: sprint.name, start_date: sprint.start, end_date: sprint.end })
}
async function dbUpsertTask(task: Task, sprintId: string) {
  const supabase = db(); if (!supabase) return
  await supabase.from('tasks').upsert({ id: task.id, sprint_id: sprintId, ticket: task.ticket, title: task.title })
}
async function dbDeleteTask(id: string) {
  const supabase = db(); if (!supabase) return
  await supabase.from('tasks').delete().eq('id', id)
}
async function dbReplaceBlocks(taskId: string, role: Role, blocks: Block[]) {
  const supabase = db(); if (!supabase) return
  await supabase.from('blocks').delete().eq('task_id', taskId).eq('role', role)
  const rows = blocks
    .filter((b) => b.taskId === taskId && b.role === role)
    .map((b) => ({ id: b.id, task_id: b.taskId, role: b.role, mandays: b.mandays, start_day: b.start }))
  if (rows.length) await supabase.from('blocks').insert(rows)
}

/* ---- store ---- */
export const useSprintStore = create<StoreState>()((set, get) => ({
  ...initialState(),
  loading: true,

  async loadFromSupabase() {
    const supabase = db()
    if (!supabase) { set({ loading: false }); return }

    // fetch the most recent sprint
    const { data: sprintRows } = await supabase
      .from('sprints')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(1)

    let sprint: Sprint
    if (sprintRows && sprintRows.length > 0) {
      const row = sprintRows[0]
      sprint = { id: row.id, name: row.name, start: row.start_date, end: row.end_date }
    } else {
      // first run — create a sprint in Supabase
      sprint = freshSprint()
      await supabase.from('sprints').insert({ id: sprint.id, name: sprint.name, start_date: sprint.start, end_date: sprint.end })
    }

    // fetch tasks for this sprint
    const { data: taskRows } = await supabase
      .from('tasks')
      .select('*')
      .eq('sprint_id', sprint.id)

    const tasks: Record<string, Task> = {}
    const taskIds: string[] = []
    if (taskRows) {
      for (const row of taskRows) {
        tasks[row.id] = { id: row.id, ticket: row.ticket, title: row.title }
        taskIds.push(row.id)
      }
    }

    // fetch blocks for all tasks
    const blocks: Block[] = []
    if (taskIds.length > 0) {
      const { data: blockRows } = await supabase
        .from('blocks')
        .select('*')
        .in('task_id', taskIds)

      if (blockRows) {
        for (const row of blockRows) {
          blocks.push({
            id: row.id,
            taskId: row.task_id,
            role: row.role as Role,
            mandays: Number(row.mandays),
            start: Number(row.start_day),
          })
        }
      }
    }

    set({ sprint, tasks, blocks, loading: false })
  },

  updateTask(id, patch) {
    set((s) => ({ tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...patch } } }))
    dbUpsertTask({ ...get().tasks[id], ...patch }, get().sprint.id)
  },

  setRoleEffort(taskId, role, str) {
    set((s) => {
      const dayCount = Math.max(workingDays(s.sprint.start, s.sprint.end).length, 1)
      const vals = parseMandays(str)
      const existing = s.blocks.filter((b) => b.taskId === taskId && b.role === role).sort((a, b) => a.start - b.start)
      const base = existing.length ? existing[0].start : laneEnd(s.blocks, role)
      const rest = s.blocks.filter((b) => !(b.taskId === taskId && b.role === role))
      let cur = base
      const created = vals.map((m) => {
        const start = Math.max(0, Math.min(cur, Math.max(0, dayCount - m)))
        const blk: Block = { id: uid('b'), taskId, role, mandays: m, start }
        cur = start + m
        return blk
      })
      const next = [...rest, ...created]
      dbReplaceBlocks(taskId, role, next)
      return { blocks: next }
    })
  },

  addTask({ ticket, title, md }) {
    set((s) => {
      const dayCount = Math.max(workingDays(s.sprint.start, s.sprint.end).length, 1)
      const id = uid('t')
      const cursor: Record<string, number> = {}
      ROLES.forEach((r) => { cursor[r.key] = laneEnd(s.blocks, r.key) })
      const newBlocks: Block[] = []
      ROLES.forEach((r) => {
        parseMandays(md[r.key]).forEach((m) => {
          const start = Math.max(0, Math.min(cursor[r.key], Math.max(0, dayCount - m)))
          newBlocks.push({ id: uid('b'), taskId: id, role: r.key, mandays: m, start })
          cursor[r.key] = start + m
        })
      })
      const task: Task = { id, ticket, title }
      const sprintId = s.sprint.id
      dbUpsertTask(task, sprintId)
      const supabase = db()
      if (supabase) {
        for (const b of newBlocks) {
          supabase.from('blocks').insert({ id: b.id, task_id: b.taskId, role: b.role, mandays: b.mandays, start_day: b.start })
        }
      }
      return { tasks: { ...s.tasks, [id]: task }, blocks: [...s.blocks, ...newBlocks] }
    })
  },

  deleteTask(id) {
    set((s) => {
      const tasks = { ...s.tasks }
      delete tasks[id]
      dbDeleteTask(id)
      return { tasks, blocks: s.blocks.filter((b) => b.taskId !== id) }
    })
  },

  deleteBlock(id) {
    set((s) => ({ blocks: s.blocks.filter((b) => b.id !== id) }))
  },

  moveBlock(id, start) {
    set((s) => ({ blocks: s.blocks.map((b) => b.id === id ? { ...b, start } : b) }))
    const supabase = db()
    if (supabase) supabase.from('blocks').update({ start_day: start }).eq('id', id)
  },

  updateSprint(patch) {
    set((s) => {
      const sprint = { ...s.sprint, ...patch }
      dbUpsertSprint(sprint)
      return { sprint }
    })
  },

  clearAll() {
    set((s) => {
      // delete all tasks from Supabase (blocks cascade)
      const supabase = db()
      if (supabase) {
        for (const id of Object.keys(s.tasks)) {
          supabase.from('tasks').delete().eq('id', id)
        }
      }
      return { tasks: {}, blocks: [] }
    })
  },
}))
