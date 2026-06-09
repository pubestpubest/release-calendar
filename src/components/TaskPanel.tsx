'use client'

import { useState } from 'react'
import Icon from './Icon'
import { ROLES, ROLE_BY_KEY, parseMandays, fmtMd, fmtRange } from '@/lib/helpers'
import type { Block, Task, Sprint, Role } from '@/lib/types'

/* ---- shared mini input ---- */
function DSInput({ label, value, onChange, placeholder, type = 'text' }: {
  label?: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string
}) {
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1 }}>
      {label && <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>{label}</span>}
      <input
        type={type}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        style={{
          border: '2.5px solid var(--ink)', borderRadius: 10, padding: '8px 10px', outline: 'none',
          fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 15, color: 'var(--ink)',
          background: '#fff', boxShadow: '2px 2px 0 var(--ink)', width: '100%',
          transition: 'border-color 120ms',
        }}
        onFocus={(e) => { e.target.style.borderColor = 'var(--blue)' }}
        onBlur={(e)  => { e.target.style.borderColor = 'var(--ink)' }}
      />
    </label>
  )
}

/* ---- role manday input ---- */
function RoleMdInput({ role, value, onChange }: { role: Role; value: string; onChange: (v: string) => void }) {
  const r = ROLE_BY_KEY[role]
  return (
    <label style={{ display: 'flex', flexDirection: 'column', gap: 5, flex: 1, minWidth: 0 }}>
      <span style={{ display: 'inline-flex', alignItems: 'center', gap: 5, fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 12, color: 'var(--ink)' }}>
        <span style={{ width: 9, height: 9, borderRadius: 3, background: r.hex, border: '1.5px solid var(--ink)' }} />
        {r.short}
      </span>
      <input
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder="–"
        inputMode="decimal"
        style={{
          width: '100%', textAlign: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15,
          color: 'var(--ink)', border: '3px solid var(--ink)', borderRadius: 11, boxShadow: '3px 3px 0 var(--ink)',
          padding: '8px 6px', background: '#fff', outline: 'none', transition: 'border-color 120ms',
        }}
        onFocus={(e) => { e.target.style.borderColor = r.hex }}
        onBlur={(e)  => { e.target.style.borderColor = 'var(--ink)' }}
      />
    </label>
  )
}

/* ---- add task form ---- */
function AddTaskForm({ onAdd }: {
  onAdd: (opts: { ticket: string; title: string; md: Record<Role, string> }) => void
}) {
  const [ticket, setTicket] = useState('')
  const [title,  setTitle]  = useState('')
  const [md, setMd] = useState<Record<Role, string>>({ FE: '', BE: '', MO: '' })
  const [err, setErr] = useState('')

  const submit = () => {
    const hasMd = (['FE', 'BE', 'MO'] as Role[]).some((r) => parseMandays(md[r]).length > 0)
    if (!title.trim() && !ticket.trim()) { setErr('Add a ticket or a title.'); return }
    if (!hasMd) { setErr('Add at least one role estimate.'); return }
    onAdd({ ticket: ticket.trim() || '—', title: title.trim() || 'Untitled', md })
    setTicket(''); setTitle(''); setMd({ FE: '', BE: '', MO: '' }); setErr('')
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', gap: 9 }}>
        <div style={{ flex: '0 0 38%' }}>
          <DSInput label="Ticket" placeholder="SM-1234" value={ticket} onChange={setTicket} />
        </div>
        <div style={{ flex: 1 }}>
          <DSInput label="Title" placeholder="What is it?" value={title} onChange={setTitle} />
        </div>
      </div>
      <div>
        <div style={{ marginBottom: 9 }}>
          <span style={{ fontFamily: 'var(--font-body)', fontWeight: 800, fontSize: 13, color: 'var(--ink)' }}>
            Effort per role <span style={{ color: 'var(--ink-faint)', fontWeight: 700 }}>(mandays)</span>
          </span>
          <span style={{ display: 'block', fontFamily: 'var(--font-hand)', fontSize: 15, color: 'var(--grape)', lineHeight: 1.1, marginTop: 1 }}>
            tip: type 0.5+0.5 to make two blocks
          </span>
        </div>
        <div style={{ display: 'flex', gap: 9 }}>
          {(['FE', 'BE', 'MO'] as Role[]).map((r) => (
            <RoleMdInput key={r} role={r} value={md[r]} onChange={(v) => setMd((m) => ({ ...m, [r]: v }))} />
          ))}
        </div>
      </div>
      {err && <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--tomato)' }}>{err}</span>}
      <button
        onClick={submit}
        style={{
          width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 8,
          background: 'var(--pink)', color: '#fff', border: '3px solid var(--ink)', borderRadius: 14,
          padding: '11px 0', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16,
          cursor: 'pointer', boxShadow: '4px 4px 0 var(--ink)',
          transition: 'transform 120ms var(--ease-bounce), box-shadow 120ms',
        }}
        onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = 'translate(-2px,-2px)'; el.style.boxShadow = '6px 6px 0 var(--ink)' }}
        onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = ''; el.style.boxShadow = '4px 4px 0 var(--ink)' }}
      >
        <Icon name="plus" size={18} /> Add to sprint
      </button>
    </div>
  )
}

/* ---- task card in backlog ---- */
function TaskCard({ task, blocks, selected, onSelect, onDelete }: {
  task: Task; blocks: Block[]; selected: boolean
  onSelect: (id: string | null) => void; onDelete: (id: string) => void
}) {
  const byRole: Record<string, Block[]> = {}
  blocks.forEach((b) => { (byRole[b.role] = byRole[b.role] ?? []).push(b) })

  return (
    <div
      onClick={() => onSelect(selected ? null : task.id)}
      style={{
        border: '3px solid var(--ink)', borderRadius: 13, padding: '10px 12px', cursor: 'pointer',
        background: selected ? 'var(--yellow-100)' : '#fff',
        boxShadow: selected ? '4px 4px 0 var(--ink)' : '2px 2px 0 var(--ink)',
        transition: 'box-shadow .12s, transform .12s, background .15s',
        display: 'flex', flexDirection: 'column', gap: 8,
      }}
      onMouseEnter={(e) => { if (!selected) (e.currentTarget as HTMLDivElement).style.transform = 'translate(-1px,-1px)' }}
      onMouseLeave={(e) => { (e.currentTarget as HTMLDivElement).style.transform = '' }}
    >
      <div style={{ display: 'flex', alignItems: 'flex-start', gap: 8 }}>
        <div style={{ minWidth: 0, flex: 1 }}>
          <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13, color: 'var(--blue)' }}>{task.ticket}</div>
          <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, color: 'var(--ink)', lineHeight: 1.2 }}>{task.title}</div>
        </div>
        <button
          onClick={(e) => { e.stopPropagation(); onDelete(task.id) }}
          aria-label="Delete task"
          style={{ flex: '0 0 auto', width: 26, height: 26, borderRadius: 8, border: '2px solid var(--ink)', background: '#fff', color: 'var(--ink)', cursor: 'pointer', display: 'flex', alignItems: 'center', justifyContent: 'center' }}
        >
          <Icon name="trash" size={13} strokeWidth={2.6} />
        </button>
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', gap: 6 }}>
        {ROLES.filter((r) => byRole[r.key]).map((r) => {
          const total = byRole[r.key].reduce((s, b) => s + b.mandays, 0)
          const n = byRole[r.key].length
          return (
            <span key={r.key} style={{
              display: 'inline-flex', alignItems: 'center', gap: 5,
              background: r.hex, color: '#fff', border: '2px solid var(--ink)',
              borderRadius: 999, padding: '3px 10px',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, whiteSpace: 'nowrap', lineHeight: 1,
            }}>
              {r.short} {fmtMd(total)}{n > 1 ? ` ·${n}` : ''}
            </span>
          )
        })}
      </div>
    </div>
  )
}

/* ---- main panel ---- */
interface TaskPanelProps {
  sprint: Sprint
  tasks: Record<string, Task>
  blocks: Block[]
  dayCount: number
  selectedTaskId: string | null
  onSelect: (id: string | null) => void
  onAddTask: (opts: { ticket: string; title: string; md: Record<Role, string> }) => void
  onDeleteTask: (id: string) => void
  onUpdateSprint: (patch: Partial<Sprint>) => void
  onClear: () => void
}

export default function TaskPanel({
  sprint, tasks, blocks, dayCount, selectedTaskId,
  onSelect, onAddTask, onDeleteTask, onUpdateSprint, onClear,
}: TaskPanelProps) {
  const taskIds = Object.keys(tasks)
  const blocksByTask: Record<string, Block[]> = {}
  blocks.forEach((b) => { (blocksByTask[b.taskId] = blocksByTask[b.taskId] ?? []).push(b) })

  taskIds.sort((a, b) => {
    const ea = Math.min(...(blocksByTask[a] ?? [{ start: 99 }]).map((x) => x.start))
    const eb = Math.min(...(blocksByTask[b] ?? [{ start: 99 }]).map((x) => x.start))
    return ea - eb
  })

  const dateInput: React.CSSProperties = {
    border: '2.5px solid var(--ink)', borderRadius: 10, padding: '8px 10px', outline: 'none',
    fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 14, color: 'var(--ink)',
    background: '#fff', boxShadow: '2px 2px 0 var(--ink)', width: '100%',
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100%', background: 'var(--cream-deep)', borderLeft: '4px solid var(--ink)' }}>
      {/* sprint settings */}
      <div style={{ padding: '16px 18px', borderBottom: '3px solid var(--ink)', background: 'var(--cream)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
          <Icon name="settings" size={17} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>Sprint</span>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 10 }}>
          <DSInput label="Name" value={sprint.name} onChange={(v) => onUpdateSprint({ name: v })} placeholder="Sprint name" />
          <div style={{ display: 'flex', gap: 9 }}>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>Start</span>
              <input type="date" value={sprint.start} onChange={(e) => onUpdateSprint({ start: e.target.value })} style={dateInput} />
            </label>
            <label style={{ flex: 1, display: 'flex', flexDirection: 'column', gap: 5 }}>
              <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--ink)' }}>End</span>
              <input type="date" value={sprint.end} onChange={(e) => onUpdateSprint({ end: e.target.value })} style={dateInput} />
            </label>
          </div>
          <div style={{ fontFamily: 'var(--font-hand)', fontSize: 16, color: 'var(--ink-soft)' }}>
            {dayCount} working {dayCount === 1 ? 'day' : 'days'} — {fmtRange(sprint.start, sprint.end)}
          </div>
        </div>
      </div>

      {/* add task */}
      <div style={{ padding: '16px 18px', borderBottom: '3px solid var(--ink)' }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 7, marginBottom: 12 }}>
          <Icon name="plus" size={18} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)' }}>New task</span>
        </div>
        <AddTaskForm onAdd={onAddTask} />
      </div>

      {/* backlog */}
      <div style={{ flex: 1, overflowY: 'auto', padding: '14px 18px' }}>
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 10 }}>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 16, color: 'var(--ink)', whiteSpace: 'nowrap' }}>
            Backlog <span style={{ color: 'var(--ink-faint)' }}>· {taskIds.length}</span>
          </span>
          <button onClick={onClear}
            style={{ display: 'inline-flex', alignItems: 'center', gap: 4, border: '2px solid var(--ink)', borderRadius: 999, background: '#fff', padding: '4px 9px', cursor: 'pointer', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, color: 'var(--tomato)' }}>
            clear
          </button>
        </div>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 9 }}>
          {taskIds.map((id) => (
            <TaskCard key={id} task={tasks[id]} blocks={blocksByTask[id] ?? []}
              selected={selectedTaskId === id} onSelect={onSelect} onDelete={onDeleteTask} />
          ))}
          {taskIds.length === 0 && (
            <div style={{ textAlign: 'center', padding: '24px 0', fontFamily: 'var(--font-hand)', fontSize: 19, color: 'var(--ink-faint)' }}>
              your backlog is empty — add one above!
            </div>
          )}
        </div>
      </div>
    </div>
  )
}
