import { useMemo } from "react";
import { ChevronRight, Loader2, SearchX } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import { SearchResultItem } from "./SearchResultItem";
import type { SearchHit, SearchResults } from "../types";

interface Props {
	query: string;
	results: SearchResults;
	isLoading: boolean;
	isRefreshing: boolean;
	isError: boolean;
	activeIndex: number;
	onHoverIndex: (index: number) => void;
	onSelect: (hit: SearchHit) => void;
	onNavigateAll: () => void;
	containerId: string;
}

interface Section {
	key: keyof Omit<SearchResults, "total">;
	label: string;
}

const SECTIONS: Section[] = [
	{ key: "clients", label: "Clientes" },
	{ key: "quotes", label: "Presupuestos" },
	{ key: "materials", label: "Materiales" },
	{ key: "furniture", label: "Muebles" },
];

export function SearchResultsPanel({
	query,
	results,
	isLoading,
	isRefreshing,
	isError,
	activeIndex,
	onHoverIndex,
	onSelect,
	onNavigateAll,
	containerId,
}: Props) {
	// Pre-compute the global index offset for each section so we can map a flat
	// parent index to a section-relative index without mutating a counter at
	// render time.
	const sectionOffsets = useMemo(() => {
		const offsets: Partial<Record<Section["key"], number>> = {};
		let offset = 0;
		for (const section of SECTIONS) {
			offsets[section.key] = offset;
			offset += results[section.key].length;
		}
		return offsets;
	}, [results]);

	if (isLoading) {
		return (
			<div
				id={containerId}
				role="listbox"
				aria-busy="true"
				className="absolute top-full left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-lg border border-line bg-cp-surface shadow-lg"
			>
				<div className="flex items-center gap-2 px-4 py-3 text-[13px] text-ink2">
					<Loader2 size={14} className="animate-spin text-ink3" />
					Buscando…
				</div>
			</div>
		);
	}

	if (isError) {
		return (
			<div
				id={containerId}
				role="listbox"
				className="absolute top-full left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-lg border border-line bg-cp-surface shadow-lg"
			>
				<div className="px-4 py-3 text-[13px] text-ink2">
					No pudimos buscar ahora. Probá de nuevo en unos segundos.
				</div>
			</div>
		);
	}

	if (results.total === 0) {
		return (
			<div
				id={containerId}
				role="listbox"
				className="absolute top-full left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-lg border border-line bg-cp-surface shadow-lg"
			>
				<div className="flex items-center gap-2 px-4 py-3 text-[13px] text-ink2">
					<SearchX size={14} className="text-ink3" />
					Sin resultados para “{query}”
				</div>
			</div>
		);
	}

	return (
		<div className="absolute top-full left-0 right-0 z-50 mt-1.5 overflow-hidden rounded-lg border border-line bg-cp-surface shadow-lg">
			{isRefreshing ? (
				<div
					aria-live="polite"
					className="flex items-center gap-2 border-b border-line bg-cp-bg2/40 px-3 py-1.5 text-[11.5px] text-ink2"
				>
					<Loader2 size={11} className="animate-spin text-ink3" />
					Actualizando…
				</div>
			) : null}
			<div
				id={containerId}
				role="listbox"
				className="max-h-[60vh] overflow-y-auto p-1.5"
			>
				{SECTIONS.map((section) => {
					const items = results[section.key];
					if (items.length === 0) return null;
					const sectionStart = sectionOffsets[section.key] ?? 0;
					return (
						<div key={section.key} className="mb-1.5 last:mb-0">
							<div className="px-3 pb-1 pt-1.5 text-[10.5px] font-medium uppercase tracking-[0.08em] text-ink3">
								{section.label}
								<span className="ml-1.5 text-ink3/70">· {items.length}</span>
							</div>
							<div className="space-y-0.5">
								{items.map((hit, idx) => {
									const globalIndex = sectionStart + idx;
									const isActive = globalIndex === activeIndex;
									return (
										<SearchResultItem
											key={`${hit.entity}-${hit.id}`}
											hit={hit}
											active={isActive}
											onSelect={onSelect}
											onMouseEnter={() => onHoverIndex(globalIndex)}
										/>
									);
								})}
							</div>
						</div>
					);
				})}
			</div>
			<div className="border-t border-line bg-cp-bg2/40 px-2 py-1.5">
				<button
					type="button"
					onClick={onNavigateAll}
					className={cn(
						"flex w-full items-center justify-between rounded-md px-2 py-1.5 text-[12.5px] text-ink2 transition-colors",
						"hover:bg-cp-bg2 hover:text-ink focus:outline-none focus-ring",
					)}
				>
					<span>Ver todos los resultados</span>
					<ChevronRight size={14} />
				</button>
			</div>
		</div>
	);
}
