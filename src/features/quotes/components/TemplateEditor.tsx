import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { Input } from '@/shared/ui/input'
import { Label } from '@/shared/ui/label'
import { useWorkshopId } from '@/shared/hooks/useWorkshopId'
import {
  useContractTemplates,
  useCreateContractTemplate,
  useUpdateContractTemplate,
  useDeleteContractTemplate,
} from '../hooks/useContractTemplates'
import type { ContractTemplate } from '../types'

const AVAILABLE_VARS = [
  '{{client_name}}',
  '{{quote_number}}',
  '{{total}}',
  '{{furniture_name}}',
  '{{workshop_name}}',
  '{{date}}',
]

export function TemplateEditor() {
  const workshopId = useWorkshopId()
  const { data: templates = [] } = useContractTemplates(workshopId)
  const createMutation = useCreateContractTemplate(workshopId)
  const updateMutation = useUpdateContractTemplate(workshopId)
  const deleteMutation = useDeleteContractTemplate(workshopId)

  const [selected, setSelected] = useState<ContractTemplate | null>(null)
  const [editName, setEditName] = useState('')
  const [editBody, setEditBody] = useState('')
  const [newName, setNewName] = useState('')

  function handleSelect(t: ContractTemplate) {
    setSelected(t)
    setEditName(t.name)
    setEditBody(t.body_markdown)
  }

  function insertVar(v: string) {
    setEditBody((prev) => prev + v)
  }

  async function handleSave() {
    if (!selected) return
    await updateMutation.mutateAsync({
      id: selected.id,
      data: { name: editName, body_markdown: editBody },
    })
  }

  async function handleSetDefault() {
    if (!selected) return
    await Promise.all(
      templates
        .filter((t) => t.is_default && t.id !== selected.id)
        .map((t) => updateMutation.mutateAsync({ id: t.id, data: { is_default: false } }))
    )
    await updateMutation.mutateAsync({
      id: selected.id,
      data: { is_default: true },
    })
  }

  async function handleCreate() {
    if (!newName.trim()) return
    const t = await createMutation.mutateAsync({
      workshop_id: workshopId,
      name: newName.trim(),
      body_markdown: '',
      is_default: false,
    })
    setNewName('')
    handleSelect(t)
  }

  async function handleDelete(id: string) {
    if (!confirm('¿Eliminar esta plantilla?')) return
    await deleteMutation.mutateAsync(id)
    if (selected?.id === id) setSelected(null)
  }

  return (
    <div className="max-w-5xl mx-auto p-4 space-y-4">
      <h1 className="text-2xl font-bold">Plantillas de contrato</h1>

      <div className="flex flex-col lg:flex-row gap-4">
        <div className="lg:w-56 space-y-2">
          {templates.map((t) => (
            <div
              key={t.id}
              className={`flex items-center justify-between rounded-md border px-3 py-2 cursor-pointer text-sm ${selected?.id === t.id ? 'border-primary bg-accent' : 'hover:bg-muted'}`}
              onClick={() => handleSelect(t)}
            >
              <span className="truncate">{t.name}{t.is_default ? ' ★' : ''}</span>
              <button
                onClick={(e) => { e.stopPropagation(); handleDelete(t.id) }}
                className="text-destructive text-xs ml-2 opacity-60 hover:opacity-100"
              >
                ✕
              </button>
            </div>
          ))}

          <div className="flex gap-1 mt-3">
            <Input
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              placeholder="Nueva plantilla..."
              className="text-sm"
              onKeyDown={(e) => e.key === 'Enter' && handleCreate()}
            />
            <Button size="icon" variant="outline" onClick={handleCreate}>
              <Plus className="h-4 w-4" />
            </Button>
          </div>
        </div>

        {selected ? (
          <div className="flex-1 space-y-3">
            <div className="space-y-1">
              <Label>Nombre</Label>
              <Input
                value={editName}
                onChange={(e) => setEditName(e.target.value)}
              />
            </div>

            <div className="space-y-1">
              <Label className="text-xs text-muted-foreground">Variables disponibles (click para insertar)</Label>
              <div className="flex flex-wrap gap-1">
                {AVAILABLE_VARS.map((v) => (
                  <button
                    key={v}
                    onClick={() => insertVar(v)}
                    className="rounded-full border px-2 py-0.5 text-xs font-mono hover:bg-accent"
                  >
                    {v}
                  </button>
                ))}
              </div>
            </div>

            <div className="flex gap-4">
              <div className="flex-1 space-y-1">
                <Label>Editar (Markdown)</Label>
                <textarea
                  value={editBody}
                  onChange={(e) => setEditBody(e.target.value)}
                  rows={12}
                  className="w-full rounded-md border bg-background px-3 py-2 text-sm font-mono resize-none focus:outline-none focus:ring-2 focus:ring-ring"
                />
              </div>
              <div className="flex-1 space-y-1">
                <Label>Preview</Label>
                <div
                  className="rounded-md border bg-white p-3 text-sm leading-relaxed min-h-[200px]"
                  dangerouslySetInnerHTML={{
                    __html: editBody
                      .replace(/\*\*(.*?)\*\*/g, '<strong>$1</strong>')
                      .replace(/\n/g, '<br />'),
                  }}
                />
              </div>
            </div>

            <div className="flex gap-2">
              <Button onClick={handleSave}>Guardar</Button>
              <Button variant="outline" onClick={handleSetDefault}>
                {selected.is_default ? '★ Predeterminada' : 'Establecer como predeterminada'}
              </Button>
            </div>
          </div>
        ) : (
          <div className="flex-1 flex items-center justify-center text-muted-foreground text-sm">
            Seleccioná una plantilla para editarla.
          </div>
        )}
      </div>
    </div>
  )
}
