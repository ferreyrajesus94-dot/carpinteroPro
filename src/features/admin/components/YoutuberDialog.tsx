import { useState, type FormEvent } from "react";
import type { YoutuberSummary, CreateYoutuberRequest } from "../types";

interface YoutuberDialogProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (input: CreateYoutuberRequest) => void;
	editing?: YoutuberSummary | null;
}

export function YoutuberDialog({
	open,
	onClose,
	onSubmit,
	editing,
}: YoutuberDialogProps) {
	const [displayName, setDisplayName] = useState(editing?.displayName ?? "");
	const [channelUrl, setChannelUrl] = useState(editing?.channelUrl ?? "");
	const [contactEmail, setContactEmail] = useState(
		editing?.contactEmail ?? "",
	);
	const [payoutMethod, setPayoutMethod] = useState(
		editing?.payoutMethod ?? "",
	);

	if (!open) return null;

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!displayName.trim()) return;
		onSubmit({
			displayName: displayName.trim(),
			channelUrl: channelUrl.trim() || null,
			contactEmail: contactEmail.trim() || null,
			payoutMethod: payoutMethod.trim() || null,
		});
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label={editing ? "Editar YouTuber" : "Crear YouTuber"}
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="w-full max-w-md rounded-xl border border-line bg-cp-surface p-6 shadow-lg">
				<h2 className="font-display text-lg font-semibold text-ink">
					{editing ? "Editar YouTuber" : "Crear YouTuber"}
				</h2>
				<form onSubmit={handleSubmit} className="mt-4 space-y-4">
					<div>
						<label
							htmlFor="yt-display-name"
							className="block text-xs font-medium text-ink2"
						>
							Nombre visible *
						</label>
						<input
							id="yt-display-name"
							type="text"
							required
							value={displayName}
							onChange={(e) => setDisplayName(e.target.value)}
							className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
							placeholder="Canal Madera"
						/>
					</div>
					<div>
						<label
							htmlFor="yt-channel-url"
							className="block text-xs font-medium text-ink2"
						>
							URL del canal
						</label>
						<input
							id="yt-channel-url"
							type="url"
							value={channelUrl}
							onChange={(e) => setChannelUrl(e.target.value)}
							className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
							placeholder="https://youtube.com/@..."
						/>
					</div>
					<div>
						<label
							htmlFor="yt-contact-email"
							className="block text-xs font-medium text-ink2"
						>
							Email de contacto
						</label>
						<input
							id="yt-contact-email"
							type="email"
							value={contactEmail}
							onChange={(e) => setContactEmail(e.target.value)}
							className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
							placeholder="canal@ejemplo.com"
						/>
					</div>
					<div>
						<label
							htmlFor="yt-payout-method"
							className="block text-xs font-medium text-ink2"
						>
							Método de pago
						</label>
						<input
							id="yt-payout-method"
							type="text"
							value={payoutMethod}
							onChange={(e) => setPayoutMethod(e.target.value)}
							className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
							placeholder="mp / cbu / etc."
						/>
					</div>
					<div className="flex items-center justify-end gap-2 pt-2">
						<button
							type="button"
							onClick={onClose}
							className="inline-flex h-9 items-center rounded-md border border-line bg-cp-surface px-4 text-[13px] font-medium text-ink2 hover:bg-cp-bg2 transition-colors"
						>
							Cancelar
						</button>
						<button
							type="submit"
							className="inline-flex h-9 items-center rounded-md bg-cp-accent px-4 text-[13px] font-medium text-[var(--cp-accent-ink)] hover:opacity-90 transition-opacity"
						>
							{editing ? "Guardar cambios" : "Crear"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
