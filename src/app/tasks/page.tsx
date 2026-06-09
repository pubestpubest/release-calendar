'use client'

import { useState, useEffect, useRef } from 'react'
import Link from 'next/link'
import Icon from '@/components/Icon'
import { useSprintStore } from '@/lib/store'
import { ROLES, parseMandays, fmtMd, workingDays } from '@/lib/helpers'
import type { Role } from '@/lib/types'

/* ---- helpers ---- */
function roleStr(blocks: { taskId: string; role: string; mandays: number; start: number }[], taskId: string, role: Role) {
  return blocks
    .filter((b) => b.taskId === taskId && b.role === role)
    .sort((a, b) => a.start - b.start)
    .map((b) => fmtMd(b.mandays))
    .join('+')
}
function roleTotal(blocks: { taskId: string; role: string; mandays: number }[], taskId: string, role: Role) {
  return blocks.filter((b) => b.taskId === taskId && b.role === role).reduce((s, b) => s + b.mandays, 0)
}

/* ---- RoleField ---- */
function RoleField({
  role, value, tint, hex, onCommit,
}: {
  role: string; value: string; tint: string; hex: string; onCommit: (v: string) => void
}) {
  const [v, setV] = useState(value)
  const ref = useRef<HTMLInputElement>(null)
  useEffect(() => { setV(value) }, [value])
  const commit = () => { if (v !== value) onCommit(v) }
  return (
    <input
      ref={ref}
      value={v}
      onChange={(e) => setV(e.target.value)}
      onBlur={() => { commit(); if (ref.current) { ref.current.style.borderColor = 'var(--ink)'; ref.current.style.background = value ? tint : '#fff' } }}
      onFocus={() => { if (ref.current) { ref.current.style.borderColor = hex; ref.current.style.background = '#fff' } }}
      onKeyDown={(e) => { if (e.key === 'Enter') e.currentTarget.blur() }}
      placeholder="–"
      inputMode="decimal"
      aria-label={`${role} mandays`}
      style={{
        width: '100%', textAlign: 'center',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
        color: value ? 'var(--ink)' : 'var(--ink-faint)',
        border: '2.5px solid var(--ink)', borderRadius: 10,
        boxShadow: '2px 2px 0 var(--ink)',
        padding: '8px 4px', background: value ? tint : '#fff', outline: 'none',
        transition: 'border-color 120ms, background 120ms',
      }}
    />
  )
}

/* ---- EditText ---- */
function EditText({
  value, onChange, placeholder, bold, color, size,
}: {
  value: string; onChange: (v: string) => void; placeholder: string
  bold?: boolean; color?: string; size?: number
}) {
  const ref = useRef<HTMLInputElement>(null)
  return (
    <input
      ref={ref}
      value={value}
      onChange={(e) => onChange(e.target.value)}
      placeholder={placeholder}
      style={{
        width: '100%', border: '2px solid transparent', borderRadius: 8,
        background: 'transparent',
        fontFamily: bold ? 'var(--font-display)' : 'var(--font-body)',
        fontWeight: 700, fontSize: size ?? 15,
        color: color ?? 'var(--ink)', padding: '6px 8px', outline: 'none',
        transition: 'border-color 120ms, background 120ms',
      }}
      onFocus={() => { if (ref.current) { ref.current.style.borderColor = 'var(--blue)'; ref.current.style.background = '#fff' } }}
      onBlur={() => { if (ref.current) { ref.current.style.borderColor = 'transparent'; ref.current.style.background = 'transparent' } }}
    />
  )
}

/* ---- Header row ---- */
const GRID = '128px minmax(0,1fr) 78px 78px 78px 70px 40px'

function HeaderRow() {
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: GRID, gap: 10,
      padding: '12px 16px', background: 'var(--ink)',
      position: 'sticky', top: 0, zIndex: 3,
      borderBottom: '3px solid var(--ink)',
    }}>
      {(['Ticket', 'Task'] as const).map((label) => (
        <div key={label} style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#fff', display: 'flex', alignItems: 'center' }}>{label}</div>
      ))}
      {ROLES.map((r) => (
        <div key={r.key} style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 5 }}>
          <span style={{ width: 9, height: 9, borderRadius: 3, background: r.hex, border: '1.5px solid #fff' }} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#fff' }}>{r.short}</span>
        </div>
      ))}
      <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: '#fff', textAlign: 'center' }}>Total</div>
      <div />
    </div>
  )
}

/* ---- Task row ---- */
function TaskRow({
  task, blocks, onTicket, onTitle, onRole, onDelete,
}: {
  task: { id: string; ticket: string; title: string }
  blocks: { taskId: string; role: string; mandays: number; start: number }[]
  onTicket: (v: string) => void
  onTitle: (v: string) => void
  onRole: (role: Role, v: string) => void
  onDelete: () => void
}) {
  const total = ROLES.reduce((s, r) => s + roleTotal(blocks, task.id, r.key), 0)
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center',
      padding: '8px 16px', borderBottom: '2px solid rgba(33,27,59,0.12)', background: '#fff',
      transition: 'background 120ms',
    }}
      onMouseEnter={(e) => { (e.currentTarget as HTMLDivElement).style.background = 'var(--cream)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.background = '#fff' }}
    >
      <EditText value={task.ticket} onChange={onTicket} placeholder="SM-…" bold color="var(--blue)" size={14} />
      <EditText value={task.title}  onChange={onTitle}  placeholder="Task title…" />
      {ROLES.map((r) => (
        <RoleField
          key={r.key} role={r.label}
          value={roleStr(blocks, task.id, r.key)}
          tint={r.tint} hex={r.hex}
          onCommit={(v) => onRole(r.key, v)}
        />
      ))}
      <div style={{ textAlign: 'center' }}>
        {total > 0 ? (
          <span style={{
            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--ink)',
            background: 'var(--yellow)', border: '2px solid var(--ink)', borderRadius: 999,
            padding: '2px 9px', boxShadow: '2px 2px 0 var(--ink)',
          }}>{fmtMd(total)}</span>
        ) : (
          <span style={{ color: 'var(--ink-faint)', fontFamily: 'var(--font-display)', fontSize: 14 }}>—</span>
        )}
      </div>
      <button
        onClick={onDelete}
        aria-label="Delete task"
        style={{
          width: 32, height: 32, borderRadius: 9, border: '2.5px solid var(--ink)',
          background: '#fff', color: 'var(--tomato)', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '2px 2px 0 var(--ink)', transition: 'transform var(--dur-fast), box-shadow var(--dur-fast)',
        }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = 'translate(-1px,-1px)'; el.style.boxShadow = '3px 3px 0 var(--ink)' }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = ''; el.style.boxShadow = '2px 2px 0 var(--ink)' }}
      >
        <Icon name="trash" size={15} strokeWidth={2.6} />
      </button>
    </div>
  )
}

/* ---- Add row ---- */
function AddRow({ onAdd }: { onAdd: (opts: { ticket: string; title: string; md: Record<Role, string> }) => void }) {
  const [ticket, setTicket] = useState('')
  const [title,  setTitle]  = useState('')
  const [md, setMd] = useState<Record<Role, string>>({ FE: '', BE: '', MO: '' })

  const submit = () => {
    const hasMd = (['FE', 'BE', 'MO'] as Role[]).some((r) => parseMandays(md[r]).length > 0)
    if ((!title.trim() && !ticket.trim()) || !hasMd) return
    onAdd({ ticket: ticket.trim() || '—', title: title.trim() || 'Untitled', md })
    setTicket(''); setTitle(''); setMd({ FE: '', BE: '', MO: '' })
  }

  const inputBase: React.CSSProperties = {
    width: '100%', border: '2.5px solid var(--ink)', borderRadius: 9, outline: 'none',
    padding: '8px 9px', boxShadow: '2px 2px 0 var(--ink)', background: '#fff',
  }
  return (
    <div style={{
      display: 'grid', gridTemplateColumns: GRID, gap: 10, alignItems: 'center',
      padding: '12px 16px', background: 'var(--cream)', borderTop: '3px dashed var(--ink)',
    }}>
      <input
        value={ticket} onChange={(e) => setTicket(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="SM-…"
        style={{ ...inputBase, fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: 'var(--blue)' }}
      />
      <input
        value={title} onChange={(e) => setTitle(e.target.value)}
        onKeyDown={(e) => e.key === 'Enter' && submit()}
        placeholder="New task title…"
        style={{ ...inputBase, fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}
      />
      {ROLES.map((r) => (
        <RoleField
          key={r.key} role={r.label}
          value={md[r.key]} tint={r.tint} hex={r.hex}
          onCommit={(v) => setMd((m) => ({ ...m, [r.key]: v }))}
        />
      ))}
      <div />
      <button
        onClick={submit}
        aria-label="Add task"
        style={{
          width: 32, height: 32, borderRadius: 9, border: '2.5px solid var(--ink)',
          background: 'var(--pink)', color: '#fff', cursor: 'pointer',
          display: 'flex', alignItems: 'center', justifyContent: 'center',
          boxShadow: '2px 2px 0 var(--ink)', transition: 'transform var(--dur-fast), box-shadow var(--dur-fast)',
        }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = 'translate(-1px,-1px)'; el.style.boxShadow = '3px 3px 0 var(--ink)' }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = ''; el.style.boxShadow = '2px 2px 0 var(--ink)' }}
      >
        <Icon name="plus" size={17} strokeWidth={3} />
      </button>
    </div>
  )
}

/* ---- Summary chip ---- */
function SummaryChip({ icon, label, value, color }: { icon: React.ReactNode; label: string; value: string | number; color?: string }) {
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 9,
      background: '#fff', border: '3px solid var(--ink)', borderRadius: 14,
      padding: '9px 15px', boxShadow: '3px 3px 0 var(--ink)',
    }}>
      {icon}
      <div style={{ lineHeight: 1.05 }}>
        <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 19, color: color ?? 'var(--ink)', whiteSpace: 'nowrap' }}>{value}</div>
        <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: 0.5, whiteSpace: 'nowrap' }}>{label}</div>
      </div>
    </div>
  )
}

/* ---- Role filter tabs ---- */
function RoleTabs({
  items, value, onChange,
}: {
  items: { value: string; label: string; count: number }[]
  value: string
  onChange: (v: string) => void
}) {
  return (
    <div style={{ display: 'flex', gap: 4, background: '#fff', border: '2.5px solid var(--ink)', borderRadius: 12, padding: 4, boxShadow: '2px 2px 0 var(--ink)' }}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <button
            key={item.value}
            onClick={() => onChange(item.value)}
            style={{
              border: active ? '2px solid var(--ink)' : '2px solid transparent',
              borderRadius: 8, background: active ? 'var(--yellow)' : 'transparent',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
              color: 'var(--ink)', cursor: 'pointer', padding: '5px 11px',
              display: 'flex', alignItems: 'center', gap: 5,
              boxShadow: active ? '2px 2px 0 var(--ink)' : 'none',
              transition: 'all 120ms',
              whiteSpace: 'nowrap',
            }}
          >
            {item.label}
            <span style={{
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11,
              background: active ? 'var(--ink)' : 'rgba(33,27,59,0.12)',
              color: active ? '#fff' : 'var(--ink-soft)',
              borderRadius: 999, padding: '1px 6px',
            }}>{item.count}</span>
          </button>
        )
      })}
    </div>
  )
}

/* ---- Sort select ---- */
function SortSelect({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      style={{
        border: '2.5px solid var(--ink)', borderRadius: 12, padding: '9px 14px',
        fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
        color: 'var(--ink)', background: '#fff', cursor: 'pointer',
        boxShadow: '2px 2px 0 var(--ink)', outline: 'none',
        appearance: 'none', paddingRight: 32,
        backgroundImage: `url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='12' height='8' viewBox='0 0 12 8'%3E%3Cpath d='M1 1l5 5 5-5' stroke='%23211B3B' stroke-width='2' fill='none' stroke-linecap='round'/%3E%3C/svg%3E")`,
        backgroundRepeat: 'no-repeat',
        backgroundPosition: 'right 10px center',
      }}
    >
      <option value="order">Sort: board order</option>
      <option value="ticket">Sort: ticket A–Z</option>
      <option value="effort">Sort: most effort</option>
      <option value="recent">Sort: recently added</option>
    </select>
  )
}

/* ---- Main page ---- */
export default function TasksPage() {
  const store = useSprintStore()
  const { loading, loadFromSupabase } = store
  const [query,      setQuery]      = useState('')
  const [roleFilter, setRoleFilter] = useState('all')
  const [sort,       setSort]       = useState('order')

  useEffect(() => { loadFromSupabase() }, []) // eslint-disable-line react-hooks/exhaustive-deps

  if (loading) {
    return (
      <div style={{ minHeight: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-faint)' }}>Loading…</div>
      </div>
    )
  }

  const { sprint, tasks, blocks, updateTask, setRoleEffort, addTask, deleteTask } = store

  /* ---- derive list ---- */
  let ids = Object.keys(tasks)
  const q = query.trim().toLowerCase()
  if (q) ids = ids.filter((id) => (tasks[id].ticket + ' ' + tasks[id].title).toLowerCase().includes(q))
  if (roleFilter !== 'all') ids = ids.filter((id) => roleTotal(blocks, id, roleFilter as Role) > 0)

  const totalOf = (id: string) => blocks.filter((b) => b.taskId === id).reduce((s, b) => s + b.mandays, 0)
  if (sort === 'ticket') ids = [...ids].sort((a, b) => tasks[a].ticket.localeCompare(tasks[b].ticket))
  else if (sort === 'effort') ids = [...ids].sort((a, b) => totalOf(b) - totalOf(a))
  else if (sort === 'recent') ids = [...ids].reverse()

  const grand = blocks.reduce((s, b) => s + b.mandays, 0)
  const perRole: Record<string, number> = {}
  ROLES.forEach((r) => { perRole[r.key] = blocks.filter((b) => b.role === r.key).reduce((s, b) => s + b.mandays, 0) })

  const filterItems = [
    { value: 'all', label: 'All roles', count: Object.keys(tasks).length },
    ...ROLES.map((r) => ({
      value: r.key,
      label: r.label,
      count: Object.keys(tasks).filter((id) => roleTotal(blocks, id, r.key) > 0).length,
    })),
  ]

  return (
    <div style={{ minHeight: '100vh', display: 'flex', flexDirection: 'column' }}>
      {/* header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 16, padding: '14px 26px',
        background: 'var(--cream)', borderBottom: '4px solid var(--ink)',
        flexWrap: 'wrap', position: 'sticky', top: 0, zIndex: 10,
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: '0 0 auto' }}>
          <svg width="36" height="36" viewBox="0 0 38 38" style={{ display: 'block', transform: 'rotate(-4deg)' }}>
            <rect x="3" y="3" width="32" height="32" rx="9" fill="var(--grape)" stroke="var(--ink)" strokeWidth="3" />
            <path d="M11 19l5 5 11-11" stroke="#fff" strokeWidth="3.4" strokeLinecap="round" strokeLinejoin="round" fill="none" />
          </svg>
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--ink)', lineHeight: 1, whiteSpace: 'nowrap' }}>Task list</div>
            <div style={{ fontFamily: 'var(--font-hand)', fontSize: 16, color: 'var(--grape)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>everything in {sprint.name}, tidy</div>
          </div>
        </div>
        <Link
          href="/"
          style={{
            marginLeft: 'auto', textDecoration: 'none',
            display: 'inline-flex', alignItems: 'center', gap: 8,
            background: 'var(--blue)', color: '#fff',
            border: '3px solid var(--ink)', borderRadius: 12,
            padding: '9px 16px',
            fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
            boxShadow: '3px 3px 0 var(--ink)', whiteSpace: 'nowrap',
            transition: 'transform var(--dur-fast), box-shadow var(--dur-fast)',
          }}
          onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = 'translate(-2px,-2px)'; el.style.boxShadow = '5px 5px 0 var(--ink)' }}
          onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = ''; el.style.boxShadow = '3px 3px 0 var(--ink)' }}
        >
          <Icon name="calendar" size={17} /> Open calendar <Icon name="arrowRight" size={16} />
        </Link>
      </header>

      <div className="sm-dots" style={{ flex: 1, padding: '24px 26px 60px', overflowY: 'auto' }}>
        <div style={{ maxWidth: 1040, margin: '0 auto', display: 'flex', flexDirection: 'column', gap: 18 }}>

          {/* summary chips */}
          <div style={{ display: 'flex', gap: 12, flexWrap: 'wrap' }}>
            <SummaryChip
              icon={<Icon name="layers" size={22} />}
              value={Object.keys(tasks).length}
              label="tasks"
            />
            <SummaryChip
              icon={<Icon name="zap" size={22} />}
              value={`${fmtMd(grand)} md`}
              label="total effort"
            />
            {ROLES.map((r) => (
              <SummaryChip
                key={r.key}
                color={r.hex}
                icon={
                  <span style={{
                    width: 26, height: 26, borderRadius: 7,
                    background: r.hex, border: '2px solid var(--ink)', color: '#fff',
                    display: 'flex', alignItems: 'center', justifyContent: 'center',
                    fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12,
                  }}>{r.short}</span>
                }
                value={`${fmtMd(perRole[r.key])} md`}
                label={r.label}
              />
            ))}
          </div>

          {/* toolbar */}
          <div style={{ display: 'flex', gap: 12, alignItems: 'flex-end', flexWrap: 'wrap' }}>
            <div style={{ flex: '1 1 240px', minWidth: 200, position: 'relative' }}>
              <span style={{ position: 'absolute', left: 12, top: '50%', transform: 'translateY(-50%)', color: 'var(--ink-faint)', pointerEvents: 'none' }}>
                <Icon name="sparkle" size={17} />
              </span>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search ticket or title…"
                style={{
                  width: '100%', border: '2.5px solid var(--ink)', borderRadius: 12,
                  padding: '10px 12px 10px 38px', outline: 'none',
                  fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15,
                  color: 'var(--ink)', background: '#fff',
                  boxShadow: '2px 2px 0 var(--ink)',
                }}
              />
            </div>
            <RoleTabs items={filterItems} value={roleFilter} onChange={setRoleFilter} />
            <SortSelect value={sort} onChange={setSort} />
          </div>

          {/* table */}
          <div style={{ border: '4px solid var(--ink)', borderRadius: 18, boxShadow: '6px 6px 0 var(--ink)', overflow: 'hidden', background: '#fff' }}>
            <HeaderRow />
            {ids.length === 0 ? (
              <div style={{ padding: '40px 0', textAlign: 'center', fontFamily: 'var(--font-hand)', fontSize: 22, color: 'var(--ink-faint)' }}>
                {q || roleFilter !== 'all'
                  ? 'no tasks match — try clearing the filter'
                  : 'your list is empty — add one below!'}
              </div>
            ) : ids.map((id) => (
              <TaskRow
                key={id}
                task={tasks[id]}
                blocks={blocks}
                onTicket={(v) => updateTask(id, { ticket: v })}
                onTitle={(v)  => updateTask(id, { title: v })}
                onRole={(role, v) => setRoleEffort(id, role, v)}
                onDelete={() => { if (confirm('Delete this task?')) deleteTask(id) }}
              />
            ))}
            <AddRow onAdd={addTask} />
          </div>

          {/* footer hints */}
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--ink-soft)', display: 'flex', gap: 16, flexWrap: 'wrap', paddingLeft: 4 }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              <Icon name="link" size={15} /> changes sync with the calendar automatically
            </span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6 }}>
              type <b style={{ fontFamily: 'var(--font-display)' }}>0.5+0.5</b> in a role to split into two blocks
            </span>
          </div>
        </div>
      </div>
    </div>
  )
}
