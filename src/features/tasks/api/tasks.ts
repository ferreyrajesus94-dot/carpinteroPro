import { supabase } from '@/shared/lib/supabase'
import type { Task, TaskInsert, TaskUpdate } from '@/features/tasks/types'

export async function fetchTasks(workshopId: string): Promise<Task[]> {
  const { data, error } = await supabase
    .from('tasks')
    .select('*')
    .eq('workshop_id', workshopId)
    .order('due_date', { ascending: true, nullsFirst: false })
    .order('created_at', { ascending: false })
  if (error) throw error
  return data ?? []
}

export async function createTask(
  task: Omit<TaskInsert, 'id' | 'created_at' | 'updated_at'>
): Promise<Task> {
  const { data, error } = await supabase
    .from('tasks')
    .insert(task)
    .select()
    .single()
  if (error) throw error
  return data
}

export async function updateTask(id: string, task: TaskUpdate): Promise<void> {
  const { error } = await supabase.from('tasks').update(task).eq('id', id)
  if (error) throw error
}

export async function deleteTask(id: string): Promise<void> {
  const { error } = await supabase.from('tasks').delete().eq('id', id)
  if (error) throw error
}
