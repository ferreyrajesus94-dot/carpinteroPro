import { useState } from "react";
import {
	useAdminYoutubers,
	useCreateYoutuber,
	useToggleYoutuber,
} from "../hooks/useReferrals";
import { YoutuberDialog } from "./YoutuberDialog";
import { CodesPanel } from "./CodesPanel";
import { useSort } from "../lib/useSort";
import { cn } from "@/shared/lib/utils";
import { ConfirmDialog } from "@/shared/components/ConfirmDialog";
import type { CreateYoutuberRequest, YoutuberSummary } from "../types";

type TabId = "youtubers";

const TABS: { id: TabId; label: string }[] = [
	{ id: "youtubers", label: "Youtubers" },
];

function formatARS(amount: number): string {
	return new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
		minimumFractionDigits: 2,
		maximumFractionDigits: 2,
	}).format(amount);
}

function YoutubersSkeleton() {
	return (
		<div role="status" aria-label="Cargando youtubers" className="space-y-3">
			{Array.from({ length: 3 }).map((_, i) => (
				<div
					key={i}
					className="animate-pulse rounded-lg border border-line bg-cp-surface p-4"
				>
					<div className="mb-2 h-4 w-40 rounded bg-cp-bg2" />
					<div className="h-3 w-56 rounded bg-cp-bg2" />
				</div>
			))}
		</div>
	);
}

function YoutubersTab() {
	const [dialogOpen, setDialogOpen] = useState(false);
	const [editing, setEditing] = useState<YoutuberSummary | null>(null);
	const [expandedYoutuberId, setExpandedYoutuberId] = useState<string | null>(
		null,
	);
	const [confirmToggleId, setConfirmToggleId] = useState<string | null>(null);

	const youtubers = useAdminYoutubers();
	const createMutation = useCreateYoutuber();
	const toggleMutation = useToggleYoutuber();

	const data = youtubers.data?.youtubers ?? [];
	const { sorted } = useSort(
		data,
		"displayName",
		"asc",
	);
	const lastUpdated = youtubers.dataUpdatedAt
		? new Date(youtubers.dataUpdatedAt).toLocaleTimeString("es-AR", {
				hour: "2-digit",
				minute: "2-digit",
			})
		: null;
	const youtuberPendingDeactivation = confirmToggleId
		? (data.find((y) => y.id === confirmToggleId) ?? null)
		: null;

	function handleCreate(input: CreateYoutuberRequest) {
		createMutation.mutate(input, {
			onSuccess: () => {
				setDialogOpen(false);
				setEditing(null);
			},
		});
	}

	function handleConfirmToggle() {
		if (!confirmToggleId) return;
		const yt = data.find((y) => y.id === confirmToggleId);
		if (!yt) return;
		toggleMutation.mutate(
			{ id: confirmToggleId, isActive: !yt.isActive },
			{ onSuccess: () => setConfirmToggleId(null) },
		);
	}

	if (youtubers.isPending) return <YoutubersSkeleton />;

	if (youtubers.isError) {
		return (
			<section
				role="alert"
				aria-label="Error al cargar youtubers"
				className="rounded-xl border border-destructive/20 bg-destructive/5 p-6 text-center"
			>
				<i
					className="fi fi-rr-exclamation-circle mb-3 block text-2xl text-destructive"
					aria-hidden="true"
				/>
				<h2 className="font-display text-lg font-semibold text-ink">
					No se pudieron cargar los youtubers
				</h2>
				<p className="mt-1 text-sm text-ink2">
					{youtubers.error instanceof Error
						? youtubers.error.message
						: "Error desconocido"}
				</p>
			</section>
		);
	}

	return (
		<div className="space-y-4">
			<header className="flex flex-wrap items-baseline justify-between gap-2">
				<div>
					<h2 className="font-display text-xl font-semibold tracking-tight text-ink">
						Youtubers
					</h2>
					<p className="text-xs text-ink3">
						{data.length} youtuber{data.length !== 1 ? "es" : ""}
						{lastUpdated && ` · Actualizado ${lastUpdated}`}
					</p>
				</div>
				<button
					type="button"
					onClick={() => {
						setEditing(null);
						setDialogOpen(true);
					}}
					className="inline-flex h-8 items-center gap-1.5 rounded-md border border-line bg-cp-surface px-3 text-xs font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink transition-colors"
				>
					<i
						className="fi fi-rr-user-add text-sm leading-none"
						aria-hidden="true"
					/>
					Crear YouTuber
				</button>
			</header>

			{data.length === 0 ? (
				<section className="rounded-xl border border-line bg-cp-surface p-8 text-center">
					<i
						className="fi fi-rr-megaphone mb-3 block text-3xl text-ink3"
						aria-hidden="true"
					/>
					<p className="text-sm font-medium text-ink2">
						No se encontraron youtubers
					</p>
					<p className="mt-1 text-xs text-ink3">
						Aún no hay youtubers registrados en la plataforma
					</p>
				</section>
			) : (
				<div className="space-y-3">
					{sorted.map((yt) => {
						const isExpanded = expandedYoutuberId === yt.id;
						return (
							<div
								key={yt.id}
								className="rounded-xl border border-line bg-cp-surface"
							>
								<div
									className="flex cursor-pointer items-center justify-between px-4 py-3 transition-colors hover:bg-cp-bg2"
									onClick={() =>
										setExpandedYoutuberId(isExpanded ? null : yt.id)
									}
									role="button"
									tabIndex={0}
									onKeyDown={(e) => {
										if (e.key === "Enter" || e.key === " ") {
											setExpandedYoutuberId(isExpanded ? null : yt.id);
										}
									}}
									aria-expanded={isExpanded}
								>
									<div className="flex items-center gap-3">
										<div>
											<p className="font-medium text-ink">{yt.displayName}</p>
											{yt.contactEmail && (
												<p className="text-xs text-ink2">{yt.contactEmail}</p>
											)}
										</div>
									</div>
									<div className="flex items-center gap-4 text-xs text-ink2">
										<span>
											<strong className="text-ink">{yt.codeCount}</strong>{" "}
											códigos
										</span>
										<span>
											<strong className="text-ink">
												{yt.activeReferredWorkshops}
											</strong>{" "}
											talleres
										</span>
										<span className="font-mono text-ink">
											{formatARS(yt.lifetimeCommission)}
										</span>
										<div className="flex items-center gap-2">
											<button
													type="button"
													onClick={(e) => {
														e.stopPropagation();
														if (yt.isActive) {
															setConfirmToggleId(yt.id);
															return;
														}
														toggleMutation.mutate({ id: yt.id, isActive: true });
													}}
													className={`text-[11px] font-medium transition-colors ${
														yt.isActive
															? "text-red-600 hover:underline"
															: "text-emerald-600 hover:underline"
													}`}
													aria-label={
														yt.isActive
															? `Desactivar ${yt.displayName}`
															: `Activar ${yt.displayName}`
													}
												>
													{yt.isActive ? "Desactivar" : "Activar"}
												</button>
											<button
												type="button"
												onClick={(e) => {
													e.stopPropagation();
													setEditing(yt);
													setDialogOpen(true);
												}}
												className="text-[11px] text-cp-accent hover:underline"
											>
												Editar
											</button>
										</div>
									</div>
								</div>

								{isExpanded && (
									<div className="border-t border-line px-4 py-3">
										<CodesPanel
											youtuberId={yt.id}
											youtuberName={yt.displayName}
										/>
									</div>
								)}
							</div>
						);
					})}
				</div>
			)}

			<YoutuberDialog
				open={dialogOpen}
				onClose={() => {
					setDialogOpen(false);
					setEditing(null);
				}}
				onSubmit={handleCreate}
				editing={editing}
			/>
			<ConfirmDialog
				open={Boolean(youtuberPendingDeactivation)}
				onOpenChange={(open) => {
					if (!open) setConfirmToggleId(null);
				}}
				title="Desactivar este YouTuber?"
				description="Los códigos nuevos no podrán usarlo."
				onConfirm={handleConfirmToggle}
				confirmLabel="Desactivar"
				isPending={toggleMutation.isPending}
			/>
		</div>
	);
}

export function ReferidosPage() {
	const [activeTab, setActiveTab] = useState<TabId>("youtubers");

	return (
		<div className="space-y-4">
			<div className="flex items-center gap-1 border-b border-line">
				{TABS.map((tab) => (
					<button
						key={tab.id}
						type="button"
						onClick={() => setActiveTab(tab.id)}
						className={cn(
							"px-4 py-2.5 text-sm font-medium transition-colors border-b-2 -mb-px",
							activeTab === tab.id
								? "border-cp-accent text-ink"
								: "border-transparent text-ink3 hover:text-ink hover:border-ink3/30",
						)}
					>
						{tab.label}
					</button>
				))}
			</div>

			{activeTab === "youtubers" && <YoutubersTab />}
		</div>
	);
}
