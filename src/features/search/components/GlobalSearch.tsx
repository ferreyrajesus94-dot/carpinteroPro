import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useNavigate } from "react-router-dom";
import { Search, X } from "lucide-react";
import { useAuth } from "@/shared/providers/AuthProvider";
import { cn } from "@/shared/lib/utils";
import { SearchResultsPanel } from "./SearchResultsPanel";
import { useGlobalSearch } from "../hooks/useGlobalSearch";
import { flattenResults, hitKey } from "../lib/hitKey";
import { useDebouncedValue } from "../lib/useDebouncedValue";
import type { SearchHit } from "../types";

const MIN_QUERY_LENGTH = 2;
const PANEL_ID = "global-search-panel";
const DEBOUNCE_MS = 250;

function isMacPlatform(): boolean {
	if (typeof navigator === "undefined") return false;
	const ua = navigator.userAgent;
	return /Mac|iPhone|iPad|iPod/.test(ua);
}

export function GlobalSearch() {
	const navigate = useNavigate();
	const auth = useAuth();
	const workshopId = auth.workshopId;

	const [query, setQuery] = useState("");
	const [open, setOpen] = useState(false);
	const [activeIndex, setActiveIndex] = useState(0);

	const inputRef = useRef<HTMLInputElement>(null);
	const containerRef = useRef<HTMLDivElement>(null);

	const trimmed = query.trim();
	const debouncedQuery = useDebouncedValue(trimmed, DEBOUNCE_MS);
	// meetsMin is based on the immediate input so the panel closes the
	// instant the user clears the field, even before the debounce fires.
	const meetsMin = trimmed.length >= MIN_QUERY_LENGTH;

	const { data, isLoading, isError, isFetching, refetch } = useGlobalSearch(
		workshopId,
		debouncedQuery,
		"dropdown",
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

	const flatHits = useMemo(() => flattenResults(results), [results]);
	const safeIndex = Math.min(activeIndex, Math.max(0, flatHits.length - 1));
	const activeKey =
		flatHits[safeIndex] !== undefined ? hitKey(flatHits[safeIndex]) : null;

	// Close on outside pointerdown OR focus moving outside the container
	useEffect(() => {
		function handleMouseDown(event: MouseEvent) {
			if (!containerRef.current) return;
			if (!containerRef.current.contains(event.target as Node)) {
				setOpen(false);
			}
		}
		function handleFocusOut(event: FocusEvent) {
			if (!containerRef.current) return;
			const next = event.relatedTarget as Node | null;
			if (!next || !containerRef.current.contains(next)) {
				setOpen(false);
			}
		}
		document.addEventListener("mousedown", handleMouseDown);
		const node = containerRef.current;
		node?.addEventListener("focusout", handleFocusOut);
		return () => {
			document.removeEventListener("mousedown", handleMouseDown);
			node?.removeEventListener("focusout", handleFocusOut);
		};
	}, []);

	const handleSelect = useCallback(
		(hit: SearchHit) => {
			setOpen(false);
			setQuery("");
			setActiveIndex(0);
			inputRef.current?.blur();
			navigate(hit.href);
		},
		[navigate],
	);

	const handleNavigateAll = useCallback(() => {
		setOpen(false);
		setActiveIndex(0);
		const params = new URLSearchParams({ q: debouncedQuery });
		navigate(`/buscar?${params.toString()}`);
	}, [navigate, debouncedQuery]);

	const handleClear = useCallback(() => {
		setQuery("");
		setActiveIndex(0);
		inputRef.current?.focus();
	}, []);

	// Cmd/Ctrl+K to focus, "/" to quick-focus, Esc/arrows/Enter for nav
	useEffect(() => {
		function handleKeyDown(event: KeyboardEvent) {
			const isMod = event.metaKey || event.ctrlKey;
			if (isMod && event.key.toLowerCase() === "k") {
				event.preventDefault();
				inputRef.current?.focus();
				setOpen(true);
				return;
			}
			if (event.key === "/" && document.activeElement === document.body) {
				event.preventDefault();
				inputRef.current?.focus();
				setOpen(true);
				return;
			}
			if (!open || !meetsMin) return;
			if (event.key === "Escape") {
				event.preventDefault();
				setOpen(false);
				inputRef.current?.blur();
				return;
			}
			if (flatHits.length === 0) return;
			if (event.key === "ArrowDown" || event.key === "ArrowUp") {
				event.preventDefault();
				const delta = event.key === "ArrowDown" ? 1 : -1;
				const next = (safeIndex + delta + flatHits.length) % flatHits.length;
				setActiveIndex(next);
				return;
			}
			if (event.key === "Enter") {
				const target = flatHits[safeIndex];
				if (target) {
					event.preventDefault();
					handleSelect(target);
				}
			}
		}
		document.addEventListener("keydown", handleKeyDown);
		return () => document.removeEventListener("keydown", handleKeyDown);
	}, [open, meetsMin, flatHits, safeIndex, handleSelect]);

	const showPanel = open && meetsMin;
	const isFirstLoad = isLoading && results.total === 0;
	const isRefreshing = isFetching && !isFirstLoad;
	const shortcutLabel = isMacPlatform() ? "⌘K" : "Ctrl K";

	return (
		<div
			ref={containerRef}
			className="relative hidden xl:flex flex-1 items-center gap-2 max-w-md"
		>
			<div className="relative flex-1 min-w-0">
				<Search
					size={13}
					className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-ink3"
					aria-hidden="true"
				/>
				<input
					ref={inputRef}
					type="search"
					role="combobox"
					aria-haspopup="listbox"
					aria-label="Buscar en tu taller"
					aria-autocomplete="list"
					aria-controls={PANEL_ID}
					aria-expanded={showPanel}
					aria-activedescendant={
						activeKey ? `search-hit-${activeKey.replace(":", "-")}` : undefined
					}
					autoComplete="off"
					spellCheck={false}
					value={query}
					onChange={(e) => {
						setQuery(e.target.value);
						setActiveIndex(0);
						setOpen(true);
					}}
					onFocus={() => setOpen(true)}
					placeholder="Buscar clientes, presupuestos, materiales…"
					className={cn(
						"h-9 w-full rounded-md border border-line bg-cp-bg2 pl-9 text-[13px] text-ink",
						"placeholder:text-ink3 focus:outline-none focus:border-accent",
						trimmed ? "pr-9" : "pr-3",
					)}
				/>
				{trimmed ? (
					<button
						type="button"
						onClick={handleClear}
						aria-label="Limpiar búsqueda"
						className="absolute right-2 top-1/2 grid h-6 w-6 -translate-y-1/2 place-items-center rounded-sm text-ink3 transition-colors hover:bg-cp-bg2 hover:text-ink focus:outline-none focus-ring"
					>
						<X size={12} />
					</button>
				) : null}
			</div>
			{!trimmed ? (
				<kbd className="hidden 2xl:inline-flex shrink-0 items-center gap-0.5 rounded border border-line bg-cp-bg2 px-1.5 py-0.5 font-mono text-[10px] text-ink3">
					{shortcutLabel}
				</kbd>
			) : null}

			{showPanel ? (
				<SearchResultsPanel
					query={debouncedQuery}
					results={results}
					isLoading={isFirstLoad}
					isRefreshing={isRefreshing}
					isError={isError}
					activeIndex={safeIndex}
					onHoverIndex={setActiveIndex}
					onSelect={handleSelect}
					onNavigateAll={handleNavigateAll}
					onRetry={() => {
						void refetch()
					}}
					containerId={PANEL_ID}
				/>
			) : null}
		</div>
	);
}
