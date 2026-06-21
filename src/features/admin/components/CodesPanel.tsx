import { useState, type FormEvent } from "react";
import { useReferralCodes, useCreateReferralCode, useDeactivateReferralCode } from "../hooks/useReferrals";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";
import { EmptyState, ErrorState } from "@/shared/ui/feedback-state";
import { cn } from "@/shared/lib/utils";

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
			<div
				role="status"
				aria-label="Cargando códigos"
				className="mt-3 animate-pulse space-y-2"
			>
				<div className="h-4 w-32 rounded bg-cp-bg2" />
				<div className="h-3 w-48 rounded bg-cp-bg2" />
			</div>
		);
	}

	if (isError) {
		return <ErrorState title="Error al cargar códigos" />;
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
				<EmptyState variant="empty-feature" title="Sin códigos aún" />
			)}

			{codes.length > 0 && (
				<div className="overflow-hidden rounded-lg border border-line">
					<Table>
						<TableHeader>
							<TableRow>
								<TableHead>Código</TableHead>
								<TableHead>Dto</TableHead>
								<TableHead>Com</TableHead>
								<TableHead>Activo</TableHead>
								<TableHead>
									<span className="sr-only">Acciones</span>
								</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{codes.map((c) => (
								<TableRow key={c.id}>
									<TableCell className="font-mono font-medium text-ink">
										{c.code}
									</TableCell>
									<TableCell className="text-ink2">{c.discountPct}%</TableCell>
									<TableCell className="text-ink2">{c.commissionPct}%</TableCell>
									<TableCell>
										<span
											className={cn(
												"rounded-full px-2.5 py-0.5 text-[11px] font-medium",
												c.isActive ? "chip-success" : "chip-danger",
											)}
										>
											{c.isActive ? "Sí" : "No"}
										</span>
									</TableCell>
									<TableCell>
										{c.isActive && (
											<button
												type="button"
												onClick={() => deactivateMutation.mutate(c.id)}
												className="text-[11px] text-red-600 hover:underline"
											>
												Desactivar
											</button>
										)}
									</TableCell>
								</TableRow>
							))}
						</TableBody>
					</Table>
				</div>
			)}
		</div>
	);
}
