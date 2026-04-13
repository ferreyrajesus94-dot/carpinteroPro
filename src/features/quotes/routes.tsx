import { Routes, Route } from 'react-router-dom'
import { QuoteList } from './components/QuoteList'
import { QuoteForm } from './components/QuoteForm'
import { ContractPreview } from './components/ContractPreview'
import { TemplateEditor } from './components/TemplateEditor'

export function QuotesRoutes() {
  return (
    <Routes>
      <Route index element={<QuoteList />} />
      <Route path="new" element={<QuoteForm />} />
      <Route path=":id" element={<QuoteForm />} />
      <Route path=":id/contract" element={<ContractPreview />} />
      <Route path="templates" element={<TemplateEditor />} />
    </Routes>
  )
}
