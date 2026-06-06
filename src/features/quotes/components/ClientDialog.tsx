import type { ReactNode } from "react";

interface ClientDialogProps {
	open: boolean;
	children: ReactNode;
}

/**
 * Dialog wrapper for creating a new client during quote creation.
 * Receives the client form component as `children` from the app seam
 * instead of importing it from the CRM feature directly.
 */
export function ClientDialog({ open, children }: ClientDialogProps) {
	if (!open) return null;
	return <>{children}</>;
}
