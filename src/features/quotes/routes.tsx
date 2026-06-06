import { Routes, Route } from "react-router-dom";
import { QuoteList } from "./components/QuoteList";
import { TemplateEditor } from "./components/TemplateEditor";

export function QuotesRoutes() {
	return (
		<Routes>
			<Route index element={<QuoteList />} />
			<Route path="templates" element={<TemplateEditor />} />
		</Routes>
	);
}
