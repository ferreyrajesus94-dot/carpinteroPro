import { useCallback, useMemo, useState } from 'react'
import {
  endOfWeek,
  isPast,
  isToday,
  isWithinInterval,
  parseISO,
  startOfDay,
} from 'date-fns'
import { CheckSquare } from 'lucide-react'
import { useFabAction } from '@/shared/lib/fab'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import { useOnlineStatus } from '@/shared/hooks/useOnlineStatus'
import { useTasks } from '@/features/tasks/hooks/useTasks'
import { Button } from '@/shared/ui/button'
import { PageHeader } from '@/shared/ui/page-header'
import { ChipToggle } from '@/shared/ui/chip-toggle'
import { SectionHowto } from '@/shared/ui/section-howto'
import { EmptyState, ErrorState, LoadingState } from '@/shared/ui/feedback-state'
import {
  TASK_CATEGORY_LABELS,
  TASK_PRIORITY_RANK,
  type Task,
  type TaskCategory,
} from '@/features/tasks/types'
import { TaskForm } from './TaskForm'
import { TaskItem } from './TaskItem'
import { RetryButton } from '@/shared/components/RetryButton'

type TabKey = 'hoy' | 'semana' | 'todas' | 'sin_fecha'

const TABS: { key: TabKey; label: string }[] = [
  { key: 'hoy', label: 'Hoy' },
  { key: 'semana', label: 'Esta semana' },
  { key: 'todas', label: 'Todas' },
  { key: 'sin_fecha', label: 'Sin fecha' },
]

const CATEGORIES: ('todas' | TaskCategory)[] = [
  'todas',
  'compras',
  'produccion',
  'administrativo',
  'otros',
]

const CATEGORY_FILTER_LABELS: Record<'todas' | TaskCategory, string> = {
  todas: 'Todas',
  ...TASK_CATEGORY_LABELS,
}

function isOverdue(task: Task) {
  if (task.status === 'hecha' || !task.due_date) return false
  const date = parseISO(task.due_date)
  return isPast(date) && !isToday(date)
}

function matchesTab(task: Task, tab: TabKey): boolean {
  if (tab === 'todas') return true
  if (tab === 'sin_fecha') return task.due_date == null
  if (!task.due_date) return false
  const date = parseISO(task.due_date)
  if (tab === 'hoy') {
    if (isToday(date)) return true
    return isOverdue(task)
  }
  if (tab === 'semana') {
    const start = startOfDay(new Date())
    const end = endOfWeek(new Date(), { weekStartsOn: 1 })
    return isWithinInterval(date, { start, end }) || isOverdue(task)
  }
  return false
}

function sortTasks(tasks: Task[]): Task[] {
  return [...tasks].sort((a, b) => {
    // Hechas al final
    if (a.status !== b.status) return a.status === 'hecha' ? 1 : -1
    // Vencidas pendientes primero
    const aOver = isOverdue(a) ? 0 : 1
    const bOver = isOverdue(b) ? 0 : 1
    if (aOver !== bOver) return aOver - bOver
    // Por fecha (sin fecha al final)
    if (a.due_date && b.due_date) {
      const cmp = a.due_date.localeCompare(b.due_date)
      if (cmp !== 0) return cmp
    } else if (a.due_date) return -1
    else if (b.due_date) return 1
    // Prioridad
    return TASK_PRIORITY_RANK[a.priority] - TASK_PRIORITY_RANK[b.priority]
  })
}

export function TaskList() {
  const workshopId = useWorkshopId()
  const isOnline = useOnlineStatus()
  const { data: tasks = [], isLoading, isError, refetch } = useTasks(workshopId)

  const [tab, setTab] = useState<TabKey>('hoy')
  const [categoryFilter, setCategoryFilter] = useState<'todas' | TaskCategory>('todas')
  const [formOpen, setFormOpen] = useState(false)
  const [editing, setEditing] = useState<Task | undefined>(undefined)

  const openCreate = useCallback(() => {
    setEditing(undefined)
    setFormOpen(true)
  }, [])

  useFabAction('tasks:new', openCreate)

  const filtered = useMemo(() => {
    const byTab = tasks.filter((t) => matchesTab(t, tab))
    const byCategory =
      categoryFilter === 'todas'
        ? byTab
        : byTab.filter((t) => t.category === categoryFilter)
    return sortTasks(byCategory)
  }, [tasks, tab, categoryFilter])

  const counts = useMemo(() => {
    const map: Record<TabKey, number> = { hoy: 0, semana: 0, todas: 0, sin_fecha: 0 }
    for (const t of tasks) {
      if (t.status === 'hecha') continue
      if (matchesTab(t, 'hoy')) map.hoy += 1
      if (matchesTab(t, 'semana')) map.semana += 1
      if (matchesTab(t, 'sin_fecha')) map.sin_fecha += 1
      map.todas += 1
    }
    return map
  }, [tasks])

  function handleEdit(task: Task) {
    setEditing(task)
    setFormOpen(true)
  }

  if (isError) {
    return (
      <ErrorState
        title="Error al cargar las tareas"
        description="Revisá tu conexión e intentá de nuevo."
        action={<RetryButton onRetry={() => refetch()} />}
      />
    )
  }

  if (isLoading) {
    return <LoadingState label="Cargando tareas..." />
  }

  return (
    <div className="pb-24 md:pb-6 space-y-5 p-4 md:p-6">
      <PageHeader
        eyebrow="Taller"
        title="Tareas"
        subtitle={`${counts.hoy} para hoy · ${counts.semana} esta semana`}
        actions={
          <Button size="sm" disabled={!isOnline} onClick={openCreate}>
            + Nueva
          </Button>
        }
      />

      <SectionHowto
        storageKey="tasks"
        steps={[
          'Anotá lo que tenés que hacer en el taller: compras, llamados, trámites.',
          'Asigná fecha y prioridad para que aparezca en "Hoy" o "Esta semana".',
          'Las tareas vencidas se resaltan en rojo hasta que las marques como hechas.',
        ]}
      />

      <div className="flex gap-1 overflow-x-auto rounded-xl border border-line bg-cp-bg2 p-1">
        {TABS.map(({ key, label }) => (
          <ChipToggle
            key={key}
            variant="tab"
            active={tab === key}
            onSelect={() => setTab(key)}
            label={label}
            count={key !== 'todas' ? counts[key] : undefined}
            badgeTone="accent"
            className="font-medium"
          />
        ))}
      </div>

      <div className="flex flex-wrap gap-1.5">
        {CATEGORIES.map((cat) => (
          <ChipToggle
            key={cat}
            variant="category"
            active={categoryFilter === cat}
            onSelect={() => setCategoryFilter(cat)}
            label={CATEGORY_FILTER_LABELS[cat]}
          />
        ))}
      </div>

      {filtered.length === 0 ? (
        tasks.length === 0 ? (
          <EmptyState
            variant="empty-feature"
            icon={CheckSquare}
            title="Sin tareas todavía"
            description="Creá tu primera tarea para empezar a organizar el taller."
            action={
              <Button size="sm" disabled={!isOnline} onClick={openCreate}>
                + Nueva tarea
              </Button>
            }
          />
        ) : (
          <p className="py-8 text-center text-[13px] text-ink3">
            No hay tareas para este filtro.
          </p>
        )
      ) : (
        <div className="grid gap-2">
          {filtered.map((task) => (
            <TaskItem key={task.id} task={task} onEdit={handleEdit} />
          ))}
        </div>
      )}

      <TaskForm open={formOpen} onOpenChange={setFormOpen} task={editing} />
    </div>
  )
}
