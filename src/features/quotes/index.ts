export { QuoteForm } from "./components/QuoteForm";
export { QuoteStatusBadge } from "./components/QuoteStatusBadge";
export { ContractPreview } from "./components/ContractPreview";
export { TemplateEditor } from "./components/TemplateEditor";
// PR 8: QuoteActions is the canonical "Iniciar producción" entry
// point for the new flow (delegates to `useStartProductionOrder`
// from the production feature). The four-layer en_produccion
// guard at the hook/hook/UI/SQL layer (PR 6) stays in place; the
// legacy `ProductionStartReviewDialog` flow remains for the
// migration window (deprecation is scheduled for PR 9).
export { QuoteActions } from "./components/QuoteActions";
export { QuotesRoutes } from "./routes";
export {
	useQuotes,
	useCreateQuote,
	useUpdateQuote,
	useUpdateQuoteStatus,
	useGenerateQuoteNumber,
} from "./hooks/useQuotes";
