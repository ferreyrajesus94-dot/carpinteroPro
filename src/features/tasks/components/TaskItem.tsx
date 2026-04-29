import { format, isToday, isTomorrow, isPast, parseISO } from 'date-fns'
import { es } from 'date-fns/locale'
import { Calendar } from 'lucide-react'
import { Badge } from '@/shared/ui/badge'
import { cn } from '@/shared/lib/utils'
import { useToggleTaskStatus } from '@/features/tasks/hooks/useTasks'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import {
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_LABELS,
  type Task,
} from '@/features/tasks/types'

interface TaskItemProps {
  task: Task
  onEdit: (task: Task) => void
}

const PRIORITY_CLASSES: Record<Task['priority'], string> = {
  alta: 'border-destructive/40 bg-destructive/10 text-destructive',
  normal: 'border-line bg-cp-bg2 text-ink2',
  baja: 'border-sky-400/30 bg-sky-400/10 text-sky-700 dark:text-sky-300',
}

function formatDueDate(iso: string) {
  const date = parseISO(iso)
  if (isToday(date)) return 'Hoy'
  if (isTomorrow(date)) return 'Mañana'
  return format(date, "EEE d 'de' MMM", { locale: es })
}

export function TaskItem({ task, onEdit }: TaskItemProps) {
  const workshopId = useWorkshopId()
  const toggleMutation = useToggleTaskStatus(workshopId)

  const isDone = task.status === 'hecha'
  const isOverdue =
    !isDone && task.due_date != null && isPast(parseISO(task.due_date)) && !isToday(parseISO(task.due_date))

  function handleToggle(e: React.MouseEvent | React.ChangeEvent) {
    e.stopPropagation()
    toggleMutation.mutate({ id: task.id, status: isDone ? 'pendiente' : 'hecha' })
  }

  return (
    <div
      className={cn(
        'group flex items-start gap-3 rounded-xl border p-3 transition-colors',
        isOverdue
          ? 'border-destructive/40 bg-destructive/5'
          : 'border-line bg-surface hover:border-line2 hover:bg-cp-bg2',
        isDone && 'opacity-60'
      )}
    >
      <input
        type="checkbox"
        checked={isDone}
        onChange={handleToggle}
        onClick={(e) => e.stopPropagation()}
        aria-label={isDone ? 'Marcar como pendiente' : 'Marcar como hecha'}
        className="mt-1 h-4 w-4 shrink-0 cursor-pointer accent-cp-accent"
      />
      <button
        type="button"
        onClick={() => onEdit(task)}
        className="min-w-0 flex-1 text-left"
      >
        <div
          className={cn(
            'truncate text-[14.5px] font-medium text-ink',
            isDone && 'line-through text-ink3'
          )}
        >
          {task.title}
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5">
          {task.due_date && (
            <span
              className={cn(
                'inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[11px]',
                isOverdue
                  ? 'border-destructive/40 bg-destructive/10 text-destructive'
                  : 'border-line bg-cp-bg2 text-ink2'
              )}
            >
              <Calendar size={10} />
              {formatDueDate(task.due_date)}
            </span>
          )}
          <Badge
            variant="outline"
            className={cn('rounded-full text-[11px]', PRIORITY_CLASSES[task.priority])}
          >
            {TASK_PRIORITY_LABELS[task.priority]}
          </Badge>
          <Badge variant="outline" className="rounded-full text-[11px] text-ink3">
            {TASK_CATEGORY_LABELS[task.category]}
          </Badge>
        </div>
        {task.notes && (
          <p className="mt-1 truncate text-[12px] text-ink3">{task.notes}</p>
        )}
      </button>
    </div>
  )
}
