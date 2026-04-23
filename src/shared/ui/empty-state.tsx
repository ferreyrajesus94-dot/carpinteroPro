import { type LucideIcon } from 'lucide-react'
import { type ReactNode } from 'react'

interface Props {
  icon: LucideIcon
  title: string
  description?: string
  action?: ReactNode
}

export function EmptyState({ icon: Icon, title, description, action }: Props) {
  return (
    <div className="rounded-xl border border-line bg-cp-bg2 p-8 text-center">
      <div className="mx-auto mb-3 grid h-12 w-12 place-items-center rounded-full bg-cp-accent-soft">
        <Icon className="h-5 w-5 text-cp-accent" />
      </div>
      <p className="font-medium text-ink">{title}</p>
      {description && <p className="mt-1 text-[13px] text-ink3">{description}</p>}
      {action && <div className="mt-4">{action}</div>}
    </div>
  )
}
