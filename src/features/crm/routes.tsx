import { Routes, Route } from 'react-router-dom'
import { KanbanBoard } from './components/KanbanBoard'
import { ClientList } from './components/ClientList'
import { ClientDetail } from './components/ClientDetail'

export function CrmRoutes() {
  return (
    <Routes>
      <Route index element={<KanbanBoard />} />
      <Route path="clientes" element={<ClientList />} />
      <Route path="clientes/:id" element={<ClientDetail />} />
    </Routes>
  )
}
