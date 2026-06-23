import { Link } from "react-router-dom";
import { User, FileText, Package, Armchair } from "lucide-react";
import { cn } from "@/shared/lib/utils";
import type { SearchHit } from "../types";

interface Props {
	hit: SearchHit;
	active: boolean;
	onSelect?: (hit: SearchHit) => void;
	onMouseEnter?: () => void;
}

const ICON_BY_ENTITY: Record<SearchHit["entity"], typeof User> = {
	clients: User,
	quotes: FileText,
	materials: Package,
	furniture: Armchair,
};

const ENTITY_LABEL: Record<SearchHit["entity"], string> = {
	clients: "Cliente",
	quotes: "Presupuesto",
	materials: "Material",
	furniture: "Mueble",
};

export function SearchResultItem({
	hit,
	active,
	onSelect,
	onMouseEnter,
}: Props) {
	const Icon = ICON_BY_ENTITY[hit.entity];

	const content = (
		<div
			className={cn(
				"flex items-start gap-3 px-3 py-2.5 rounded-md transition-colors",
				active ? "bg-cp-accent-soft" : "hover:bg-cp-bg2",
			)}
		>
			<div
				className={cn(
					"flex h-8 w-8 shrink-0 items-center justify-center rounded-md",
					active
						? "bg-cp-accent text-[var(--cp-accent-ink)]"
						: "bg-cp-bg2 text-ink2",
				)}
				aria-hidden="true"
			>
				<Icon size={15} />
			</div>
			<div className="min-w-0 flex-1">
				<div className="flex items-center gap-2">
					<span
						className={cn(
							"truncate text-[13.5px] font-medium",
							active ? "text-ink" : "text-ink",
						)}
					>
						{hit.title}
					</span>
					<span className="shrink-0 rounded-sm bg-cp-bg2 px-1.5 py-0.5 text-[9.5px] font-mono uppercase tracking-wider text-ink3">
						{ENTITY_LABEL[hit.entity]}
					</span>
				</div>
				{hit.subtitle ? (
					<div className="mt-0.5 truncate text-[11.5px] text-ink3">
						{hit.subtitle}
					</div>
				) : null}
			</div>
		</div>
	);

	const commonProps = {
		id: `search-hit-${hit.entity}-${hit.id}`,
		role: "option" as const,
		"aria-selected": active,
		"data-entity": hit.entity,
		"data-id": hit.id,
		onMouseEnter,
	};

	if (onSelect) {
		return (
			<button
				type="button"
				{...commonProps}
				onClick={() => onSelect(hit)}
				className="w-full text-left focus:outline-none focus-ring rounded-md"
			>
				{content}
			</button>
		);
	}

	return (
		<Link
			to={hit.href}
			{...commonProps}
			className="block focus:outline-none focus-ring rounded-md"
		>
			{content}
		</Link>
	);
}
