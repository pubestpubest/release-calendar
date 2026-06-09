'use client'

import { useState, useEffect } from 'react'
import Link from 'next/link'
import dynamic from 'next/dynamic'
import Icon from '@/components/Icon'
import TaskPanel from '@/components/TaskPanel'
import { useSprintStore } from '@/lib/store'
import { ROLES, computeLayout, roleStats, workingDays, ymd, fmtMd, DAY_W } from '@/lib/helpers'
import type { Role } from '@/lib/types'

// Board uses pointer events — no SSR
const Board = dynamic(() => import('@/components/Board'), { ssr: false })

type Density = keyof typeof DAY_W
type Viz = 'calendar' | 'gantt' | 'combined'

/* ---- capacity chip ---- */
function CapChip({ role, total, dayCount, hasConflict }: {
  role: (typeof ROLES)[number]; total: number; dayCount: number; hasConflict: boolean
}) {
  const over = total > dayCount + 1e-6
  return (
    <div style={{
      display: 'inline-flex', alignItems: 'center', gap: 7, background: '#fff',
      border: '2.5px solid var(--ink)', borderRadius: 999, padding: '4px 11px 4px 7px',
      boxShadow: '2px 2px 0 var(--ink)',
    }}>
      <span style={{ width: 22, height: 22, borderRadius: 6, background: role.hex, border: '2px solid var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>{role.short}</span>
      <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14, color: over ? 'var(--tomato)' : 'var(--ink)' }}>
        {fmtMd(total)}<span style={{ color: 'var(--ink-faint)' }}>/{dayCount}</span>
      </span>
      {(over || hasConflict) && <span style={{ color: 'var(--tomato)', display: 'flex' }}><Icon name="alert" size={15} strokeWidth={2.8} /></span>}
    </div>
  )
}

/* ---- density toggle ---- */
function DensityToggle({ value, onChange }: { value: Density; onChange: (v: Density) => void }) {
  const opts: [Density, string][] = [['compact', 'S'], ['comfy', 'M'], ['roomy', 'L']]
  return (
    <div style={{ display: 'inline-flex', border: '3px solid var(--ink)', borderRadius: 999, overflow: 'hidden', boxShadow: '2px 2px 0 var(--ink)' }}>
      {opts.map(([v, lab], i) => (
        <button key={v} onClick={() => onChange(v)}
          style={{
            border: 'none', borderLeft: i ? '2px solid var(--ink)' : 'none', cursor: 'pointer',
            padding: '7px 13px', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
            background: value === v ? 'var(--blue)' : '#fff',
            color: value === v ? '#fff' : 'var(--ink-soft)',
          }}>{lab}</button>
      ))}
    </div>
  )
}

/* ---- viz tabs ---- */
function VizTabs({ value, onChange }: { value: Viz; onChange: (v: Viz) => void }) {
  const items: { value: Viz; label: string; icon: string }[] = [
    { value: 'calendar', label: 'Calendar', icon: 'columns' },
    { value: 'gantt',    label: 'Gantt',    icon: 'gantt'   },
    { value: 'combined', label: 'Combined', icon: 'layers'  },
  ]
  return (
    <div style={{ display: 'flex', background: '#fff', border: '2.5px solid var(--ink)', borderRadius: 12, padding: 3, boxShadow: '2px 2px 0 var(--ink)', gap: 2 }}>
      {items.map((item) => {
        const active = item.value === value
        return (
          <button key={item.value} onClick={() => onChange(item.value)}
            style={{
              display: 'inline-flex', alignItems: 'center', gap: 6,
              border: active ? '2px solid var(--ink)' : '2px solid transparent',
              borderRadius: 9, background: active ? 'var(--yellow)' : 'transparent',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13,
              color: 'var(--ink)', cursor: 'pointer', padding: '5px 11px',
              boxShadow: active ? '2px 2px 0 var(--ink)' : 'none',
              transition: 'all 120ms', whiteSpace: 'nowrap',
            }}>
            <Icon name={item.icon} size={15} /> {item.label}
          </button>
        )
      })}
    </div>
  )
}

/* ---- combined capacity strip ---- */
function CombinedStrip({ stats, dayCount, conflictByRole }: {
  stats: ReturnType<typeof roleStats>; dayCount: number; conflictByRole: Record<string, boolean>
}) {
  return (
    <div className="sm-dots" style={{ display: 'flex', gap: 16, padding: '14px 22px', background: 'var(--cream)', borderBottom: '3px solid var(--ink)' }}>
      {ROLES.map((r) => {
        const s = stats[r.key]
        const over = s.over
        const pct = Math.min((s.total / Math.max(dayCount, 1)) * 100, 100)
        return (
          <div key={r.key} style={{ flex: 1, background: '#fff', border: '3px solid var(--ink)', borderRadius: 14, boxShadow: '4px 4px 0 var(--ink)', padding: '12px 14px' }}>
            <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 9 }}>
              <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                <span style={{ width: 24, height: 24, borderRadius: 7, background: r.hex, border: '2px solid var(--ink)', color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 11 }}>{r.short}</span>
                <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{r.label}</span>
              </span>
              <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: over ? 'var(--tomato)' : 'var(--ink)' }}>{fmtMd(s.total)} / {dayCount} md</span>
            </div>
            {/* progress bar */}
            <div style={{ height: 14, background: 'var(--cream-deep)', border: '2px solid var(--ink)', borderRadius: 999, overflow: 'hidden' }}>
              <div style={{ height: '100%', width: `${pct}%`, background: over ? 'var(--tomato)' : r.hex, borderRadius: 999, transition: 'width 300ms var(--ease-out)' }} />
            </div>
            <div style={{ marginTop: 8, fontFamily: 'var(--font-hand)', fontSize: 15, color: over || conflictByRole[r.key] ? 'var(--tomato)' : 'var(--ink-soft)' }}>
              {over
                ? `overbooked by ${fmtMd(s.total - dayCount)} md`
                : conflictByRole[r.key] ? 'has overlapping work'
                : s.total === 0 ? 'a free sprint — lucky!'
                : `${fmtMd(dayCount - s.total)} md free`}
            </div>
          </div>
        )
      })}
    </div>
  )
}

/* ---- logo ---- */
function LogoMark() {
  return (
    <svg width="38" height="38" viewBox="0 0 38 38" style={{ display: 'block', transform: 'rotate(-4deg)' }}>
      <rect x="3" y="3" width="32" height="32" rx="9" fill="var(--pink)" stroke="var(--ink)" strokeWidth="3" />
      <path d="M9 35 l2 -5" stroke="var(--ink)" strokeWidth="3" strokeLinecap="round" fill="none" />
      <circle cx="14.5" cy="17" r="1.9" fill="#fff" />
      <path d="M22 15.5 q1.6 1.5 3.2 0" stroke="#fff" strokeWidth="2.4" strokeLinecap="round" fill="none" />
      <path d="M12.5 23 q6.5 5 13 0" stroke="#fff" strokeWidth="2.6" strokeLinecap="round" fill="none" />
      <path d="M30 8 l1 2.4 2.4 .6 -2.4 .6 -1 2.4 -1 -2.4 -2.4 -.6 2.4 -.6z" fill="var(--yellow)" stroke="var(--ink)" strokeWidth="1.4" strokeLinejoin="round" />
    </svg>
  )
}

/* ---- main ---- */
export default function CalendarPage() {
  const store = useSprintStore()
  const { loading, loadFromSupabase } = store
  const [viz,     setViz]     = useState<Viz>('calendar')
  const [density, setDensity] = useState<Density>('comfy')
  const [selectedTaskId, setSelectedTaskId] = useState<string | null>(null)

  useEffect(() => {
    const storedViz     = localStorage.getItem('rc_viz')     as Viz     | null
    const storedDensity = localStorage.getItem('rc_density') as Density | null
    if (storedViz)     setViz(storedViz)
    if (storedDensity) setDensity(storedDensity)
    loadFromSupabase()
  }, []) // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (!loading) localStorage.setItem('rc_viz',     viz)     }, [viz,     loading])
  useEffect(() => { if (!loading) localStorage.setItem('rc_density', density) }, [density, loading])

  if (loading) {
    return (
      <div style={{ height: '100vh', display: 'flex', alignItems: 'center', justifyContent: 'center', background: 'var(--cream)' }}>
        <div style={{ fontFamily: 'var(--font-display)', fontSize: 22, color: 'var(--ink-faint)' }}>Loading…</div>
      </div>
    )
  }

  const { sprint, tasks, blocks, addTask, deleteTask, deleteBlock, moveBlock, finishMoveBlock, updateSprint, clearAll } = store

  const days      = workingDays(sprint.start, sprint.end)
  const dayCount  = Math.max(days.length, 1)
  const dayWidth  = DAY_W[density]
  const layout    = computeLayout(blocks, dayCount)
  const stats     = roleStats(blocks, dayCount)

  const conflictByRole: Record<string, boolean> = {}
  ROLES.forEach((r) => { conflictByRole[r.key] = layout.byRole[r.key].items.some((it) => it.conflict) })

  const todayYmd   = ymd(new Date())
  const todayIndex = days.findIndex((d) => ymd(d) === todayYmd)

  const handleClear = () => { if (confirm('Clear all tasks?')) clearAll() }
  const handleDeleteTask = (id: string) => {
    if (confirm('Delete this task?')) { deleteTask(id); if (selectedTaskId === id) setSelectedTaskId(null) }
  }

  return (
    <div style={{ display: 'flex', flexDirection: 'column', height: '100vh', overflow: 'hidden' }}>
      {/* header */}
      <header style={{
        display: 'flex', alignItems: 'center', gap: 18, padding: '12px 22px',
        background: 'var(--cream)', borderBottom: '4px solid var(--ink)',
        flex: '0 0 auto', flexWrap: 'wrap',
      }}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 11, flex: '0 0 auto' }}>
          <LogoMark />
          <div>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 21, color: 'var(--ink)', lineHeight: 1, whiteSpace: 'nowrap' }}>Release calendar</div>
            <div style={{ fontFamily: 'var(--font-hand)', fontSize: 16, color: 'var(--grape)', lineHeight: 1.1, whiteSpace: 'nowrap' }}>plan the sprint, together</div>
          </div>
        </div>

        <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8, background: 'var(--ink)', color: '#fff', borderRadius: 999, padding: '6px 14px', boxShadow: '2px 2px 0 var(--ink)', flex: '0 0 auto', whiteSpace: 'nowrap' }}>
          <Icon name="calendar" size={15} />
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>{sprint.name}</span>
        </div>

        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          {ROLES.map((r) => (
            <CapChip key={r.key} role={r} total={stats[r.key].total} dayCount={dayCount} hasConflict={conflictByRole[r.key]} />
          ))}
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginLeft: 'auto', flexWrap: 'wrap' }}>
          <Link href="/tasks"
            style={{
              textDecoration: 'none', display: 'inline-flex', alignItems: 'center', gap: 7,
              background: 'var(--grape)', color: '#fff', border: '3px solid var(--ink)',
              borderRadius: 999, padding: '7px 15px',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              boxShadow: '2px 2px 0 var(--ink)', whiteSpace: 'nowrap',
              transition: 'transform 120ms, box-shadow 120ms',
            }}
            onMouseEnter={(e) => { const el = e.currentTarget; el.style.transform = 'translate(-1px,-1px)'; el.style.boxShadow = '3px 3px 0 var(--ink)' }}
            onMouseLeave={(e) => { const el = e.currentTarget; el.style.transform = ''; el.style.boxShadow = '2px 2px 0 var(--ink)' }}
          >
            <Icon name="layers" size={16} /> Task list
          </Link>
          <DensityToggle value={density} onChange={setDensity} />
          <VizTabs value={viz} onChange={setViz} />
        </div>
      </header>

      {/* body */}
      <div style={{ display: 'flex', flex: 1, minHeight: 0 }}>
        <div style={{ flex: 1, minWidth: 0, display: 'flex', flexDirection: 'column' }}>
          {viz === 'combined' && (
            <CombinedStrip stats={stats} dayCount={dayCount} conflictByRole={conflictByRole} />
          )}
          <div style={{ flex: 1, minHeight: 0 }}>
            <Board
              tasks={tasks} blocks={blocks} days={days} dayCount={dayCount}
              layout={layout} viz={viz} dayWidth={dayWidth}
              selectedTaskId={selectedTaskId} onSelectTask={setSelectedTaskId}
              onMoveBlock={moveBlock} onFinishMove={finishMoveBlock} onDeleteBlock={deleteBlock}
              todayIndex={todayIndex}
            />
          </div>
          {/* hint bar */}
          <div style={{
            flex: '0 0 auto', display: 'flex', alignItems: 'center', gap: 18,
            padding: '8px 22px', background: 'var(--cream-deep)', borderTop: '3px solid var(--ink)',
            fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 13, color: 'var(--ink-soft)', flexWrap: 'wrap',
          }}>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><Icon name="grip" size={15} /> drag a block sideways to move its day</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, whiteSpace: 'nowrap' }}><Icon name="link" size={15} /> click a block to trace one ticket across roles</span>
            <span style={{ display: 'inline-flex', alignItems: 'center', gap: 6, color: 'var(--tomato)', whiteSpace: 'nowrap' }}><Icon name="alert" size={15} /> red = same role double-booked</span>
          </div>
        </div>

        {/* side panel */}
        <div style={{ width: 372, flex: '0 0 auto', height: '100%', overflow: 'hidden' }}>
          <TaskPanel
            sprint={sprint} tasks={tasks} blocks={blocks} dayCount={dayCount}
            selectedTaskId={selectedTaskId} onSelect={setSelectedTaskId}
            onAddTask={addTask} onDeleteTask={handleDeleteTask}
            onUpdateSprint={updateSprint} onClear={handleClear}
          />
        </div>
      </div>
    </div>
  )
}
