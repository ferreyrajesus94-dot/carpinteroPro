import { Navigate, Route, Routes } from "react-router-dom";
import { AdminGuard } from "./components/AdminGuard";
import { AdminLayout } from "./components/AdminLayout";
import { OverviewPage } from "./components/OverviewPage";
import { WorkshopsPage } from "./components/WorkshopsPage";
import { WorkshopDetailPage } from "./components/WorkshopDetailPage";
import { BillingPage } from "./components/BillingPage";
import { SupportPage } from "./components/SupportPage";

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
					<Route path="billing" element={<BillingPage />} />
					<Route path="support" element={<SupportPage />} />
					<Route path="*" element={<Navigate to="/admin" replace />} />
				</Route>
			</Routes>
		</AdminGuard>
	);
}
