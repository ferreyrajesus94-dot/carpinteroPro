import { useState, type FormEvent } from "react";
import type { YoutuberSummary, CreateYoutuberRequest } from "../types";

interface YoutuberDialogProps {
	open: boolean;
	onClose: () => void;
	onSubmit: (input: CreateYoutuberRequest) => void;
	editing?: YoutuberSummary | null;
}

interface BankValidationErrors {
	payoutCbu?: string;
	payoutCvu?: string;
	payoutHolderCuit?: string;
}

const CUIT_REGEX = /^\d{2}-\d{8}-\d$/;

function validateBankField(
	field: keyof BankValidationErrors,
	value: string,
): string | undefined {
	const trimmed = value.trim();
	if (!trimmed) return undefined;

	if (field === "payoutCbu" && !/^\d{22}$/.test(trimmed)) {
		return "CBU debe tener 22 dígitos";
	}
	if (field === "payoutCvu" && !/^\d{23}$/.test(trimmed)) {
		return "CVU debe tener 23 dígitos";
	}
	if (field === "payoutHolderCuit" && !CUIT_REGEX.test(trimmed)) {
		return "CUIT debe tener formato XX-XXXXXXXX-X";
	}

	return undefined;
}

function validateBankFields(input: {
	payoutCbu: string;
	payoutCvu: string;
	payoutHolderCuit: string;
}): BankValidationErrors {
	return {
		payoutCbu: validateBankField("payoutCbu", input.payoutCbu),
		payoutCvu: validateBankField("payoutCvu", input.payoutCvu),
		payoutHolderCuit: validateBankField(
			"payoutHolderCuit",
			input.payoutHolderCuit,
		),
	};
}

export function YoutuberDialog({
	open,
	onClose,
	onSubmit,
	editing,
}: YoutuberDialogProps) {
	const [displayName, setDisplayName] = useState(editing?.displayName ?? "");
	const [channelUrl, setChannelUrl] = useState(editing?.channelUrl ?? "");
	const [contactEmail, setContactEmail] = useState(editing?.contactEmail ?? "");
	const [payoutMethod, setPayoutMethod] = useState(editing?.payoutMethod ?? "");
	const [payoutCbu, setPayoutCbu] = useState(editing?.payoutCbu ?? "");
	const [payoutCvu, setPayoutCvu] = useState(editing?.payoutCvu ?? "");
	const [payoutAlias, setPayoutAlias] = useState(editing?.payoutAlias ?? "");
	const [payoutBankName, setPayoutBankName] = useState(
		editing?.payoutBankName ?? "",
	);
	const [payoutHolderName, setPayoutHolderName] = useState(
		editing?.payoutHolderName ?? "",
	);
	const [payoutHolderCuit, setPayoutHolderCuit] = useState(
		editing?.payoutHolderCuit ?? "",
	);
	const [bankErrors, setBankErrors] = useState<BankValidationErrors>({});

	if (!open) return null;

	const hasBankErrors = Object.values(bankErrors).some(Boolean);

	function handleBankBlur(field: keyof BankValidationErrors, value: string) {
		setBankErrors((current) => ({
			...current,
			[field]: validateBankField(field, value),
		}));
	}

	function handleSubmit(e: FormEvent) {
		e.preventDefault();
		if (!displayName.trim()) return;

		const nextBankErrors = validateBankFields({
			payoutCbu,
			payoutCvu,
			payoutHolderCuit,
		});
		setBankErrors(nextBankErrors);
		if (Object.values(nextBankErrors).some(Boolean)) return;

		onSubmit({
			displayName: displayName.trim(),
			channelUrl: channelUrl.trim() || null,
			contactEmail: contactEmail.trim() || null,
			payoutMethod: payoutMethod.trim() || null,
			payoutCbu: payoutCbu.trim() || null,
			payoutCvu: payoutCvu.trim() || null,
			payoutAlias: payoutAlias.trim() || null,
			payoutBankName: payoutBankName.trim() || null,
			payoutHolderName: payoutHolderName.trim() || null,
			payoutHolderCuit: payoutHolderCuit.trim() || null,
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
			<div className="flex max-h-[85vh] w-full max-w-md flex-col rounded-xl border border-line bg-cp-surface p-6 shadow-lg">
				<h2 className="font-display text-lg font-semibold text-ink">
					{editing ? "Editar YouTuber" : "Crear YouTuber"}
				</h2>
				<form
					onSubmit={handleSubmit}
					className="mt-4 flex-1 space-y-4 overflow-y-auto"
				>
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
							Método de pago (legacy)
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

					{/* Bank details section */}
					<fieldset className="border-t border-line pt-4">
						<legend className="text-sm font-semibold text-ink">
							Datos bancarios
						</legend>
						<div className="mt-3 space-y-3">
							<div>
								<label
									htmlFor="yt-payout-cbu"
									className="block text-xs font-medium text-ink2"
								>
									CBU (22 dígitos)
								</label>
								<input
									id="yt-payout-cbu"
									type="text"
									value={payoutCbu}
									onChange={(e) => setPayoutCbu(e.target.value)}
									onBlur={(e) => handleBankBlur("payoutCbu", e.target.value)}
									maxLength={22}
									aria-invalid={bankErrors.payoutCbu ? "true" : undefined}
									aria-describedby={
										bankErrors.payoutCbu ? "yt-payout-cbu-error" : undefined
									}
									className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
									placeholder="1234567890123456789012"
								/>
								{bankErrors.payoutCbu && (
									<p
										id="yt-payout-cbu-error"
										className="mt-1 text-xs text-destructive"
									>
										{bankErrors.payoutCbu}
									</p>
								)}
							</div>
							<div>
								<label
									htmlFor="yt-payout-cvu"
									className="block text-xs font-medium text-ink2"
								>
									CVU (23 dígitos)
								</label>
								<input
									id="yt-payout-cvu"
									type="text"
									value={payoutCvu}
									onChange={(e) => setPayoutCvu(e.target.value)}
									onBlur={(e) => handleBankBlur("payoutCvu", e.target.value)}
									maxLength={23}
									aria-invalid={bankErrors.payoutCvu ? "true" : undefined}
									aria-describedby={
										bankErrors.payoutCvu ? "yt-payout-cvu-error" : undefined
									}
									className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
									placeholder="12345678901234567890123"
								/>
								{bankErrors.payoutCvu && (
									<p
										id="yt-payout-cvu-error"
										className="mt-1 text-xs text-destructive"
									>
										{bankErrors.payoutCvu}
									</p>
								)}
							</div>
							<div>
								<label
									htmlFor="yt-payout-alias"
									className="block text-xs font-medium text-ink2"
								>
									Alias
								</label>
								<input
									id="yt-payout-alias"
									type="text"
									value={payoutAlias}
									onChange={(e) => setPayoutAlias(e.target.value)}
									className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
									placeholder="mi.alias.mp"
								/>
							</div>
							<div>
								<label
									htmlFor="yt-payout-bank-name"
									className="block text-xs font-medium text-ink2"
								>
									Banco
								</label>
								<input
									id="yt-payout-bank-name"
									type="text"
									value={payoutBankName}
									onChange={(e) => setPayoutBankName(e.target.value)}
									className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
									placeholder="Mercado Pago"
								/>
							</div>
							<div>
								<label
									htmlFor="yt-payout-holder-name"
									className="block text-xs font-medium text-ink2"
								>
									Titular
								</label>
								<input
									id="yt-payout-holder-name"
									type="text"
									value={payoutHolderName}
									onChange={(e) => setPayoutHolderName(e.target.value)}
									className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
									placeholder="Juan Pérez"
								/>
							</div>
							<div>
								<label
									htmlFor="yt-payout-holder-cuit"
									className="block text-xs font-medium text-ink2"
								>
									CUIT (XX-XXXXXXXX-X)
								</label>
								<input
									id="yt-payout-holder-cuit"
									type="text"
									value={payoutHolderCuit}
									onChange={(e) => setPayoutHolderCuit(e.target.value)}
									onBlur={(e) =>
										handleBankBlur("payoutHolderCuit", e.target.value)
									}
									aria-invalid={
										bankErrors.payoutHolderCuit ? "true" : undefined
									}
									aria-describedby={
										bankErrors.payoutHolderCuit
											? "yt-payout-holder-cuit-error"
											: undefined
									}
									className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
									placeholder="20-12345678-9"
								/>
								{bankErrors.payoutHolderCuit && (
									<p
										id="yt-payout-holder-cuit-error"
										className="mt-1 text-xs text-destructive"
									>
										{bankErrors.payoutHolderCuit}
									</p>
								)}
							</div>
						</div>
					</fieldset>

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
							disabled={hasBankErrors}
							className="inline-flex h-9 items-center rounded-md bg-cp-accent px-4 text-[13px] font-medium text-[var(--cp-accent-ink)] hover:opacity-90 disabled:cursor-not-allowed disabled:opacity-50 transition-opacity"
						>
							{editing ? "Guardar cambios" : "Crear"}
						</button>
					</div>
				</form>
			</div>
		</div>
	);
}
