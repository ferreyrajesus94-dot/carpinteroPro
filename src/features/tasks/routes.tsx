import { Routes, Route } from 'react-router-dom'
import { TaskList } from './components/TaskList'

export function TasksRoutes() {
  return (
    <Routes>
      <Route index element={<TaskList />} />
    </Routes>
  )
}
