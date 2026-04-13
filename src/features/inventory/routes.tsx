import { useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { MaterialList } from './components/MaterialList'
import { MaterialForm } from './components/MaterialForm'
import { PriceHistoryChart } from './components/PriceHistoryChart'
import type { Material } from './types'

export function InventoryRoutes() {
  const [formOpen, setFormOpen] = useState(false)
  const [historyOpen, setHistoryOpen] = useState(false)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)

  function handleEdit(material: Material) {
    setSelectedMaterial(material)
    setFormOpen(true)
  }

  function handleViewHistory(material: Material) {
    setSelectedMaterial(material)
    setHistoryOpen(true)
  }

  function handleFormClose() {
    setFormOpen(false)
    setSelectedMaterial(null)
  }

  return (
    <div className="space-y-4">
      {/* Encabezado */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold">Inventario</h1>
          <p className="text-muted-foreground text-sm">
            Materiales del taller con control de stock y precios.
          </p>
        </div>
        <Button onClick={() => { setSelectedMaterial(null); setFormOpen(true) }}>
          <Plus className="h-4 w-4 mr-2" />
          Nuevo material
        </Button>
      </div>

      {/* Lista de materiales */}
      <MaterialList onEdit={handleEdit} onViewHistory={handleViewHistory} />

      {/* Dialog: crear / editar material */}
      <Dialog open={formOpen} onOpenChange={(open: boolean) => !open && handleFormClose()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedMaterial ? 'Editar material' : 'Nuevo material'}
            </DialogTitle>
          </DialogHeader>
          <MaterialForm
            material={selectedMaterial}
            onSuccess={handleFormClose}
            onCancel={handleFormClose}
          />
        </DialogContent>
      </Dialog>

      {/* Dialog: historial de precios */}
      <Dialog open={historyOpen} onOpenChange={setHistoryOpen}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Historial de precios — {selectedMaterial?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedMaterial && (
            <PriceHistoryChart material={selectedMaterial} />
          )}
        </DialogContent>
      </Dialog>
    </div>
  )
}
