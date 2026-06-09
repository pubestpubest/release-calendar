import type { RoleMeta, Role, Sprint, Task, Block } from './types'

export const ROLES: RoleMeta[] = [
  { key: 'FE', label: 'Frontend', short: 'FE', hex: '#FF3E9A', hexDeep: '#E61E80', tint: '#FFD9EB' },
  { key: 'BE', label: 'Backend',  short: 'BE', hex: '#2E6BFF', hexDeep: '#1B50D6', tint: '#D6E2FF' },
  { key: 'MO', label: 'Mobile',   short: 'MO', hex: '#8A5BFF', hexDeep: '#6B38E6', tint: '#E5DBFF' },
]
export const ROLE_BY_KEY = Object.fromEntries(ROLES.map((r) => [r.key, r])) as Record<Role, RoleMeta>

export const SNAP       = 0.25
export const ROW_H      = 44
export const ROW_GAP    = 8
export const LANE_PAD   = 14
export const ROW_HEADER_W = 138
export const DAY_W      = { compact: 80, comfy: 104, roomy: 132 } as const
export const DOW = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat']
export const MON = ['Jan', 'Feb', 'Mar', 'Apr', 'May', 'Jun', 'Jul', 'Aug', 'Sep', 'Oct', 'Nov', 'Dec']

/* ---------- date utilities ---------- */
export function ymd(date: Date): string {
  const y = date.getFullYear()
  const m = String(date.getMonth() + 1).padStart(2, '0')
  const d = String(date.getDate()).padStart(2, '0')
  return `${y}-${m}-${d}`
}
export function parseYmd(s: string): Date {
  const [y, m, d] = s.split('-').map(Number)
  return new Date(y, m - 1, d)
}
export function mondayOf(date: Date): Date {
  const d = new Date(date)
  const day = d.getDay()
  const diff = (day === 0 ? -6 : 1) - day
  d.setDate(d.getDate() + diff)
  d.setHours(0, 0, 0, 0)
  return d
}
export function addDays(date: Date, n: number): Date {
  const d = new Date(date)
  d.setDate(d.getDate() + n)
  return d
}
export function isWeekend(date: Date): boolean {
  const g = date.getDay()
  return g === 0 || g === 6
}
export function workingDays(startYmd: string, endYmd: string): Date[] {
  const start = parseYmd(startYmd)
  const end   = parseYmd(endYmd)
  const out: Date[] = []
  let cur = new Date(start)
  let guard = 0
  while (cur <= end && guard < 400) {
    if (!isWeekend(cur)) out.push(new Date(cur))
    cur = addDays(cur, 1)
    guard++
  }
  return out
}
export function fmtRange(startYmd: string, endYmd: string): string {
  const s = parseYmd(startYmd), e = parseYmd(endYmd)
  const sameMonth = s.getMonth() === e.getMonth()
  const left  = `${MON[s.getMonth()]} ${s.getDate()}`
  const right = sameMonth ? `${e.getDate()}` : `${MON[e.getMonth()]} ${e.getDate()}`
  return `${left}–${right}`
}

/* ---------- manday parsing ---------- */
export function parseMandays(str: string | undefined | null): number[] {
  if (!str) return []
  return String(str)
    .split('+')
    .map((p) => parseFloat(p.trim()))
    .filter((n) => !isNaN(n) && n > 0)
    .map((n) => Math.round(n * 4) / 4)
}
export function fmtMd(n: number): string {
  return (Math.round(n * 100) / 100).toString()
}

/* ---------- id ---------- */
let _seq = 1
export function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${(_seq++).toString(36)}`
}

/* ---------- layout / packing ---------- */
export interface LayoutItem {
  block: Block
  subrow: number
  conflict: boolean
}
export interface LaneLayout {
  items: LayoutItem[]
  rows: number
  height: number
}
export interface Layout {
  byRole: Record<Role, LaneLayout>
  laneTops: Record<Role, number>
  totalHeight: number
}

export function computeLayout(blocks: Block[], _dayCount: number): Layout {
  const byRole = {} as Record<Role, LaneLayout>
  ROLES.forEach((r) => { byRole[r.key] = { items: [], rows: 1, height: 0 } })

  ROLES.forEach((role) => {
    const list = blocks
      .filter((b) => b.role === role.key)
      .sort((a, b) => a.start - b.start || a.mandays - b.mandays)
    const rowEnds: number[] = []
    list.forEach((b) => {
      let placed = -1
      for (let i = 0; i < rowEnds.length; i++) {
        if (b.start >= rowEnds[i] - 1e-6) { placed = i; break }
      }
      if (placed === -1) { placed = rowEnds.length; rowEnds.push(0) }
      rowEnds[placed] = b.start + b.mandays
      byRole[role.key].items.push({ block: b, subrow: placed, conflict: false })
    })
    byRole[role.key].rows = Math.max(1, rowEnds.length)
  })

  ROLES.forEach((role) => {
    const items = byRole[role.key].items
    items.forEach((it) => {
      it.conflict = items.some(
        (o) => o !== it &&
          it.block.start < o.block.start + o.block.mandays - 1e-6 &&
          o.block.start < it.block.start + it.block.mandays - 1e-6
      )
    })
  })

  const laneTops = {} as Record<Role, number>
  let y = 0
  ROLES.forEach((role) => {
    laneTops[role.key] = y
    const h = LANE_PAD * 2 + byRole[role.key].rows * ROW_H + (byRole[role.key].rows - 1) * ROW_GAP
    byRole[role.key].height = h
    y += h
  })
  return { byRole, laneTops, totalHeight: y }
}

/* ---------- per-role stats ---------- */
export interface RoleStat {
  total: number
  end: number
  over: boolean
  pastEnd: boolean
  count: number
}
export function roleStats(blocks: Block[], dayCount: number): Record<Role, RoleStat> {
  const out = {} as Record<Role, RoleStat>
  ROLES.forEach((role) => {
    const list = blocks.filter((b) => b.role === role.key)
    const total = list.reduce((s, b) => s + b.mandays, 0)
    const end   = list.reduce((m, b) => Math.max(m, b.start + b.mandays), 0)
    out[role.key] = {
      total: Math.round(total * 100) / 100,
      end:   Math.round(end   * 100) / 100,
      over:  total > dayCount + 1e-6,
      pastEnd: end > dayCount + 1e-6,
      count: list.length,
    }
  })
  return out
}

/* ---------- seed ---------- */
export function buildSeed() {
  const start = mondayOf(new Date(2026, 5, 8))
  const end   = addDays(start, 11)
  const sprint = { id: 's1', name: 'Sprint 24', start: ymd(start), end: ymd(end) }

  const defs = [
    { ticket: 'SM-2848', title: 'Change phone number',    FE: '0.5', BE: '0.5' },
    { ticket: 'SM-722',  title: 'Login session bug',       BE: '2' },
    { ticket: 'SM-3246', title: 'SCB idempotent',          BE: '1.5' },
    { ticket: 'POC',     title: 'SCB v2 spike',            BE: '0.5' },
    { ticket: 'SM-3064', title: 'Add phone number',        FE: '0.5', BE: '0.5', MO: '0.5' },
    { ticket: 'SM-3168', title: 'Community notification',  BE: '0.5+0.5' },
    { ticket: 'SM-3165', title: 'Charge ID filter',        BE: '0.75' },
    { ticket: 'SM-3239', title: 'Aptitude analytics',      FE: '1',   MO: '1' },
    { ticket: 'SM-3301', title: 'Profile redesign',        FE: '2',   MO: '1.5' },
    { ticket: 'SM-3290', title: 'Push token refresh',      BE: '0.5', MO: '1' },
  ] as const

  const tasks: Record<string, Task> = {}
  const blocks: Block[] = []
  const cursor: Record<string, number> = { FE: 0, BE: 0, MO: 0 }

  defs.forEach((d, i) => {
    const id = `t${i + 1}`
    tasks[id] = { id, ticket: d.ticket, title: d.title }
    ;(['FE', 'BE', 'MO'] as const).forEach((role) => {
      const str = (d as Record<string, string>)[role]
      parseMandays(str).forEach((md) => {
        blocks.push({ id: uid('b'), taskId: id, role, mandays: md, start: cursor[role] })
        cursor[role] += md
      })
    })
  })

  return { sprint, tasks, blocks } as { sprint: Sprint; tasks: Record<string, Task>; blocks: Block[] }
}
