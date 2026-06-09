'use client'

import { create } from 'zustand'
import type { SprintState, Sprint, Block, Role, Task } from './types'
import { uid, parseMandays, workingDays, mondayOf, addDays, parseYmd, ymd, ROLES, normalizeTicket, ticketUrl } from './helpers'
import { createClient } from './supabase/client'

interface StoreState extends SprintState {
  loading: boolean
  loaded: boolean
  // mutations
  loadFromSupabase: () => Promise<void>
  createSprint: () => void
  switchSprint: (id: string) => Promise<void>
  updateTask: (id: string, patch: Partial<{ ticket: string; title: string }>) => void
  setRoleEffort: (taskId: string, role: Role, str: string) => void
  addTask: (opts: { ticket: string; title: string; md: Record<Role, string> }) => void
  deleteTask: (id: string) => void
  deleteBlock: (id: string) => void
  moveBlock: (id: string, start: number) => void
  finishMoveBlock: (id: string, start: number) => void
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
  return { sprint: freshSprint(), sprints: [], tasks: {}, blocks: [] }
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
  await supabase.from('tasks').upsert({ id: task.id, sprint_id: sprintId, ticket: task.ticket, title: task.title, url: ticketUrl(task.ticket) })
}
async function dbDeleteTask(id: string) {
  const supabase = db(); if (!supabase) return
  await supabase.from('tasks').delete().eq('id', id)
}
async function dbDeleteBlock(id: string) {
  const supabase = db(); if (!supabase) return
  await supabase.from('blocks').delete().eq('id', id)
}
async function dbClearAllTasks(ids: string[]) {
  const supabase = db(); if (!supabase) return
  for (const id of ids) await supabase.from('tasks').delete().eq('id', id)
}
async function dbUpsertBlock(block: Block) {
  const supabase = db(); if (!supabase) return
  await supabase.from('blocks').upsert({
    id: block.id, task_id: block.taskId, role: block.role,
    mandays: block.mandays, start_day: block.start,
  })
}
async function dbUpdateBlockStart(id: string, start: number) {
  const supabase = db(); if (!supabase) return
  await supabase.from('blocks').update({ start_day: start }).eq('id', id)
}
async function dbReplaceBlocks(taskId: string, role: Role, blocks: Block[]) {
  const supabase = db(); if (!supabase) return
  await supabase.from('blocks').delete().eq('task_id', taskId).eq('role', role)
  const rows = blocks
    .filter((b) => b.taskId === taskId && b.role === role)
    .map((b) => ({ id: b.id, task_id: b.taskId, role: b.role, mandays: b.mandays, start_day: b.start }))
  if (rows.length) await supabase.from('blocks').insert(rows)
}

/* ---- shared fetch for a sprint's tasks+blocks ---- */
async function fetchSprintData(sprintId: string): Promise<{ tasks: Record<string, Task>; blocks: Block[] }> {
  const supabase = db()
  if (!supabase) return { tasks: {}, blocks: [] }

  const { data: taskRows } = await supabase.from('tasks').select('*').eq('sprint_id', sprintId)
  const tasks: Record<string, Task> = {}
  const taskIds: string[] = []
  if (taskRows) {
    for (const row of taskRows) {
      tasks[row.id] = { id: row.id, ticket: row.ticket, title: row.title }
      taskIds.push(row.id)
    }
  }

  const blocks: Block[] = []
  if (taskIds.length > 0) {
    const { data: blockRows } = await supabase.from('blocks').select('*').in('task_id', taskIds)
    if (blockRows) {
      for (const row of blockRows) {
        blocks.push({
          id: row.id, taskId: row.task_id, role: row.role as Role,
          mandays: Number(row.mandays), start: Number(row.start_day),
        })
      }
    }
  }

  return { tasks, blocks }
}

/* ---- store ---- */
export const useSprintStore = create<StoreState>()((set, get) => ({
  ...initialState(),
  loading: true,
  loaded: false,

  async loadFromSupabase() {
    if (get().loaded) return  // already initialized — skip to avoid clobbering in-memory state on page navigation
    const supabase = db()
    if (!supabase) { set({ loading: false, loaded: true }); return }

    // fetch all sprints ordered oldest-first
    const { data: sprintRows } = await supabase
      .from('sprints')
      .select('*')
      .order('created_at', { ascending: true })

    let sprints: Sprint[]
    let sprint: Sprint

    if (sprintRows && sprintRows.length > 0) {
      sprints = sprintRows.map((r) => ({ id: r.id, name: r.name, start: r.start_date, end: r.end_date }))
      const savedId = typeof window !== 'undefined' ? localStorage.getItem('rc_sprint_id') : null
      const saved = savedId ? sprints.find((s) => s.id === savedId) : null
      sprint = saved ?? sprints[sprints.length - 1]
    } else {
      sprint = freshSprint()
      await supabase.from('sprints').insert({ id: sprint.id, name: sprint.name, start_date: sprint.start, end_date: sprint.end })
      sprints = [sprint]
    }

    const { tasks, blocks } = await fetchSprintData(sprint.id)
    set({ sprint, sprints, tasks, blocks, loading: false, loaded: true })
  },

  createSprint() {
    const { sprints, sprint: current } = get()
    const nextNum = sprints.length + 1
    const lastEnd = parseYmd(current.end)
    const start = mondayOf(addDays(lastEnd, 3))
    const end = addDays(start, 11)
    const sprint: Sprint = { id: uid('s'), name: `Sprint ${nextNum}`, start: ymd(start), end: ymd(end) }
    dbUpsertSprint(sprint)
    if (typeof window !== 'undefined') localStorage.setItem('rc_sprint_id', sprint.id)
    set((s) => ({ sprint, sprints: [...s.sprints, sprint], tasks: {}, blocks: [] }))
  },

  async switchSprint(id) {
    const sprint = get().sprints.find((s) => s.id === id)
    if (!sprint) return
    set({ loading: true })
    const { tasks, blocks } = await fetchSprintData(id)
    if (typeof window !== 'undefined') localStorage.setItem('rc_sprint_id', id)
    set({ sprint, tasks, blocks, loading: false })
  },

  updateTask(id, patch) {
    const applied = patch.ticket ? { ...patch, ticket: normalizeTicket(patch.ticket) || patch.ticket } : patch
    set((s) => ({ tasks: { ...s.tasks, [id]: { ...s.tasks[id], ...applied } } }))
    dbUpsertTask({ ...get().tasks[id], ...applied }, get().sprint.id)
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
    const s = get()
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
    const task: Task = { id, ticket: normalizeTicket(ticket) || ticket, title }
    const sprintId = s.sprint.id
    set((prev) => ({ tasks: { ...prev.tasks, [id]: task }, blocks: [...prev.blocks, ...newBlocks] }))
    // task must exist in DB before blocks (FK constraint) — await in sequence
    ;(async () => {
      await dbUpsertTask(task, sprintId)
      await Promise.all(newBlocks.map(dbUpsertBlock))
    })()
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
    dbDeleteBlock(id)
  },

  moveBlock(id, start) {
    set((s) => ({ blocks: s.blocks.map((b) => b.id === id ? { ...b, start } : b) }))
  },

  finishMoveBlock(id, start) {
    dbUpdateBlockStart(id, start)
  },

  updateSprint(patch) {
    set((s) => {
      const sprint = { ...s.sprint, ...patch }
      dbUpsertSprint(sprint)
      return {
        sprint,
        sprints: s.sprints.map((sp) => sp.id === sprint.id ? sprint : sp),
      }
    })
  },

  clearAll() {
    set((s) => {
      dbClearAllTasks(Object.keys(s.tasks))
      return { tasks: {}, blocks: [] }
    })
  },
}))
