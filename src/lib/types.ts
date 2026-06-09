export type Role = 'FE' | 'BE' | 'MO'

export interface RoleMeta {
  key: Role
  label: string
  short: string
  hex: string
  hexDeep: string
  tint: string
}

export interface Sprint {
  id: string
  name: string
  start: string // YYYY-MM-DD
  end: string   // YYYY-MM-DD
}

export interface Task {
  id: string
  ticket: string
  title: string
}

export interface Block {
  id: string
  taskId: string
  role: Role
  mandays: number
  start: number // day index (0-based, fractional ok)
}

export interface SprintState {
  sprint: Sprint
  sprints: Sprint[]
  tasks: Record<string, Task>
  blocks: Block[]
}
