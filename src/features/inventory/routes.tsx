import { useCallback, useState } from 'react'
import { Plus } from 'lucide-react'
import { Button } from '@/shared/ui/button'
import { PageHeader } from '@/shared/ui/page-header'
import { useFabAction } from '@/shared/lib/fab'
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
} from '@/shared/ui/dialog'
import { MaterialList } from './components/MaterialList'
import { MaterialForm } from './components/MaterialForm'
import { PriceHistoryChart } from './components/PriceHistoryChart'
import { StockAdjustDialog } from './components/StockAdjustDialog'
import { StockHistoryDialog } from './components/StockHistoryDialog'
import type { Material } from './types'

type ActiveDialog = 'form' | 'priceHistory' | 'stockAdjust' | 'stockHistory' | null

export function InventoryRoutes() {
  const [active, setActive] = useState<ActiveDialog>(null)
  const [selectedMaterial, setSelectedMaterial] = useState<Material | null>(null)

  function openFor(dialog: Exclude<ActiveDialog, null>, material: Material | null) {
    setSelectedMaterial(material)
    setActive(dialog)
  }

  useFabAction('inventory:new', useCallback(() => openFor('form', null), []))

  function close() {
    setActive(null)
    setSelectedMaterial(null)
  }

  return (
    <div className="space-y-4 p-4 md:p-6 pb-24 md:pb-6">
      <PageHeader
        title="Inventario"
        actions={
          <Button onClick={() => openFor('form', null)}>
            <Plus className="h-4 w-4 mr-2" />
            Nuevo material
          </Button>
        }
      />

      <MaterialList
        onEdit={(m) => openFor('form', m)}
        onViewHistory={(m) => openFor('priceHistory', m)}
        onAdjustStock={(m) => openFor('stockAdjust', m)}
        onViewStockHistory={(m) => openFor('stockHistory', m)}
      />

      <Dialog open={active === 'form'} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              {selectedMaterial ? 'Editar material' : 'Nuevo material'}
            </DialogTitle>
          </DialogHeader>
          <MaterialForm
            material={selectedMaterial}
            onSuccess={close}
            onCancel={close}
          />
        </DialogContent>
      </Dialog>

      <Dialog open={active === 'priceHistory'} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Historial de precios — {selectedMaterial?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedMaterial && <PriceHistoryChart material={selectedMaterial} />}
        </DialogContent>
      </Dialog>

      <Dialog open={active === 'stockAdjust'} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-md">
          <DialogHeader>
            <DialogTitle>Ajustar stock</DialogTitle>
          </DialogHeader>
          {selectedMaterial && (
            <StockAdjustDialog material={selectedMaterial} onSuccess={close} onCancel={close} />
          )}
        </DialogContent>
      </Dialog>

      <Dialog open={active === 'stockHistory'} onOpenChange={(open) => !open && close()}>
        <DialogContent className="max-w-lg">
          <DialogHeader>
            <DialogTitle>
              Movimientos de stock — {selectedMaterial?.name}
            </DialogTitle>
          </DialogHeader>
          {selectedMaterial && <StockHistoryDialog material={selectedMaterial} />}
        </DialogContent>
      </Dialog>
    </div>
  )
}
