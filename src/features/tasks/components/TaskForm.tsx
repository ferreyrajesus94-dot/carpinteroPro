import { useEffect } from 'react'
import { useForm, type Resolver } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/shared/ui/select'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useCreateTask, useUpdateTask, useDeleteTask } from '@/features/tasks/hooks/useTasks'
import {
  TASK_PRIORITY_LABELS,
  TASK_CATEGORY_LABELS,
  type Task,
  type TaskPriority,
  type TaskCategory,
} from '@/features/tasks/types'

const schema = z.object({
  title: z.string().min(1, 'El título es obligatorio'),
  due_date: z.string().optional(),
  priority: z.enum(['alta', 'normal', 'baja']),
  category: z.enum(['compras', 'produccion', 'administrativo', 'otros']),
  notes: z.string().optional(),
})

type FormValues = z.infer<typeof schema>

interface TaskFormProps {
  open: boolean
  onOpenChange: (open: boolean) => void
  task?: Task
}

export function TaskForm({ open, onOpenChange, task }: TaskFormProps) {
  const workshopId = useWorkshopId()
  const createMutation = useCreateTask(workshopId)
  const updateMutation = useUpdateTask(workshopId)
  const deleteMutation = useDeleteTask(workshopId)
  const isEditing = Boolean(task)

  const {
    register,
    handleSubmit,
    reset,
    setValue,
    watch,
    formState: { errors, isSubmitting },
  } = useForm<FormValues>({
    resolver: zodResolver(schema) as Resolver<FormValues>,
    defaultValues: {
      title: '',
      due_date: '',
      priority: 'normal',
      category: 'otros',
      notes: '',
    },
  })

  useEffect(() => {
    if (task) {
      reset({
        title: task.title,
        due_date: task.due_date ?? '',
        priority: task.priority,
        category: task.category,
        notes: task.notes ?? '',
      })
    } else {
      reset({
        title: '',
        due_date: '',
        priority: 'normal',
        category: 'otros',
        notes: '',
      })
    }
  }, [task, reset, open])

  const priority = watch('priority')
  const category = watch('category')

  async function onSubmit(values: FormValues) {
    const payload = {
      title: values.title.trim(),
      due_date: values.due_date ? values.due_date : null,
      priority: values.priority,
      category: values.category,
      notes: values.notes?.trim() ? values.notes.trim() : null,
    }

    if (isEditing && task) {
      await updateMutation.mutateAsync({ id: task.id, data: payload })
    } else {
      await createMutation.mutateAsync({ workshop_id: workshopId, ...payload })
    }
    onOpenChange(false)
  }

  async function onDelete() {
    if (!task) return
    if (!confirm('¿Eliminar esta tarea?')) return
    await deleteMutation.mutateAsync(task.id)
    onOpenChange(false)
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>{isEditing ? 'Editar tarea' : 'Nueva tarea'}</DialogTitle>
        </DialogHeader>
        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4">
          <div className="space-y-1">
            <Label htmlFor="task-title">Título *</Label>
            <Input
              id="task-title"
              {...register('title')}
              placeholder="Comprar tornillos 3x30, llamar a Juan…"
              autoFocus
            />
            {errors.title && <p className="text-destructive text-xs">{errors.title.message}</p>}
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div className="space-y-1">
              <Label htmlFor="task-date">Fecha</Label>
              <Input id="task-date" type="date" {...register('due_date')} />
            </div>
            <div className="space-y-1">
              <Label>Prioridad</Label>
              <Select value={priority} onValueChange={(v) => setValue('priority', v as TaskPriority)}>
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {(Object.entries(TASK_PRIORITY_LABELS) as [TaskPriority, string][]).map(([v, l]) => (
                    <SelectItem key={v} value={v}>{l}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="space-y-1">
            <Label>Categoría</Label>
            <Select value={category} onValueChange={(v) => setValue('category', v as TaskCategory)}>
              <SelectTrigger>
                <SelectValue />
              </SelectTrigger>
              <SelectContent>
                {(Object.entries(TASK_CATEGORY_LABELS) as [TaskCategory, string][]).map(([v, l]) => (
                  <SelectItem key={v} value={v}>{l}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1">
            <Label htmlFor="task-notes">Notas</Label>
            <Textarea
              id="task-notes"
              rows={3}
              {...register('notes')}
              placeholder="Detalles opcionales"
            />
          </div>

          <div className="flex justify-between gap-2 pt-2">
            {isEditing ? (
              <Button type="button" variant="destructive" onClick={onDelete}>
                Eliminar
              </Button>
            ) : (
              <span />
            )}
            <div className="flex gap-2">
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isSubmitting}>
                {isSubmitting ? 'Guardando…' : isEditing ? 'Guardar' : 'Crear tarea'}
              </Button>
            </div>
          </div>
        </form>
      </DialogContent>
    </Dialog>
  )
}
