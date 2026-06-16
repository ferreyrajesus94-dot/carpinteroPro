import { useState, type FormEvent } from "react";
import { useReferralCodes, useCreateReferralCode, useDeactivateReferralCode } from "../hooks/useReferrals";

interface CodesPanelProps {
	youtuberId: string;
	youtuberName: string;
}

export function CodesPanel({ youtuberId, youtuberName }: CodesPanelProps) {
	const { data, isLoading, isError } = useReferralCodes(youtuberId);
	const createMutation = useCreateReferralCode();
	const deactivateMutation = useDeactivateReferralCode();
	const [showCreate, setShowCreate] = useState(false);
	const [code, setCode] = useState("");
	const [discountPct, setDiscountPct] = useState("");
	const [commissionPct, setCommissionPct] = useState("");

	const codes = data?.codes ?? [];

	function handleCreate(e: FormEvent) {
		e.preventDefault();
		if (!code.trim() || !discountPct || !commissionPct) return;
		createMutation.mutate(
			{
				youtuberId,
				code: code.trim().toUpperCase(),
				discountPct: Number(discountPct),
				commissionPct: Number(commissionPct),
			},
			{
				onSuccess: () => {
					setShowCreate(false);
					setCode("");
					setDiscountPct("");
					setCommissionPct("");
				},
			},
		);
	}

	if (isLoading) {
		return (
			<div className="mt-3 animate-pulse space-y-2">
				<div className="h-4 w-32 rounded bg-cp-bg2" />
				<div className="h-3 w-48 rounded bg-cp-bg2" />
			</div>
		);
	}

	if (isError) {
		return (
			<p className="mt-3 text-xs text-destructive">
				Error al cargar códigos
			</p>
		);
	}

	return (
		<div className="mt-3 space-y-3">
			<div className="flex items-center justify-between">
				<h4 className="text-xs font-semibold uppercase tracking-wider text-ink3">
					Códigos de {youtuberName}
				</h4>
				{!showCreate && (
					<button
						type="button"
						onClick={() => setShowCreate(true)}
						className="text-[11px] font-medium text-cp-accent hover:underline"
					>
						+ Nuevo código
					</button>
				)}
			</div>

			{showCreate && (
				<form
					onSubmit={handleCreate}
					className="flex flex-wrap items-end gap-2 rounded-lg border border-line bg-cp-bg2 p-3"
				>
					<div className="flex-1 min-w-[100px]">
						<label className="block text-[10px] font-medium text-ink3">
							Código
						</label>
						<input
							type="text"
							value={code}
							onChange={(e) => setCode(e.target.value)}
							required
							className="mt-1 h-8 w-full rounded border border-line bg-cp-surface px-2 text-xs text-ink focus:border-cp-accent focus:outline-none"
							placeholder="PROMO20"
						/>
					</div>
					<div className="w-20">
						<label className="block text-[10px] font-medium text-ink3">
							Dto %
						</label>
						<input
							type="number"
							min="0"
							max="100"
							step="0.01"
							value={discountPct}
							onChange={(e) => setDiscountPct(e.target.value)}
							required
							className="mt-1 h-8 w-full rounded border border-line bg-cp-surface px-2 text-xs text-ink focus:border-cp-accent focus:outline-none"
							placeholder="20"
						/>
					</div>
					<div className="w-20">
						<label className="block text-[10px] font-medium text-ink3">
							Com % (opcional)
						</label>
						<input
							type="number"
							min="0"
							max="100"
							step="0.01"
							value={commissionPct}
							onChange={(e) => setCommissionPct(e.target.value)}
							required
							className="mt-1 h-8 w-full rounded border border-line bg-cp-surface px-2 text-xs text-ink focus:border-cp-accent focus:outline-none"
							placeholder="15"
						/>
					</div>
					<button
						type="submit"
						disabled={createMutation.isPending}
						className="inline-flex h-8 items-center rounded bg-cp-accent px-3 text-[11px] font-medium text-[var(--cp-accent-ink)] hover:opacity-90 disabled:opacity-50 transition-opacity"
					>
						{createMutation.isPending ? "..." : "Crear"}
					</button>
					<button
						type="button"
						onClick={() => setShowCreate(false)}
						className="inline-flex h-8 items-center rounded border border-line bg-cp-surface px-3 text-[11px] font-medium text-ink2 hover:bg-cp-bg2 transition-colors"
					>
						Cancelar
					</button>
				</form>
			)}

			{codes.length === 0 && !showCreate && (
				<p className="text-xs text-ink3">
					Sin códigos aún
				</p>
			)}

			{codes.length > 0 && (
				<div className="overflow-x-auto rounded-lg border border-line">
					<table className="w-full text-left text-xs">
						<thead>
							<tr className="border-b border-line bg-cp-bg2 text-[10px] font-semibold uppercase tracking-wider text-ink3">
								<th className="px-3 py-2">Código</th>
								<th className="px-3 py-2">Dto</th>
								<th className="px-3 py-2">Com</th>
								<th className="px-3 py-2">Activo</th>
								<th className="px-3 py-2">
									<span className="sr-only">Acciones</span>
								</th>
							</tr>
						</thead>
						<tbody className="divide-y divide-line">
							{codes.map((c) => (
								<tr key={c.id} className="bg-cp-surface">
									<td className="px-3 py-2 font-mono font-medium text-ink">
										{c.code}
									</td>
									<td className="px-3 py-2 text-ink2">{c.discountPct}%</td>
									<td className="px-3 py-2 text-ink2">{c.commissionPct}%</td>
									<td className="px-3 py-2">
										<span
											className={`rounded-full px-2 py-0.5 text-[10px] font-medium ${
												c.isActive
													? "bg-emerald-100 text-emerald-700"
													: "bg-red-100 text-red-700"
											}`}
										>
											{c.isActive ? "Sí" : "No"}
										</span>
									</td>
									<td className="px-3 py-2">
										{c.isActive && (
											<button
												type="button"
												onClick={() => deactivateMutation.mutate(c.id)}
												className="text-[10px] text-red-600 hover:underline"
											>
												Desactivar
											</button>
										)}
									</td>
								</tr>
							))}
						</tbody>
					</table>
				</div>
			)}
		</div>
	);
}
