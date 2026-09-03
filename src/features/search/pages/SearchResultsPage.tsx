import { useCallback, useEffect, useMemo, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { Loader2, Search, SearchX, X } from "lucide-react";
import { useAuth } from "@/shared/providers/AuthProvider";
import { PageHeader } from "@/shared/ui/page-header";
import { Eyebrow } from "@/shared/ui/eyebrow";
import { Button } from "@/shared/ui/button";
import {
	ErrorState,
	LoadingState,
	EmptyState,
} from "@/shared/ui/feedback-state";
import { cn } from "@/shared/lib/utils";
import { SearchResultItem } from "../components/SearchResultItem";
import { useGlobalSearch } from "../hooks/useGlobalSearch";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import type { SearchEntity } from "../types";

type FilterValue = SearchEntity | "all";

const ENTITY_FILTERS: { value: FilterValue; label: string }[] = [
	{ value: "all", label: "Todos" },
	{ value: "clients", label: "Clientes" },
	{ value: "quotes", label: "Presupuestos" },
	{ value: "materials", label: "Materiales" },
	{ value: "furniture", label: "Muebles" },
];

const SECTION_ORDER: SearchEntity[] = [
	"clients",
	"quotes",
	"materials",
	"furniture",
];

function sectionOf(entity: SearchEntity) {
	switch (entity) {
		case "clients":
			return "Clientes";
		case "quotes":
			return "Presupuestos";
		case "materials":
			return "Materiales";
		case "furniture":
			return "Muebles";
	}
}

function isFilterValue(v: string | null): v is FilterValue {
	return (
		v === "all" ||
		v === "clients" ||
		v === "quotes" ||
		v === "materials" ||
		v === "furniture"
	);
}

export function SearchResultsPage() {
	const [params, setParams] = useSearchParams();
	const urlQuery = params.get("q") ?? "";
	const filterParam = params.get("filter");
	const filter: FilterValue = isFilterValue(filterParam) ? filterParam : "all";

	// Local input state is the source of truth for the search field. We mirror
	// it to the URL once the user stops typing (debounced). This keeps the
	// address bar in sync without triggering a query refetch on every keystroke.
	const [draftQuery, setDraftQuery] = useState(urlQuery);
	const debouncedDraft = useDebouncedValue(draftQuery, 250);

	// Bidirectional sync between local input state and the URL ?q= param,
	// coordinated by the existing values rather than a shared "last synced"
	// ref. Both branches self-skip when the other side is already in sync,
	// so there is no race when an external URL change happens during a
	// debounce in flight.
	//
	// 1. URL → input (render-phase, React 19 "adjusting state to a prop"
	//    pattern). Runs immediately when `urlQuery` changes from outside
	//    (back/forward / address bar / link).
	// 2. Input → URL (`useEffect` because setParams performs a router
	//    navigation that React explicitly warns against during render). We
	//    skip the write when the user is mid-typing (draftQuery !=
	//    debouncedDraft) so a stale debounce still in flight does not
	//    overwrite an external URL change.
	if (urlQuery !== debouncedDraft && urlQuery !== draftQuery) {
		setDraftQuery(urlQuery);
	}
	useEffect(() => {
		// Clear the URL immediately when the user empties the field, so the
		// empty state and the URL stay in sync without waiting for the
		// debounce (which is intended for typing, not for clearing).
		if (draftQuery === "" && urlQuery !== "") {
			setParams(
				(prev) => {
					const next = new URLSearchParams(prev);
					next.delete("q");
					return next;
				},
				{ replace: true },
			);
			return;
		}
		// User is still typing: wait for the debounce to catch up.
		if (draftQuery !== debouncedDraft) return;
		// Debounce has caught up and the URL is already in sync: nothing to do.
		if (debouncedDraft === urlQuery) return;
		setParams(
			(prev) => {
				const next = new URLSearchParams(prev);
				if (debouncedDraft.length === 0) {
					next.delete("q");
				} else {
					next.set("q", debouncedDraft);
				}
				return next;
			},
			{ replace: true },
		);
	}, [debouncedDraft, draftQuery, urlQuery, setParams]);

	const trimmedDraft = draftQuery.trim();
	const hasQuery = trimmedDraft.length >= 2;
	const debouncedHasQuery = debouncedDraft.trim().length >= 2;

	const auth = useAuth();
	const workshopId = auth.workshopId;

	const { data, isLoading, isError, isFetching, refetch } = useGlobalSearch(
		workshopId,
		debouncedDraft.trim(),
		"page",
	);
	const results = useMemo(
		() =>
			data ?? {
				clients: [],
				quotes: [],
				materials: [],
				furniture: [],
				total: 0,
			},
		[data],
	);

	const handleFilterChange = useCallback(
		(next: FilterValue) => {
			setParams(
				(prev) => {
					const newParams = new URLSearchParams(prev);
					if (next === "all") {
						newParams.delete("filter");
					} else {
						newParams.set("filter", next);
					}
					return newParams;
				},
				{ replace: true },
			);
		},
		[setParams],
	);

	const isBusy = isLoading || isFetching;
	const showResults = hasQuery && debouncedHasQuery && !isError;

	return (
		<div className="space-y-5 p-4 md:p-6">
			<PageHeader title="Buscar" />

			<div className="relative">
				<Search
					size={15}
					className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink3"
					aria-hidden="true"
				/>
				<input
					type="search"
					role="searchbox"
					aria-label="Buscar en tu taller"
					placeholder="Buscar clientes, presupuestos, materiales o muebles…"
					autoComplete="off"
					spellCheck={false}
					value={draftQuery}
					onChange={(e) => setDraftQuery(e.target.value)}
					className={cn(
						"h-11 w-full rounded-md border border-line bg-cp-bg2 pl-10 text-[14px] text-ink",
						"placeholder:text-ink3 focus:outline-none focus:border-accent",
						draftQuery ? "pr-11" : "pr-4",
					)}
				/>
				{draftQuery ? (
					<button
						type="button"
						onClick={() => setDraftQuery("")}
						aria-label="Limpiar búsqueda"
						className="absolute right-2 top-1/2 grid h-7 w-7 -translate-y-1/2 place-items-center rounded-sm text-ink3 transition-colors hover:bg-cp-bg2 hover:text-ink focus:outline-none focus-ring"
					>
						<X size={14} />
					</button>
				) : null}
			</div>

			{!hasQuery ? (
				<EmptyState
					variant="empty-feature"
					title="Empezá a escribir"
					description="Buscá clientes, presupuestos, materiales o muebles de tu taller."
				/>
			) : isError ? (
				<ErrorState
					title="No pudimos buscar"
					description="Hubo un problema al consultar tu taller. Probá de nuevo en unos segundos."
					action={
						<Button onClick={() => refetch()} variant="outline" size="sm">
							Reintentar
						</Button>
					}
				/>
			) : null}

			{showResults ? (
				<>
					<p aria-live="polite" className="text-[12px] text-ink3">
						{isBusy && results.total === 0
							? `Buscando “${debouncedDraft.trim()}”…`
							: `${results.total} resultado${results.total === 1 ? "" : "s"} para “${debouncedDraft.trim()}”`}
					</p>

					<div className="flex flex-wrap items-center gap-1.5 rounded-lg border border-line bg-cp-surface p-1.5">
						{ENTITY_FILTERS.map((f) => {
							const count =
								f.value === "all" ? results.total : results[f.value].length;
							const isActive = filter === f.value;
							return (
								<button
									key={f.value}
									type="button"
									onClick={() => handleFilterChange(f.value)}
									aria-pressed={isActive}
									className={cn(
										"rounded-md px-3 py-1.5 text-[12.5px] font-medium transition-colors",
										isActive
											? "bg-cp-accent-soft text-cp-accent"
											: "text-ink2 hover:bg-cp-bg2 hover:text-ink",
									)}
								>
									{f.label}
									{count > 0 ? (
										<span className="ml-1.5 rounded-sm bg-cp-bg2 px-1.5 py-0.5 font-mono text-[10px] text-ink3">
											{count}
										</span>
									) : null}
								</button>
							);
						})}
					</div>
				</>
			) : null}

			{showResults && isBusy && results.total === 0 ? (
				<LoadingState label="Buscando…" />
			) : showResults && results.total === 0 ? (
				<div className="rounded-xl border border-line bg-surface px-5 py-10 text-center">
					<div className="mx-auto mb-3 flex h-10 w-10 items-center justify-center rounded-full bg-cp-bg2 text-ink2">
						<SearchX size={18} />
					</div>
					<p className="text-[14px] font-medium text-ink">
						Sin resultados para “{debouncedDraft.trim()}”
					</p>
					<p className="mt-1 text-[12.5px] text-ink3">
						Probá con otro término o cambiá el filtro.
					</p>
				</div>
			) : showResults ? (
				<div className="space-y-4">
					{SECTION_ORDER.filter(
						(key) => filter === "all" || filter === key,
					).map((key) => {
						const items = results[key];
						if (items.length === 0) return null;
						return (
							<section
								key={key}
								className="rounded-xl border border-line bg-surface"
							>
								<div className="border-b border-line px-5 py-3">
									<Eyebrow as="h2" variant="mono">
										{sectionOf(key)}
										<span className="ml-1.5 text-ink3/70">
											· {items.length}
										</span>
									</Eyebrow>
								</div>
								<div className="p-1.5">
									{items.map((hit) => (
										<SearchResultItem
											key={`${hit.entity}-${hit.id}`}
											hit={hit}
											active={false}
										/>
									))}
								</div>
							</section>
						);
					})}
				</div>
			) : null}

			{showResults && isBusy && results.total > 0 ? (
				<div
					aria-live="polite"
					className="flex items-center justify-center gap-2 py-2 text-[12.5px] text-ink3"
				>
					<Loader2 size={12} className="animate-spin" />
					Actualizando…
				</div>
			) : null}
		</div>
	);
}
