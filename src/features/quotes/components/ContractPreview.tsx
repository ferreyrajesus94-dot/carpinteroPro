import { useEffect, useRef, useState } from "react";
import { useParams, Link } from "react-router-dom";
import { ArrowLeft, Download, Share2, Copy, Pencil, Check } from "lucide-react";
import { Button } from "@/shared/ui/button";
import { Textarea } from "@/shared/ui/textarea";
import { Input } from "@/shared/ui/input";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/select";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import type { WorkshopSettings } from "@/shared/types/workshopSettings";
import { useQuote } from "../hooks/useQuotes";
import {
	useContractTemplates,
	useCreateContractTemplate,
} from "../hooks/useContractTemplates";
import { renderContract } from "../lib/contractRenderer";
import { generateQuotePDF } from "../lib/pdf";
import { calculateQuote, type CalcExtra } from "../lib/calculator";
import { formatCurrency } from "@/shared/lib/formatters";
import { format } from "date-fns";
import { es } from "date-fns/locale";

interface ContractPreviewProps {
	workshopSettings: WorkshopSettings | null;
}

export function ContractPreview({ workshopSettings }: ContractPreviewProps) {
	const { id } = useParams<{ id: string }>();
	const workshopId = useWorkshopId();
	const { data: quote } = useQuote(id ?? null);
	const {
		data: templates = [],
		isLoading: templatesLoading,
		isError: templatesError,
	} = useContractTemplates(workshopId);
	const createTemplate = useCreateContractTemplate(workshopId);
	const [selectedTemplateId, setSelectedTemplateId] = useState<string | null>(null);
	const [showTemplateForm, setShowTemplateForm] = useState(false);
	const [templateName, setTemplateName] = useState("");
	const [templateBody, setTemplateBody] = useState("");
	const [copied, setCopied] = useState(false);
	const copyResetTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(
		null,
	);
	const [editState, setEditState] = useState<{
		templateId: string;
		contract: string | null;
		isEditing: boolean;
	}>({
		templateId: "",
		contract: null,
		isEditing: false,
	});

	useEffect(() => {
		return () => {
			if (copyResetTimeoutRef.current !== null) {
				clearTimeout(copyResetTimeoutRef.current);
				copyResetTimeoutRef.current = null;
			}
		};
	}, []);

	const defaultTemplate = templates.find((t) => t.is_default);
	const activeTemplateId = selectedTemplateId ?? defaultTemplate?.id ?? "";
	const activeTemplate = templates.find((t) => t.id === activeTemplateId);
	const editedContract =
		editState.templateId === activeTemplateId ? editState.contract : null;
	const isEditing =
		editState.templateId === activeTemplateId ? editState.isEditing : false;

	if (!quote)
		return <div className="p-4 text-ink3">Cargando...</div>;

	const calcResult = calculateQuote({
		recipeCost: quote.recipe_cost,
		extras: quote.extras.map(
			(e): CalcExtra => ({ amount: e.amount, show_in_quote: e.show_in_quote }),
		),
		marginMode: quote.margin_mode,
		marginPct: quote.margin_pct,
	});

	const vars = {
		client_name: quote.client?.name ?? "",
		quote_number: quote.quote_number,
		total: formatCurrency(calcResult.salePrice),
		furniture_name: quote.furniture_name,
		workshop_name: workshopSettings?.name ?? "CarpinteroPro",
		date: format(new Date(), "d 'de' MMMM 'de' yyyy", { locale: es }),
	};

	const baseContract = activeTemplate
		? renderContract(activeTemplate.body_markdown, vars)
		: "";
	const renderedContract = editedContract ?? baseContract;

	function buildWhatsAppText(): string {
		const lines: string[] = [
			`*Presupuesto ${quote!.quote_number} — ${workshopSettings?.name ?? "CarpinteroPro"}*`,
		];
		if (quote!.client) lines.push(`Cliente: ${quote!.client.name}`);
		lines.push("");
		lines.push(
			`🪵 ${quote!.furniture_name}: ${formatCurrency(quote!.recipe_cost)}`,
		);
		quote!.extras
			.filter((e) => e.show_in_quote)
			.forEach((e) =>
				lines.push(`🔧 ${e.description}: ${formatCurrency(e.amount)}`),
			);
		lines.push("─────────────────────────");
		lines.push(`*Total: ${formatCurrency(calcResult.salePrice)}*`);
		if (renderedContract) {
			const first2Lines = renderedContract
				.split("\n")
				.filter((l) => l.trim())
				.slice(0, 2)
				.join("\n");
			lines.push("");
			lines.push(first2Lines);
		}
		return lines.join("\n");
	}

	function handleWhatsApp() {
		const text = buildWhatsAppText();
		const phone = quote?.client?.phone?.replace(/\D/g, "") ?? "";
		const url = `https://wa.me/${phone}?text=${encodeURIComponent(text)}`;
		window.open(url, "_blank");
	}

	async function handleCopy() {
		await navigator.clipboard.writeText(buildWhatsAppText());
		setCopied(true);
		if (copyResetTimeoutRef.current !== null) {
			clearTimeout(copyResetTimeoutRef.current);
		}
		copyResetTimeoutRef.current = setTimeout(() => {
			setCopied(false);
			copyResetTimeoutRef.current = null;
		}, 2000);
	}

	function handleDownloadPDF() {
		generateQuotePDF({
			quote: quote!,
			settings: workshopSettings ?? null,
			contract: renderedContract || undefined,
		});
	}

	async function handleCreateTemplate(event: React.FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (
			!templateName.trim() ||
			!templateBody.trim() ||
			createTemplate.isPending
		) return;
		try {
			const template = await createTemplate.mutateAsync({
				workshop_id: workshopId,
				name: templateName.trim(),
				body_markdown: templateBody.trim(),
				is_default: templates.length === 0,
			});
			setSelectedTemplateId(template.id);
			setShowTemplateForm(false);
			setTemplateName("");
			setTemplateBody("");
		} catch {
			// The mutation displays the error; preserve the draft for retry.
		}
	}

	return (
		<div className="max-w-3xl mx-auto p-4 space-y-6">
			<div className="flex items-center gap-3">
				<Button variant="ghost" size="icon" asChild>
					<Link to="/quotes">
						<ArrowLeft className="h-4 w-4" />
					</Link>
				</Button>
				<h1 className="text-2xl font-bold">Contrato — {quote.quote_number}</h1>
			</div>

			<div className="flex flex-wrap items-center gap-3">
				<label id="contract-template-label" className="text-sm text-ink3">Plantilla:</label>
				<Select
					value={activeTemplateId || "__none__"}
					onValueChange={(v) =>
						setSelectedTemplateId(v === "__none__" ? "" : v)
					}
				>
					<SelectTrigger className="w-64" aria-labelledby="contract-template-label" disabled={templatesLoading || templatesError}>
						<SelectValue placeholder="Sin contrato" />
					</SelectTrigger>
					<SelectContent>
						<SelectItem value="__none__">Sin contrato</SelectItem>
						{templates.map((t) => (
							<SelectItem key={t.id} value={t.id}>
								{t.name}
								{t.is_default ? " (predeterminada)" : ""}
							</SelectItem>
						))}
					</SelectContent>
				</Select>
				<Button variant="outline" onClick={() => setShowTemplateForm(true)} disabled={templatesLoading || templatesError}>
					Nueva plantilla
				</Button>
			</div>
			{templatesError ? <p role="alert" className="text-sm text-cp-danger">No se pudieron cargar las plantillas. Recargá la página para reintentar.</p> : null}
			{!templatesLoading && !templatesError && templates.length === 0 && !showTemplateForm ? (
				<p className="text-sm text-ink3">Todavía no hay plantillas de contrato. Creá una con el texto que uses en tu taller.</p>
			) : null}
			{showTemplateForm ? (
				<form onSubmit={handleCreateTemplate} className="space-y-3 rounded-lg border border-line p-4">
					<h2 className="text-lg font-semibold">Nueva plantilla de contrato</h2>
					<label className="block space-y-1">
						<span className="text-sm">Nombre de la plantilla</span>
						<Input value={templateName} onChange={(event) => setTemplateName(event.target.value)} required maxLength={120} />
					</label>
					<label className="block space-y-1">
						<span className="text-sm">Texto del contrato</span>
						<Textarea value={templateBody} onChange={(event) => setTemplateBody(event.target.value)} required rows={8} />
					</label>
					<p className="text-sm text-ink3">Variables disponibles: {"{{client_name}}, {{quote_number}}, {{total}}, {{furniture_name}}, {{workshop_name}}, {{date}}"}.</p>
					{createTemplate.isError ? <p role="alert" className="text-sm text-cp-danger">No se pudo guardar la plantilla. Tu texto se conserva; intentá de nuevo.</p> : null}
					<div className="flex gap-2">
						<Button type="submit" disabled={!templateName.trim() || !templateBody.trim() || createTemplate.isPending}>{createTemplate.isPending ? "Guardando..." : "Guardar plantilla"}</Button>
						<Button type="button" variant="outline" onClick={() => setShowTemplateForm(false)} disabled={createTemplate.isPending}>Cancelar</Button>
					</div>
				</form>
			) : null}

			<div className="flex flex-wrap gap-2">
				<Button onClick={handleWhatsApp}>
					<Share2 className="h-4 w-4 mr-2" />
					Compartir por WhatsApp
				</Button>
				<Button onClick={handleDownloadPDF} variant="outline">
					<Download className="h-4 w-4 mr-2" />
					{renderedContract ? "Descargar presupuesto y contrato" : "Descargar presupuesto PDF"}
				</Button>
				<Button onClick={handleCopy} variant="outline">
					<Copy className="h-4 w-4 mr-2" />
					{copied ? "¡Copiado!" : "Copiar texto"}
				</Button>
			</div>

			{renderedContract ? (
				<div className="space-y-2">
					<div className="flex justify-end">
						<Button
							variant="outline"
							size="sm"
							onClick={() => {
								setEditState({
									templateId: activeTemplateId,
									contract: isEditing ? editedContract : renderedContract,
									isEditing: !isEditing,
								});
							}}
						>
							{isEditing ? (
								<Check className="h-4 w-4 mr-1" />
							) : (
								<Pencil className="h-4 w-4 mr-1" />
							)}
							{isEditing ? "Listo" : "Editar"}
						</Button>
						{editedContract !== null && !isEditing && (
							<Button
								variant="ghost"
								size="sm"
								onClick={() =>
									setEditState({
										templateId: activeTemplateId,
										contract: null,
										isEditing: false,
									})
								}
							>
								Restaurar plantilla
							</Button>
						)}
					</div>
					{isEditing ? (
						<Textarea
							aria-label="Texto del contrato editado"
							value={editedContract ?? ""}
							onChange={(e) =>
								setEditState({
									templateId: activeTemplateId,
									contract: e.target.value,
									isEditing: true,
								})
							}
							rows={14}
							className="font-mono text-sm"
						/>
					) : (
						<div className="whitespace-pre-wrap break-words rounded-lg border p-6 bg-cp-surface text-ink text-sm leading-relaxed">
							{renderedContract.split(/\*\*(.*?)\*\*/g).map((part, index) => index % 2 === 1 ? <strong key={index}>{part}</strong> : part)}
						</div>
					)}
				</div>
			) : (
				<p className="text-ink3 text-sm">
					Seleccioná una plantilla para ver el contrato.
				</p>
			)}
		</div>
	);
}
