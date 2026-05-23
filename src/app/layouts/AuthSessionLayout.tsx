import { Outlet } from "react-router-dom";
import { AuthProvider } from "@/shared/providers/AuthProvider";

export function AuthSessionLayout() {
	return (
		<AuthProvider>
			<Outlet />
		</AuthProvider>
	);
}
