import { Fragment, useState } from "react";
import {
	usePayoutHistory,
	useAdminPayoutPending,
	useMarkCommissionsPaid,
} from "../hooks/useReferrals";
import { formatARS, formatDate } from "../lib/format";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/shared/ui/table";

function PayoutsSkeleton() {
	return (
		<div role="status" aria-label="Cargando pagos" className="space-y-3">
			{Array.from({ length: 3 }).map((_, i) => (
				<div
					key={i}
					className="animate-pulse rounded-lg border border-line bg-cp-surface p-4"
				>
					<div className="mb-2 h-4 w-48 rounded bg-cp-bg2" />
					<div className="h-3 w-32 rounded bg-cp-bg2" />
				</div>
			))}
		</div>
	);
}

interface PayoutModalProps {
	open: boolean;
	onClose: () => void;
}

function PayoutModal({ open, onClose }: PayoutModalProps) {
	const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
	const [payoutReference, setPayoutReference] = useState("");
	const [notes, setNotes] = useState("");

	const pending = useAdminPayoutPending();
	const markPaid = useMarkCommissionsPaid();

	if (!open) return null;

	const youtubers = pending.data?.youtubers ?? [];

	function toggleCommission(id: string) {
		const next = new Set(selectedIds);
		if (next.has(id)) {
			next.delete(id);
		} else {
			next.add(id);
		}
		setSelectedIds(next);
	}

	function selectAll() {
		const allIds = new Set<string>();
		for (const yt of youtubers) {
			for (const c of yt.commissions) {
				allIds.add(c.id);
			}
		}
		setSelectedIds(allIds);
	}

	function deselectAll() {
		setSelectedIds(new Set());
	}

	async function handleConfirm() {
		if (selectedIds.size === 0 || !payoutReference.trim()) return;
		markPaid.mutate(
			{
				commissionIds: Array.from(selectedIds),
				payoutReference: payoutReference.trim(),
				notes: notes.trim() || undefined,
			},
			{
				onSuccess: () => {
					setSelectedIds(new Set());
					setPayoutReference("");
					setNotes("");
					onClose();
				},
			},
		);
	}

	return (
		<div
			role="dialog"
			aria-modal="true"
			aria-label="Nuevo pago"
			className="fixed inset-0 z-50 flex items-center justify-center bg-black/40"
			onClick={(e) => {
				if (e.target === e.currentTarget) onClose();
			}}
		>
			<div className="flex max-h-[80vh] w-full max-w-2xl flex-col rounded-xl border border-line bg-cp-surface shadow-lg">
				<div className="flex items-center justify-between border-b border-line px-6 py-4">
					<h2 className="font-display text-lg font-semibold text-ink">
						Nuevo pago
					</h2>
					<button
						type="button"
						onClick={onClose}
						className="text-ink3 hover:text-ink transition-colors"
						aria-label="Cerrar"
					>
						<i
							className="fi fi-rr-cross text-lg leading-none"
							aria-hidden="true"
						/>
					</button>
				</div>

				<div className="flex-1 overflow-y-auto px-6 py-4">
					{pending.isPending ? (
						<p className="text-sm text-ink2">
							Cargando comisiones pendientes...
						</p>
					) : youtubers.length === 0 ? (
						<p className="text-sm text-ink2">
							No hay comisiones pendientes para pagar.
						</p>
					) : (
						<div className="space-y-4">
							<div className="flex items-center gap-2 text-xs">
								<button
									type="button"
									onClick={selectAll}
									className="text-cp-accent hover:underline"
								>
									Seleccionar todas
								</button>
								<span className="text-ink3">·</span>
								<button
									type="button"
									onClick={deselectAll}
									className="text-cp-accent hover:underline"
								>
									Deseleccionar todas
								</button>
								<span className="ml-auto text-ink2">
									{selectedIds.size} seleccionadas
								</span>
							</div>

							{youtubers.map((yt) => (
								<div
									key={yt.youtuberId}
									className="rounded-lg border border-line bg-cp-bg2 p-3"
								>
									<div className="mb-2 flex items-center justify-between">
										<h3 className="text-sm font-medium text-ink">
											{yt.displayName}
										</h3>
										<span className="font-mono text-xs text-ink2">
											{formatARS(yt.totalPendingAmount)} · {yt.commissionCount}{" "}
											comisión
											{yt.commissionCount !== 1 ? "es" : ""}
										</span>
									</div>
									<div className="space-y-1">
										{yt.commissions.map((c) => (
											<label
												key={c.id}
												className="flex cursor-pointer items-center gap-2 rounded-md bg-cp-surface px-2 py-1.5 text-xs transition-colors hover:bg-cp-bg2"
											>
												<input
													type="checkbox"
													checked={selectedIds.has(c.id)}
													onChange={() => toggleCommission(c.id)}
													className="rounded border-line text-cp-accent focus:ring-cp-accent"
												/>
												<span className="flex-1">
													{formatDate(c.occurredAt)}
												</span>
												<span className="font-mono text-ink">
													{formatARS(c.commissionAmount)}
												</span>
												{c.workshopName && (
													<span className="text-ink3">{c.workshopName}</span>
												)}
											</label>
										))}
									</div>
								</div>
							))}
						</div>
					)}
				</div>

				<div className="border-t border-line px-6 py-4">
					<div className="mb-3 space-y-2">
						<div>
							<label
								htmlFor="payout-reference"
								className="block text-xs font-medium text-ink2"
							>
								Referencia de transferencia *
							</label>
							<input
								id="payout-reference"
								type="text"
								value={payoutReference}
								onChange={(e) => setPayoutReference(e.target.value)}
								placeholder="TRANSFER-123"
								className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
							/>
						</div>
						<div>
							<label
								htmlFor="payout-notes"
								className="block text-xs font-medium text-ink2"
							>
								Notas (opcional)
							</label>
							<input
								id="payout-notes"
								type="text"
								value={notes}
								onChange={(e) => setNotes(e.target.value)}
								placeholder="Pago mensual Feb 2026"
								className="mt-1 h-9 w-full rounded-lg border border-line bg-cp-bg2 px-3 text-[13.5px] text-ink placeholder:text-ink3 focus:border-cp-accent focus:outline-none focus:ring-1 focus:ring-cp-accent"
							/>
						</div>
					</div>
					<div className="flex items-center justify-end gap-2">
						<button
							type="button"
							onClick={onClose}
							className="inline-flex h-9 items-center rounded-md border border-line bg-cp-surface px-4 text-[13px] font-medium text-ink2 hover:bg-cp-bg2 transition-colors"
						>
							Cancelar
						</button>
						<button
							type="button"
							onClick={handleConfirm}
							disabled={
								selectedIds.size === 0 ||
								!payoutReference.trim() ||
								markPaid.isPending
							}
							className="inline-flex h-9 items-center rounded-md bg-cp-accent px-4 text-[13px] font-medium text-[var(--cp-accent-ink)] hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
						>
							{markPaid.isPending ? "Procesando..." : "Confirmar pago"}
						</button>
					</div>
				</div>
			</div>
		</div>
	);
}

export function PayoutsTab() {
	const [modalOpen, setModalOpen] = useState(false);
	const [expandedRunId, setExpandedRunId] = useState<string | null>(null);

	const history = usePayoutHistory();
	const runs = history.data?.payoutRuns ?? [];

	if (history.isPending) return <PayoutsSkeleton />;

	if (history.isError) {
		return (
			<section
				role="alert"
				aria-label="Error al cargar pagos"
				className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
			>
				<i
					className="fi fi-rr-exclamation-circle mb-3 block text-2xl text-destructive"
					aria-hidden="true"
				/>
				<h2 className="font-display text-lg font-semibold text-ink">
					No se pudieron cargar los pagos
				</h2>
				<p className="mt-1 text-sm text-ink2">
					{history.error instanceof Error
						? history.error.message
						: "Error desconocido"}
				</p>
			</section>
		);
	}

	return (
		<div className="space-y-4">
			<header className="flex flex-wrap items-center justify-between gap-2">
				<div>
					<h2 className="font-display text-xl font-semibold tracking-tight text-ink">
						Historial de pagos
					</h2>
					<p className="text-xs text-ink3">
						{runs.length} pago{runs.length !== 1 ? "s" : ""} registrado
						{runs.length !== 1 ? "s" : ""}
					</p>
				</div>
				<button
					type="button"
					onClick={() => setModalOpen(true)}
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-cp-surface px-3 text-xs font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
				>
					<i
						className="fi fi-rr-money-bill-wave text-sm leading-none"
						aria-hidden="true"
					/>
					Nuevo pago
				</button>
			</header>

			{runs.length === 0 ? (
				<section className="rounded-xl border border-line bg-cp-surface p-8 text-center">
					<i
						className="fi fi-rr-inbox-out mb-3 block text-3xl text-ink3"
						aria-hidden="true"
					/>
					<p className="text-sm font-medium text-ink2">
						No hay pagos registrados
					</p>
					<p className="mt-1 text-xs text-ink3">
						Los pagos aparecen aquí cuando marcas comisiones como pagadas.
					</p>
				</section>
			) : (
				<div className="overflow-hidden rounded-xl border border-line">
					<Table aria-label="Historial de pagos">
						<TableHeader>
							<TableRow>
								<TableHead className="w-8" />
								<TableHead>Fecha</TableHead>
								<TableHead className="text-right">Total</TableHead>
								<TableHead className="text-right">Comisiones</TableHead>
								<TableHead>Referencia</TableHead>
								<TableHead>Admin</TableHead>
								<TableHead>Notas</TableHead>
							</TableRow>
						</TableHeader>
						<TableBody>
							{runs.map((run) => {
								const isExpanded = expandedRunId === run.id;
								return (
									<Fragment key={run.id}>
										<TableRow
											tabIndex={0}
											aria-expanded={isExpanded}
											className="cursor-pointer"
											onClick={() =>
												setExpandedRunId(isExpanded ? null : run.id)
											}
											onKeyDown={(e) => {
												if (e.key === "Enter" || e.key === " ") {
													e.preventDefault();
													setExpandedRunId(isExpanded ? null : run.id);
												}
											}}
										>
											<TableCell>
												<i
													className={`fi fi-rr-${isExpanded ? "chevron-down" : "chevron-right"} text-xs text-ink3 transition-transform`}
													aria-hidden="true"
												/>
											</TableCell>
											<TableCell className="whitespace-nowrap">
												{formatDate(run.createdAt)}
											</TableCell>
											<TableCell className="text-right font-mono text-xs text-ink">
												{formatARS(run.totalAmount)}
											</TableCell>
											<TableCell className="text-right text-xs text-ink2">
												{run.commissionCount}
											</TableCell>
											<TableCell className="font-mono text-xs text-ink2">
												{run.reference ?? "—"}
											</TableCell>
											<TableCell className="text-xs text-ink2">
												{run.createdBy ?? "—"}
											</TableCell>
											<TableCell className="text-xs text-ink3">
												{run.notes ?? "—"}
											</TableCell>
										</TableRow>
										{isExpanded && (
											<TableRow key={`${run.id}-expanded`}>
												<TableCell colSpan={7} className="bg-cp-bg2/30">
													<div className="space-y-1">
														{run.commissions.length === 0 ? (
															<p className="text-xs text-ink3">
																No hay comisiones en este pago.
															</p>
														) : (
															<table className="w-full text-xs">
																<thead>
																	<tr className="text-ink3">
																		<th className="py-1 pr-4 text-left font-medium">
																			YouTuber
																		</th>
																		<th className="py-1 pr-4 text-left font-medium">
																			Taller
																		</th>
																		<th className="py-1 text-right font-medium">
																			Monto
																		</th>
																	</tr>
																</thead>
																<tbody>
																	{run.commissions.map((c) => (
																		<tr key={c.id} className="text-ink2">
																			<td className="py-1 pr-4">
																				{c.youtuberName ?? "—"}
																			</td>
																			<td className="py-1 pr-4">
																				{c.workshopName ?? "—"}
																			</td>
																			<td className="py-1 text-right font-mono text-ink">
																				{formatARS(c.commissionAmount)}
																			</td>
																		</tr>
																	))}
																</tbody>
															</table>
														)}
													</div>
												</TableCell>
											</TableRow>
										)}
									</Fragment>
								);
							})}
						</TableBody>
					</Table>
				</div>
			)}

			<PayoutModal open={modalOpen} onClose={() => setModalOpen(false)} />
		</div>
	);
}
