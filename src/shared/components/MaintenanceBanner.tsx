import { useState } from "react";
import { useMaintenanceMode } from "@/shared/hooks/useMaintenanceMode";
import { useAuth } from "@/shared/providers/AuthProvider";

export function MaintenanceBanner() {
	const { isPlatformAdmin } = useAuth();
	const { data: maintenance } = useMaintenanceMode();
	const [dismissed, setDismissed] = useState(false);

	if (isPlatformAdmin || !maintenance?.enabled || dismissed) return null;

	return (
		<div className="flex items-center justify-between gap-2 border-b border-cp-warn/40 bg-cp-warn/10 px-4 py-2 text-sm text-cp-warn">
			<span>
				<i
					className="fi fi-rr-triangle-warning mr-2 align-middle"
					aria-hidden="true"
				/>
				{maintenance.message || "Estamos en mantenimiento. Volvé pronto."}
			</span>
			<button
				type="button"
				onClick={() => setDismissed(true)}
				className="text-cp-warn/80 hover:text-cp-warn text-lg leading-none"
				aria-label="Cerrar aviso"
			>
				×
			</button>
		</div>
	);
}
