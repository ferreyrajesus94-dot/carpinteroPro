import type { Database } from '@/shared/types/database'

export type Task = Database['public']['Tables']['tasks']['Row']
export type TaskInsert = Database['public']['Tables']['tasks']['Insert']
export type TaskUpdate = Database['public']['Tables']['tasks']['Update']
export type TaskPriority = Database['public']['Enums']['task_priority']
export type TaskStatus = Database['public']['Enums']['task_status']
export type TaskCategory = Database['public']['Enums']['task_category']

export const TASK_PRIORITY_LABELS: Record<TaskPriority, string> = {
  alta: 'Alta',
  normal: 'Normal',
  baja: 'Baja',
}

export const TASK_CATEGORY_LABELS: Record<TaskCategory, string> = {
  compras: 'Compras',
  produccion: 'Producción',
  administrativo: 'Administrativo',
  otros: 'Otros',
}

export const TASK_PRIORITY_RANK: Record<TaskPriority, number> = {
  alta: 0,
  normal: 1,
  baja: 2,
}
