'use client'

import { useState, useRef, useEffect } from 'react'
import Icon from './Icon'
import type { Sprint } from '@/lib/types'

interface SprintSelectorProps {
  sprints: Sprint[]
  current: Sprint
  onSwitch: (id: string) => void
  onCreate: () => void
}

export default function SprintSelector({ sprints, current, onSwitch, onCreate }: SprintSelectorProps) {
  const [open, setOpen] = useState(false)
  const ref = useRef<HTMLDivElement>(null)

  useEffect(() => {
    if (!open) return
    const handler = (e: MouseEvent) => {
      if (ref.current && !ref.current.contains(e.target as Node)) setOpen(false)
    }
    document.addEventListener('mousedown', handler)
    return () => document.removeEventListener('mousedown', handler)
  }, [open])

  return (
    <div ref={ref} style={{ position: 'relative', flex: '0 0 auto' }}>
      <button
        onClick={() => setOpen((o) => !o)}
        style={{
          display: 'inline-flex', alignItems: 'center', gap: 8,
          background: 'var(--ink)', color: '#fff',
          border: '3px solid var(--ink)', borderRadius: 999,
          padding: '6px 12px 6px 14px',
          fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
          cursor: 'pointer', boxShadow: '2px 2px 0 rgba(0,0,0,0.3)',
          whiteSpace: 'nowrap',
        }}
      >
        <Icon name="calendar" size={15} />
        {current.name}
        <Icon name="chevronDown" size={13} style={{ opacity: 0.7 }} />
      </button>

      {open && (
        <div style={{
          position: 'absolute', top: 'calc(100% + 6px)', left: 0, zIndex: 100,
          background: '#fff', border: '3px solid var(--ink)', borderRadius: 14,
          boxShadow: '4px 4px 0 var(--ink)', minWidth: 200, overflow: 'hidden',
        }}>
          {[...sprints].map((s) => (
            <button
              key={s.id}
              onClick={() => { onSwitch(s.id); setOpen(false) }}
              style={{
                display: 'flex', alignItems: 'center', justifyContent: 'space-between',
                width: '100%', padding: '10px 14px', border: 'none',
                background: s.id === current.id ? 'var(--yellow-100, #fffbe6)' : '#fff',
                fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
                color: 'var(--ink)', cursor: 'pointer', textAlign: 'left',
                borderBottom: '1px solid rgba(33,27,59,0.1)',
                transition: 'background 80ms',
              }}
              onMouseEnter={(e) => { if (s.id !== current.id) (e.currentTarget as HTMLButtonElement).style.background = 'var(--cream)' }}
              onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = s.id === current.id ? 'var(--yellow-100, #fffbe6)' : '#fff' }}
            >
              <span>{s.name}</span>
              {s.id === current.id && <Icon name="check" size={14} />}
            </button>
          ))}
          <button
            onClick={() => { onCreate(); setOpen(false) }}
            style={{
              display: 'flex', alignItems: 'center', gap: 8,
              width: '100%', padding: '10px 14px', border: 'none',
              background: 'var(--cream)', cursor: 'pointer',
              fontFamily: 'var(--font-display)', fontWeight: 700, fontSize: 14,
              color: 'var(--grape)', borderTop: '2px solid var(--ink)',
              transition: 'background 80ms',
            }}
            onMouseEnter={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cream-deep)' }}
            onMouseLeave={(e) => { (e.currentTarget as HTMLButtonElement).style.background = 'var(--cream)' }}
          >
            <Icon name="plus" size={14} /> New sprint
          </button>
        </div>
      )}
    </div>
  )
}
