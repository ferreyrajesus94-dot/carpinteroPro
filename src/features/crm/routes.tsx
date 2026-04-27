import { Routes, Route, Navigate } from 'react-router-dom'
import { ClientList } from './components/ClientList'
import { ClientDetail } from './components/ClientDetail'

export function CrmRoutes() {
  return (
    <Routes>
      <Route index element={<Navigate to="clientes" replace />} />
      <Route path="clientes" element={<ClientList />} />
      <Route path="clientes/:id" element={<ClientDetail />} />
    </Routes>
  )
}
