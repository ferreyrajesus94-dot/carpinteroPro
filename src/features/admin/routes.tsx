import { Navigate, Route, Routes } from "react-router-dom";
import { AdminGuard } from "./components/AdminGuard";
import { AdminLayout, AdminPlaceholderPage } from "./components/AdminLayout";
import { OverviewPage } from "./components/OverviewPage";
import { WorkshopsPage } from "./components/WorkshopsPage";
import { WorkshopDetailPage } from "./components/WorkshopDetailPage";

export function AdminRoutes() {
	return (
		<AdminGuard>
			<Routes>
				<Route element={<AdminLayout />}>
					<Route index element={<OverviewPage />} />
					<Route path="workshops" element={<WorkshopsPage />} />
					<Route
						path="workshops/:workshopId"
						element={<WorkshopDetailPage />}
					/>
					<Route path="billing" element={<AdminPlaceholderPage />} />
					<Route path="support" element={<AdminPlaceholderPage />} />
					<Route path="*" element={<Navigate to="/admin" replace />} />
				</Route>
			</Routes>
		</AdminGuard>
	);
}
