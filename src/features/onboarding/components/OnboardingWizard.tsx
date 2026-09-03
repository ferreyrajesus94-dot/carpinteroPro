import { useState } from 'react'
import { Navigate } from 'react-router-dom'
import { useForm } from 'react-hook-form'
import { zodResolver } from '@hookform/resolvers/zod'
import { z } from 'zod'
import { ChevronLeft, ChevronRight, Check, Hammer, Package, Sparkles } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { Textarea } from '@/shared/ui/textarea'
import { BrandMark } from '@/shared/ui/brand-mark'
import { useAuth } from '@/shared/providers/AuthProvider'
import { SEED_MATERIALS } from '../data/seedMaterials'
import { useMarkOnboarded } from '../hooks/useOnboarding'
import type { OnboardingMaterialInput, OnboardingWorkshopSettingsInput } from '../types'

const workshopSchema = z.object({
  name: z.string().min(1, 'Ponele un nombre a tu taller'),
  phone: z.string().optional(),
  address: z.string().optional(),
})
type WorkshopValues = z.infer<typeof workshopSchema>

const STEPS = [
  { n: 1, label: 'Tu taller', icon: Hammer },
  { n: 2, label: 'Materiales', icon: Package },
  { n: 3, label: 'Listo', icon: Sparkles },
]

export interface OnboardingWizardProps {
  onSaveWorkshopSettings: (settings: OnboardingWorkshopSettingsInput) => Promise<unknown>
  onCreateMaterial: (material: OnboardingMaterialInput) => Promise<unknown>
  isSavingWorkshopSettings?: boolean
  isCreatingMaterial?: boolean
}

export function OnboardingWizard({
  onSaveWorkshopSettings,
  onCreateMaterial,
  isSavingWorkshopSettings = false,
  isCreatingMaterial = false,
}: OnboardingWizardProps) {
  const { session, loading, onboardedAt } = useAuth()

  const [step, setStep] = useState(1)
  const [selectedSeeds, setSelectedSeeds] = useState<Set<string>>(
    new Set(SEED_MATERIALS.map(m => m.name)),
  )
  const [savingMaterials, setSavingMaterials] = useState(false)
  const [finishTarget, setFinishTarget] = useState<string | null>(null)

  const markOnboarded = useMarkOnboarded()

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<WorkshopValues>({
    resolver: zodResolver(workshopSchema),
    defaultValues: {
      name: session?.user?.user_metadata?.workshop_name ?? '',
      phone: '',
      address: '',
    },
  })

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center">
        <div className="h-6 w-6 animate-spin rounded-full border-2 border-primary border-t-transparent" />
      </div>
    )
  }
  if (!session) return <Navigate to="/login" replace />
  if (onboardedAt) return <Navigate to={finishTarget ?? '/dashboard'} replace />

  function toggleSeed(name: string) {
    setSelectedSeeds(prev => {
      const next = new Set(prev)
      if (next.has(name)) next.delete(name)
      else next.add(name)
      return next
    })
  }

  async function handleStep1(values: WorkshopValues) {
    await onSaveWorkshopSettings({
      name: values.name,
      phone: values.phone || null,
      address: values.address || null,
    })
    setStep(2)
  }

  async function handleStep2() {
    setSavingMaterials(true)
    try {
      const toCreate = SEED_MATERIALS.filter(m => selectedSeeds.has(m.name))
      for (const m of toCreate) {
        const { description, ...mat } = m
        void description
        await onCreateMaterial(mat)
      }
      setStep(3)
    } finally {
      setSavingMaterials(false)
    }
  }

  async function finish(target: string) {
    setFinishTarget(target)
    await markOnboarded.mutateAsync()
  }

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Header */}
      <header className="border-b border-line bg-cp-surface px-4 py-4 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-2">
          <BrandMark size="sm" />
          <span className="ml-2 text-xs text-ink3">— Configurá tu taller en 1 minuto</span>
        </div>
      </header>

      {/* Stepper */}
      <div className="border-b border-line bg-cp-bg2 px-4 py-3 sm:px-8">
        <div className="mx-auto flex max-w-3xl items-center gap-2 sm:gap-4">
          {STEPS.map((s, idx) => {
            const Icon = s.icon
            const done = step > s.n
            const active = step === s.n
            return (
              <div key={s.n} className="flex flex-1 items-center gap-2 sm:gap-3">
                <div
                  className={`grid h-9 w-9 shrink-0 place-items-center rounded-full font-mono text-xs transition-colors ${
                    active
                      ? 'bg-cp-accent text-[var(--cp-accent-ink)]'
                      : done
                        ? 'bg-cp-accent/20 text-cp-accent'
                        : 'bg-line text-ink2'
                  }`}
                >
                  {done ? <Check className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                </div>
                <span
                  className={`hidden text-sm font-medium sm:inline ${
                    active ? 'text-ink' : done ? 'text-ink2' : 'text-ink3'
                  }`}
                >
                  {s.label}
                </span>
                {idx < STEPS.length - 1 && (
                  <div className={`h-px flex-1 ${done ? 'bg-cp-accent/40' : 'bg-line'}`} />
                )}
              </div>
            )
          })}
        </div>
      </div>

      {/* Content */}
      <main className="flex-1 overflow-y-auto px-4 py-6 sm:px-8 sm:py-10">
        <div className="mx-auto max-w-2xl">
          {step === 1 && (
            <form onSubmit={handleSubmit(handleStep1)} className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">Tu taller</h1>
                <p className="mt-1 text-sm text-ink2">
                  Estos datos van a aparecer en tus presupuestos y contratos.
                </p>
              </div>

              <div className="space-y-4">
                <div className="space-y-2">
                  <Label htmlFor="name">Nombre del taller *</Label>
                  <Input
                    id="name"
                    placeholder="Carpintería Pérez"
                    {...register('name')}
                  />
                  {errors.name && (
                    <p className="text-xs text-destructive">{errors.name.message}</p>
                  )}
                </div>

                <div className="space-y-2">
                  <Label htmlFor="phone">Teléfono</Label>
                  <Input
                    id="phone"
                    placeholder="11 5555-5555"
                    {...register('phone')}
                  />
                </div>

                <div className="space-y-2">
                  <Label htmlFor="address">Dirección</Label>
                  <Textarea
                    id="address"
                    rows={2}
                    placeholder="Av. Siempre Viva 742, Buenos Aires"
                    {...register('address')}
                  />
                </div>
              </div>

              <div className="flex justify-between gap-3 pt-4">
                <Button
                  type="button"
                  variant="ghost"
                  onClick={() => finish('/dashboard')}
                  disabled={markOnboarded.isPending}
                >
                  Saltar
                </Button>
                <Button type="submit" disabled={isSavingWorkshopSettings}>
                  {isSavingWorkshopSettings ? 'Guardando…' : 'Siguiente'}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-6">
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">
                  Cargá tus primeros materiales
                </h1>
                <p className="mt-1 text-sm text-ink2">
                  Te sugerimos los más comunes. Después podés editar precios y stock cuando quieras.
                </p>
              </div>

              <div className="space-y-2">
                {SEED_MATERIALS.map(m => {
                  const checked = selectedSeeds.has(m.name)
                  return (
                    <button
                      key={m.name}
                      type="button"
                      onClick={() => toggleSeed(m.name)}
                      className={`flex w-full items-center gap-3 rounded-lg border p-3 text-left transition-colors ${
                        checked
                          ? 'border-cp-accent bg-cp-accent/10'
                          : 'border-line hover:border-cp-accent/50'
                      }`}
                    >
                      <div
                        className={`grid h-5 w-5 shrink-0 place-items-center rounded border-2 transition-colors ${
                          checked
                            ? 'border-cp-accent bg-cp-accent text-[var(--cp-accent-ink)]'
                            : 'border-line bg-cp-surface'
                        }`}
                      >
                        {checked && <Check className="h-3 w-3" />}
                      </div>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm font-medium text-ink">{m.name}</p>
                        <p className="text-xs text-ink3">{m.description}</p>
                      </div>
                      <span className="font-mono text-xs text-ink2">
                        ${m.price_per_unit?.toLocaleString('es-AR')}
                      </span>
                    </button>
                  )
                })}
              </div>

              <p className="text-xs text-ink3">
                {selectedSeeds.size} de {SEED_MATERIALS.length} seleccionados.
              </p>

              <div className="flex justify-between gap-3 pt-4">
                <Button type="button" variant="outline" onClick={() => setStep(1)}>
                  <ChevronLeft className="mr-1 h-4 w-4" />
                  Atrás
                </Button>
                <div className="flex gap-2">
                  <Button
                    type="button"
                    variant="ghost"
                    onClick={() => setStep(3)}
                    disabled={savingMaterials || isCreatingMaterial}
                  >
                    Saltar
                  </Button>
                  <Button onClick={handleStep2} disabled={savingMaterials || isCreatingMaterial}>
                    {savingMaterials || isCreatingMaterial
                      ? 'Cargando…'
                      : selectedSeeds.size > 0
                        ? `Cargar ${selectedSeeds.size}`
                        : 'Siguiente'}
                    <ChevronRight className="ml-1 h-4 w-4" />
                  </Button>
                </div>
              </div>
            </div>
          )}

          {step === 3 && (
            <div className="space-y-6 text-center">
              <div className="mx-auto grid h-16 w-16 place-items-center rounded-full bg-cp-accent/15 text-cp-accent">
                <Sparkles className="h-7 w-7" />
              </div>
              <div>
                <h1 className="font-display text-2xl font-semibold text-ink">
                  ¡Listo! Tu taller está configurado
                </h1>
                <p className="mx-auto mt-2 max-w-md text-sm text-ink2">
                  Ya podés crear tu primer presupuesto. Si necesitás ajustar algo, todo está en
                  Ajustes.
                </p>
              </div>

              <div className="flex flex-col items-center justify-center gap-2 pt-2 sm:flex-row sm:gap-3">
                <Button
                  variant="outline"
                  onClick={() => finish('/dashboard')}
                  disabled={markOnboarded.isPending}
                  className="w-full sm:w-auto"
                >
                  Ir al panel
                </Button>
                <Button
                  onClick={() => finish('/quotes/new')}
                  disabled={markOnboarded.isPending}
                  className="w-full sm:w-auto"
                >
                  {markOnboarded.isPending ? 'Guardando…' : 'Crear mi primer presupuesto'}
                  <ChevronRight className="ml-1 h-4 w-4" />
                </Button>
              </div>
            </div>
          )}
        </div>
      </main>
    </div>
  )
}
