import { Routes, Route, Navigate } from "react-router-dom";
import { ClientList } from "./components/ClientList";

// /crm/clientes and /crm/clientes/:id are now handled by app-level pages.
// CrmRoutes only covers the index redirect and any future CRM sub-routes.
export function CrmRoutes() {
	return (
		<Routes>
			<Route index element={<Navigate to="clientes" replace />} />
			<Route path="clientes" element={<ClientList />} />
		</Routes>
	);
}
