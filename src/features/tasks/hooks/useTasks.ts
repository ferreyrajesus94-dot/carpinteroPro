import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query'
import { toast } from 'sonner'
import { fetchTasks, createTask, updateTask, deleteTask } from '@/features/tasks/api/tasks'
import type { Task, TaskInsert, TaskUpdate } from '@/features/tasks/types'

const TASKS_KEY = 'tasks'

export function useTasks(workshopId: string) {
  return useQuery({
    queryKey: [TASKS_KEY, workshopId],
    queryFn: () => fetchTasks(workshopId),
    enabled: Boolean(workshopId),
  })
}

export function useCreateTask(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (task: Omit<TaskInsert, 'id' | 'created_at' | 'updated_at'>) => createTask(task),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY, workshopId] })
      toast.success('Tarea creada')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useUpdateTask(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: ({ id, data }: { id: string; data: TaskUpdate }) => updateTask(id, data),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY, workshopId] })
      toast.success('Tarea actualizada')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

export function useDeleteTask(workshopId: string) {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (id: string) => deleteTask(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: [TASKS_KEY, workshopId] })
      toast.success('Tarea eliminada')
    },
    onError: (error: Error) => toast.error(error.message),
  })
}

/**
 * Toggle status with optimistic update so el checkbox responde instantáneo.
 */
export function useToggleTaskStatus(workshopId: string) {
  const queryClient = useQueryClient()
  const queryKey = [TASKS_KEY, workshopId]

  return useMutation({
    mutationFn: ({ id, status }: { id: string; status: 'pendiente' | 'hecha' }) =>
      updateTask(id, {
        status,
        completed_at: status === 'hecha' ? new Date().toISOString() : null,
      }),
    onMutate: async ({ id, status }) => {
      await queryClient.cancelQueries({ queryKey })
      const previous = queryClient.getQueryData<Task[]>(queryKey)
      queryClient.setQueryData<Task[]>(queryKey, (old) =>
        (old ?? []).map((t) =>
          t.id === id
            ? {
                ...t,
                status,
                completed_at: status === 'hecha' ? new Date().toISOString() : null,
              }
            : t
        )
      )
      return { previous }
    },
    onError: (error: Error, _vars, context) => {
      if (context?.previous) queryClient.setQueryData(queryKey, context.previous)
      toast.error(error.message)
    },
    onSettled: () => {
      queryClient.invalidateQueries({ queryKey })
    },
  })
}
