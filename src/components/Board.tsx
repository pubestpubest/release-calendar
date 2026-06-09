'use client'

import { useRef } from 'react'
import Icon from './Icon'
import {
  ROLES, SNAP, ROW_H, ROW_GAP, LANE_PAD, ROW_HEADER_W, DOW, MON,
  fmtMd,
} from '@/lib/helpers'
import type { Layout, LayoutItem } from '@/lib/helpers'
import type { Block, Task, Role } from '@/lib/types'

type Viz = 'calendar' | 'gantt' | 'combined'

interface BlockProps {
  entry: LayoutItem
  task: Task
  role: (typeof ROLES)[number]
  dayWidth: number
  radius: number
  selected: boolean
  dimmed: boolean
  onPointerDown: (e: React.PointerEvent, b: Block) => void
  onDelete: (id: string) => void
}

function BlockEl({ entry, task, role, dayWidth, radius, selected, dimmed, onPointerDown, onDelete }: BlockProps) {
  const b = entry.block
  const left   = b.start * dayWidth
  const width  = Math.max(b.mandays * dayWidth - 5, 26)
  const top    = LANE_PAD + entry.subrow * (ROW_H + ROW_GAP)
  const conflict = entry.conflict
  const micro  = width < 60
  const tiny   = width < 92

  return (
    <div
      onPointerDown={(e) => onPointerDown(e, b)}
      style={{
        position: 'absolute', left, top, width, height: ROW_H,
        background: role.hex,
        border: `3px solid ${conflict ? 'var(--tomato)' : 'var(--ink)'}`,
        boxShadow: selected ? '4px 4px 0 var(--ink)' : '2px 2px 0 var(--ink)',
        borderRadius: radius,
        color: '#fff', cursor: 'grab', userSelect: 'none', touchAction: 'none',
        opacity: dimmed ? 0.32 : 1,
        zIndex: selected ? 4 : 3,
        transition: 'box-shadow .12s, opacity .15s',
        overflow: 'hidden',
      }}
      title={`${task.ticket} ${task.title} · ${role.short} ${fmtMd(b.mandays)} md`}
    >
      {micro ? (
        <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', height: '100%', fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 13 }}>
          {fmtMd(b.mandays)}
        </div>
      ) : (
        <div style={{ display: 'flex', alignItems: 'center', height: '100%', padding: tiny ? '0 6px' : '0 9px', gap: 6 }}>
          <span style={{ opacity: 0.85, flex: '0 0 auto', display: 'flex' }}>
            <Icon name="grip" size={14} strokeWidth={2.8} />
          </span>
          <div style={{ minWidth: 0, flex: 1, lineHeight: 1.05 }}>
            <div style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.ticket}</div>
            {!tiny && <div style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 11, opacity: 0.9, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{task.title}</div>}
          </div>
          <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, background: 'rgba(0,0,0,0.22)', borderRadius: 999, padding: '2px 7px', flex: '0 0 auto' }}>{fmtMd(b.mandays)}</span>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onDelete(b.id) }}
            aria-label="Remove"
            style={{
              flex: '0 0 auto', width: 20, height: 20, borderRadius: 999, border: '2px solid var(--ink)',
              background: '#fff', color: 'var(--ink)', cursor: 'pointer',
              display: conflict ? 'flex' : 'none', alignItems: 'center', justifyContent: 'center', padding: 0,
            }}
            className="rc-block-del"
          >
            <Icon name="x" size={11} strokeWidth={3} />
          </button>
        </div>
      )}
      {conflict && (
        <span style={{ position: 'absolute', top: -2, right: -2, color: 'var(--tomato)', background: '#fff', borderRadius: 999, display: 'flex', padding: 1, border: '2px solid var(--ink)' }}>
          <Icon name="alert" size={11} strokeWidth={3} />
        </span>
      )}
    </div>
  )
}

interface BoardProps {
  tasks: Record<string, Task>
  blocks: Block[]
  days: Date[]
  dayCount: number
  layout: Layout
  viz: Viz
  dayWidth: number
  selectedTaskId: string | null
  onSelectTask: (id: string | null) => void
  onMoveBlock: (id: string, start: number) => void
  onDeleteBlock: (id: string) => void
  todayIndex: number
}

export default function Board({
  tasks, blocks, days, dayCount, layout, viz, dayWidth,
  selectedTaskId, onSelectTask, onMoveBlock, onDeleteBlock, todayIndex,
}: BoardProps) {
  const drag = useRef<{ id: string; startX: number; orig: number; moved: boolean; mandays: number } | null>(null)
  const timelineW = dayCount * dayWidth
  const blockRadius = viz === 'calendar' ? 11 : 999

  const handlePointerDown = (e: React.PointerEvent, b: Block) => {
    if (e.button === 1 || e.button === 2) return
    ;(e.currentTarget as HTMLElement).setPointerCapture(e.pointerId)
    drag.current = { id: b.id, startX: e.clientX, orig: b.start, moved: false, mandays: b.mandays }
  }
  const handlePointerMove = (e: React.PointerEvent) => {
    const d = drag.current; if (!d) return
    const delta = (e.clientX - d.startX) / dayWidth
    if (Math.abs(e.clientX - d.startX) > 4) d.moved = true
    let raw = d.orig + delta
    raw = Math.round(raw / SNAP) * SNAP
    raw = Math.max(0, Math.min(raw, dayCount - d.mandays))
    onMoveBlock(d.id, Math.round(raw * 100) / 100)
  }
  const handlePointerUp = (taskId: string | null) => {
    const d = drag.current
    if (d && !d.moved) onSelectTask(taskId === selectedTaskId ? null : taskId)
    drag.current = null
  }

  // connector dots between blocks of the same task
  const pointsForTask = (taskId: string) => {
    const pts: { x: number; y: number }[] = []
    ROLES.forEach((role) => {
      layout.byRole[role.key].items.forEach((it) => {
        if (it.block.taskId === taskId) {
          pts.push({
            x: (it.block.start + it.block.mandays / 2) * dayWidth,
            y: layout.laneTops[role.key] + LANE_PAD + it.subrow * (ROW_H + ROW_GAP) + ROW_H / 2,
          })
        }
      })
    })
    return pts.sort((a, b) => a.y - b.y || a.x - b.x)
  }
  const segsFrom = (pts: { x: number; y: number }[]) => {
    const out: [{ x: number; y: number }, { x: number; y: number }][] = []
    for (let i = 0; i < pts.length - 1; i++) out.push([pts[i], pts[i + 1]])
    return out
  }

  const showAllLinks = viz !== 'calendar'
  const faintLinks: { tid: string; segs: ReturnType<typeof segsFrom> }[] = []
  if (showAllLinks) {
    const taskIds = [...new Set(blocks.map((b) => b.taskId))]
    taskIds.forEach((tid) => {
      if (tid === selectedTaskId) return
      const pts = pointsForTask(tid)
      if (pts.length > 1) faintLinks.push({ tid, segs: segsFrom(pts) })
    })
  }
  const selPts  = selectedTaskId ? pointsForTask(selectedTaskId) : []
  const selSegs = segsFrom(selPts)
  const showToday = todayIndex >= 0 && todayIndex < dayCount

  const trackBg: React.CSSProperties = viz === 'calendar'
    ? {
        backgroundImage: `repeating-linear-gradient(90deg, rgba(33,27,59,0.16) 0 1px, transparent 1px ${dayWidth}px),repeating-linear-gradient(90deg, var(--cream-deep) 0 ${dayWidth}px, rgba(255,255,255,0) ${dayWidth}px ${dayWidth * 2}px)`,
      }
    : {
        backgroundImage: `repeating-linear-gradient(90deg, rgba(33,27,59,0.10) 0 1px, transparent 1px ${dayWidth}px)`,
      }

  return (
    <div
      style={{ overflow: 'auto', height: '100%', background: '#fff' }}
      onPointerMove={handlePointerMove}
      onPointerUp={() => {
        const d = drag.current
        const taskId = d ? (blocks.find((bb) => bb.id === d.id)?.taskId ?? null) : null
        handlePointerUp(taskId)
      }}
    >
      <div style={{ minWidth: ROW_HEADER_W + timelineW, position: 'relative' }}>

        {/* day header */}
        <div style={{ display: 'flex', position: 'sticky', top: 0, zIndex: 6 }}>
          <div style={{
            width: ROW_HEADER_W, flex: '0 0 auto', position: 'sticky', left: 0, zIndex: 7,
            background: 'var(--ink)', color: '#fff', borderRight: '4px solid var(--ink)', borderBottom: '3px solid var(--ink)',
            display: 'flex', alignItems: 'center', gap: 7, padding: '0 14px', height: 58,
          }}>
            <Icon name="calendar" size={18} />
            <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14 }}>roles</span>
          </div>
          <div style={{ position: 'relative', width: timelineW, background: 'var(--cream)', borderBottom: '3px solid var(--ink)', display: 'flex' }}>
            {days.map((d, i) => {
              const isToday  = i === todayIndex
              const weekStart = i % 5 === 0 && i !== 0
              return (
                <div key={i} style={{
                  width: dayWidth, flex: '0 0 auto', height: 58,
                  borderLeft: weekStart ? '3px solid var(--ink)' : '1px solid rgba(33,27,59,0.16)',
                  display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center',
                  background: isToday ? 'var(--yellow-100)' : 'transparent',
                }}>
                  <span style={{ fontFamily: 'var(--font-hand)', fontSize: 15, color: isToday ? 'var(--yellow-600)' : 'var(--ink-faint)', lineHeight: 1 }}>{DOW[d.getDay()].toLowerCase()}</span>
                  <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 17, color: 'var(--ink)', lineHeight: 1.1 }}>{d.getDate()}</span>
                  <span style={{ fontFamily: 'var(--font-body)', fontWeight: 700, fontSize: 10, color: 'var(--ink-faint)', textTransform: 'uppercase', letterSpacing: 0.4 }}>{MON[d.getMonth()]}</span>
                </div>
              )
            })}
          </div>
        </div>

        {/* lanes */}
        <div style={{ position: 'relative' }}>
          {/* connector overlay */}
          {(selectedTaskId || faintLinks.length > 0) && (
            <svg width={timelineW} height={layout.totalHeight}
              style={{ position: 'absolute', left: ROW_HEADER_W, top: 0, pointerEvents: 'none', zIndex: 5, overflow: 'visible' }}>
              {faintLinks.map((fl) => fl.segs.map((seg, i) => (
                <line key={fl.tid + i} x1={seg[0].x} y1={seg[0].y} x2={seg[1].x} y2={seg[1].y}
                  stroke="var(--ink)" strokeWidth={2} strokeDasharray="1 7" strokeLinecap="round" opacity={0.28} />
              )))}
              {selSegs.map((seg, i) => (
                <line key={'s' + i} x1={seg[0].x} y1={seg[0].y} x2={seg[1].x} y2={seg[1].y}
                  stroke="var(--ink)" strokeWidth={2.5} strokeDasharray="2 6" strokeLinecap="round" />
              ))}
              {selPts.map((p, i) => (
                <circle key={'d' + i} cx={p.x} cy={p.y} r={4} fill="#fff" stroke="var(--ink)" strokeWidth={2.5} />
              ))}
            </svg>
          )}

          {ROLES.map((role) => {
            const lane = layout.byRole[role.key]
            return (
              <div key={role.key} style={{ display: 'flex', height: lane.height, borderBottom: '2px solid var(--ink)' }}>
                {/* lane label */}
                <div style={{
                  width: ROW_HEADER_W, flex: '0 0 auto', position: 'sticky', left: 0, zIndex: 4,
                  background: role.tint, borderRight: '4px solid var(--ink)',
                  display: 'flex', flexDirection: 'column', justifyContent: 'center', gap: 6, padding: '0 14px',
                }}>
                  <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                    <span style={{
                      width: 30, height: 30, borderRadius: 9, background: role.hex, border: '3px solid var(--ink)',
                      color: '#fff', display: 'flex', alignItems: 'center', justifyContent: 'center',
                      fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 12, boxShadow: '2px 2px 0 var(--ink)',
                    }}>{role.short}</span>
                    <span style={{ fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 15, color: 'var(--ink)' }}>{role.label}</span>
                  </div>
                </div>
                {/* track */}
                <div style={{ position: 'relative', flex: '0 0 auto', width: timelineW, ...trackBg }}>
                  {showToday && (
                    <div style={{ position: 'absolute', left: todayIndex * dayWidth, top: 0, bottom: 0, width: 0, borderLeft: '2px dashed var(--coral)', zIndex: 1 }} />
                  )}
                  {Array.from({ length: Math.max(0, Math.floor((dayCount - 1) / 5)) }).map((_, k) => (
                    <div key={'wk' + k} style={{ position: 'absolute', left: (k + 1) * 5 * dayWidth, top: 0, bottom: 0, width: 0, borderLeft: '3px solid var(--ink)', opacity: 0.5, zIndex: 0 }} />
                  ))}
                  {lane.items.map((entry) => {
                    const task = tasks[entry.block.taskId] ?? { id: '', ticket: '?', title: '' }
                    const sel = !!selectedTaskId && entry.block.taskId === selectedTaskId
                    const dim = !!selectedTaskId && entry.block.taskId !== selectedTaskId
                    return (
                      <BlockEl key={entry.block.id} entry={entry} task={task} role={role}
                        dayWidth={dayWidth} radius={blockRadius} selected={sel} dimmed={dim}
                        onPointerDown={handlePointerDown} onDelete={onDeleteBlock} />
                    )
                  })}
                  {lane.items.length === 0 && (
                    <div style={{ position: 'absolute', left: 14, top: '50%', transform: 'translateY(-50%)', fontFamily: 'var(--font-hand)', fontSize: 18, color: 'var(--ink-faint)' }}>
                      nothing planned yet…
                    </div>
                  )}
                </div>
              </div>
            )
          })}
        </div>
      </div>
    </div>
  )
}
