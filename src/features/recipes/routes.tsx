import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { MuebleList } from './components/MuebleList'
import { MuebleForm } from './components/MuebleForm'
import type { FurnitureTemplateWithItems } from './types'

export function RecipesRoutes() {
  const [formOpen, setFormOpen] = useState(false)
  const [selectedTemplate, setSelectedTemplate] = useState<FurnitureTemplateWithItems | null>(null)

  function handleEdit(template: FurnitureTemplateWithItems) {
    setSelectedTemplate(template)
    setFormOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setSelectedTemplate(null)
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Muebles</h1>
          <p className="text-muted-foreground text-sm">
            Plantillas de muebles con lista de materiales y costo estimado.
          </p>
        </div>
        <Button onClick={() => { setSelectedTemplate(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo mueble
        </Button>
      </div>

      <MuebleList onEdit={handleEdit} />

      <Dialog open={formOpen} onOpenChange={(open) => !open && handleFormClose()}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>
              {selectedTemplate ? 'Editar mueble' : 'Nuevo mueble'}
            </DialogTitle>
          </DialogHeader>
          <MuebleForm
            template={selectedTemplate}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>
    </div>
  )
}
