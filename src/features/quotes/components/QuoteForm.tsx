import { useEffect, useState, useMemo } from "react";
import { useNavigate, useParams, useSearchParams } from "react-router-dom";
import { useForm, type Resolver } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Button } from "@/shared/ui/button";
import { Label } from "@/shared/ui/label";
import { Textarea } from "@/shared/ui/textarea";
import {
	Select,
	SelectContent,
	SelectItem,
	SelectTrigger,
	SelectValue,
} from "@/shared/ui/select";
import { ChevronLeft, ChevronRight, X } from "lucide-react";
import { useWorkshopId } from "@/shared/hooks/useWorkshopId";
import {
	computeRecipeCost,
	resolveItemQuantity,
} from "@/shared/lib/recipeCosting";
import type { Client } from "@/shared/types/client";
import type { FurnitureTemplateWithItems } from "@/shared/types/recipes";
import {
	useQuote,
	useCreateQuote,
	useUpdateQuote,
	useGenerateQuoteNumber,
} from "../hooks/useQuotes";
import {
	QUOTE_STATUS_LABELS,
	type QuoteStatus,
	type MarginMode,
	type QuoteFormValues,
} from "../types";
import { calculateQuote } from "../lib/calculator";
import { QuoteExtrasFieldArray } from "./QuoteExtrasFieldArray";
import { QuoteLivePreview } from "./QuoteLivePreview";
import { ClientDialog } from "./ClientDialog";
import { FurnitureSection } from "./FurnitureSection";
import { MarginSection } from "./MarginSection";
import type { ComponentType } from "react";

const extraSchema = z.object({
	description: z.string().min(1, "La descripción es obligatoria"),
	amount: z.coerce.number().min(0),
	show_in_quote: z.boolean(),
});

const quoteSchema = z.object({
	client_id: z.string().optional(),
	furniture_template_id: z.string().optional(),
	furniture_name: z.string().min(1, "El nombre del mueble es obligatorio"),
	recipe_cost: z.coerce.number().min(0),
	extras: z.array(extraSchema),
	margin_mode: z.enum(["on_cost", "on_price"]),
	margin_pct: z.coerce.number().min(0).max(99),
	status: z.enum([
		"presupuesto",
		"enviado",
		"aprobado",
		"en_produccion",
		"entregado",
		"cancelado",
	]),
	notes: z.string().optional(),
});

const STEPS = [
	{ n: 1, label: "Cliente", key: "cliente" },
	{ n: 2, label: "Mueble", key: "mueble" },
	{ n: 3, label: "Extras", key: "extras" },
	{ n: 4, label: "Precio", key: "precio" },
];

interface ClientDialogFormProps {
	open: boolean;
	onOpenChange: (open: boolean) => void;
	onCreated: (client: Client) => void;
}

interface QuoteFormProps {
	/** Clients provided by the app seam (CRM barrel) instead of calling useClients internally. */
	clients: Client[];
	/** Furniture templates provided by the app seam (recipes barrel) instead of calling useFurnitureTemplates internally. */
	templates: FurnitureTemplateWithItems[];
	/** Callback invoked when a new client is created via the embedded client form. */
	onClientCreated?: (client: Client) => void;
	/** Component to render for the new-client dialog. Receives open/onOpenChange/onCreated. */
	clientFormComponent: ComponentType<ClientDialogFormProps>;
}

export function QuoteForm({
	clients,
	templates,
	onClientCreated,
	clientFormComponent: ClientFormComponent,
}: QuoteFormProps) {
	const { id } = useParams<{ id: string }>();
	const navigate = useNavigate();
	const [searchParams] = useSearchParams();
	const workshopId = useWorkshopId();
	const isEditing = Boolean(id);
	const prefillTemplateId = searchParams.get("template");

	const [step, setStep] = useState(1);
	const [clientDialogOpen, setClientDialogOpen] = useState(false);

	const { data: existingQuote } = useQuote(id ?? null);
	const { data: nextNumber } = useGenerateQuoteNumber(workshopId);
	const createMutation = useCreateQuote(workshopId);
	const updateMutation = useUpdateQuote(workshopId);

	const {
		register,
		handleSubmit,
		control,
		watch,
		reset,
		setValue,
		formState: { errors, isSubmitting, isValid },
	} = useForm<QuoteFormValues>({
		resolver: zodResolver(quoteSchema) as Resolver<QuoteFormValues>,
		mode: "onChange",
		defaultValues: {
			client_id: "",
			furniture_template_id: prefillTemplateId ?? "",
			furniture_name: "",
			recipe_cost: 0,
			extras: [],
			margin_mode: "on_cost",
			margin_pct: 30,
			status: "presupuesto",
			notes: "",
		},
	});

	useEffect(() => {
		if (existingQuote) {
			reset({
				client_id: existingQuote.client_id ?? "",
				furniture_template_id: existingQuote.furniture_template_id ?? "",
				furniture_name: existingQuote.furniture_name,
				recipe_cost: existingQuote.recipe_cost,
				extras: existingQuote.extras.map((e) => ({
					description: e.description,
					amount: e.amount,
					show_in_quote: e.show_in_quote,
				})),
				margin_mode: existingQuote.margin_mode,
				margin_pct: existingQuote.margin_pct,
				status: existingQuote.status,
				notes: existingQuote.notes ?? "",
			});
		}
	}, [existingQuote, reset]);

	const templateIdWatch = watch("furniture_template_id");
	useEffect(() => {
		if (!templateIdWatch) return;
		const tpl = templates.find((t) => t.id === templateIdWatch);
		if (!tpl) return;
		setValue("furniture_name", tpl.name);
		const paramValues = Object.fromEntries(
			(tpl.params ?? []).map((p) => [p.name, p.default]),
		);
		const cost = computeRecipeCost(
			tpl.recipe_items,
			tpl.labor_items,
			paramValues,
		);
		setValue("recipe_cost", cost.total);
	}, [templateIdWatch, templates, setValue]);

	const recipeCostWatch = watch("recipe_cost");
	const extrasWatch = watch("extras");
	const marginModeWatch = watch("margin_mode");
	const marginPctWatch = watch("margin_pct");
	const clientIdWatch = watch("client_id");
	const statusWatch = watch("status");
	const furnitureNameWatch = watch("furniture_name");

	const { salePrice } = useMemo(() => {
		return calculateQuote({
			recipeCost: recipeCostWatch ?? 0,
			extras: extrasWatch ?? [],
			marginMode: marginModeWatch,
			marginPct: marginPctWatch ?? 0,
		});
	}, [recipeCostWatch, extrasWatch, marginModeWatch, marginPctWatch]);

	function handleClientCreated(client: Client) {
		setValue("client_id", client.id);
		onClientCreated?.(client);
		handleNextStep();
	}

	function canAdvance(currentStep: number): boolean {
		switch (currentStep) {
			case 1:
				return Boolean(clientIdWatch);
			case 2:
				return Boolean(furnitureNameWatch) && (recipeCostWatch ?? 0) > 0;
			case 3:
				return true;
			case 4:
				return true;
			default:
				return false;
		}
	}

	function handleNextStep() {
		if (step < STEPS.length && canAdvance(step)) {
			setStep(step + 1);
		}
	}

	function handlePrevStep() {
		if (step > 1) {
			setStep(step - 1);
		}
	}

	async function onSubmit(values: QuoteFormValues) {
		const quoteNumber = isEditing
			? existingQuote!.quote_number
			: (nextNumber ?? "P-0001");

		const quoteData = {
			workshop_id: workshopId,
			quote_number: quoteNumber,
			client_id: values.client_id || null,
			furniture_template_id: values.furniture_template_id || null,
			furniture_name: values.furniture_name,
			recipe_cost: values.recipe_cost,
			status: values.status as QuoteStatus,
			margin_mode: values.margin_mode as MarginMode,
			margin_pct: values.margin_pct,
			notes: values.notes || null,
		};

		const extrasData = values.extras.map((e) => ({
			description: e.description,
			amount: e.amount,
			show_in_quote: e.show_in_quote,
		}));

		const tpl = values.furniture_template_id
			? templates.find((t) => t.id === values.furniture_template_id)
			: null;
		const paramValues = tpl
			? Object.fromEntries((tpl.params ?? []).map((p) => [p.name, p.default]))
			: {};
		const recipeSnapshots = tpl
			? tpl.recipe_items.map((ri) => ({
					material_id: ri.material_id,
					material_name: ri.material.name,
					material_unit: ri.material.unit,
					material_category: ri.material.category,
					quantity: resolveItemQuantity(ri, paramValues),
					waste_pct: ri.waste_pct ?? 0,
					price_per_unit: ri.material.price_per_unit,
				}))
			: [];
		const laborSnapshots = tpl
			? (tpl.labor_items ?? []).map((l) => ({
					description: l.description,
					hours: l.hours,
					rate: l.rate,
				}))
			: [];

		if (isEditing && id) {
			await updateMutation.mutateAsync({
				id,
				quote: quoteData,
				extras: extrasData,
				recipeSnapshots,
				laborSnapshots,
			});
		} else {
			await createMutation.mutateAsync({
				quote: quoteData,
				extras: extrasData,
				recipeSnapshots,
				laborSnapshots,
			});
		}
		navigate("/quotes");
	}

	const quoteNumber = isEditing ? existingQuote?.quote_number : nextNumber;

	return (
		<div className="fixed inset-0 bg-background flex flex-col overflow-hidden z-50">
			{/* Header */}
			<div className="flex items-center justify-between border-b border-line bg-surface px-4 py-3 sm:px-6 sm:py-4">
				<div>
					<h1 className="text-lg sm:text-2xl font-bold">
						{isEditing
							? `Editar ${quoteNumber}`
							: `Nuevo presupuesto ${nextNumber ? `— ${nextNumber}` : ""}`}
					</h1>
					{isEditing && (existingQuote?.recipe_snapshots?.length ?? 0) > 0 && (
						<span className="inline-flex text-xs font-medium text-blue-600 mt-1">
							Versión congelada
						</span>
					)}
				</div>
				<Button
					variant="ghost"
					size="icon"
					onClick={() => navigate("/quotes")}
					className="h-8 w-8"
				>
					<X className="h-4 w-4" />
				</Button>
			</div>

			{/* Stepper */}
			<div className="border-b border-line bg-cp-bg2 px-4 py-3 sm:px-6">
				<div className="flex gap-2 sm:gap-4 max-w-full overflow-x-auto">
					{STEPS.map((s) => (
						<button
							key={s.n}
							onClick={() => {
								if (s.n < step) setStep(s.n);
							}}
							disabled={s.n > step}
							className="flex items-center gap-2 flex-shrink-0 text-xs sm:text-sm font-medium disabled:opacity-50"
						>
							<div
								className={`w-7 h-7 rounded-full grid place-items-center font-mono text-xs ${
									step === s.n
										? "bg-cp-accent text-white"
										: s.n < step
											? "bg-cp-accent/20 text-cp-accent"
											: "bg-line text-ink2"
								}`}
							>
								{s.n}
							</div>
							<span className="hidden sm:inline">{s.label}</span>
						</button>
					))}
				</div>
			</div>

			{/* Content */}
			<div className="flex-1 flex gap-4 overflow-hidden sm:gap-6 px-4 py-4 sm:px-6">
				<form
					onSubmit={handleSubmit(onSubmit)}
					className="flex-1 overflow-y-auto"
				>
					<div className="max-w-2xl space-y-6">
						{/* Step 1: Cliente */}
						{step === 1 && (
							<div className="space-y-4">
								<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
									¿Para quién es?
								</h2>
								<p className="text-sm text-muted-foreground">
									Elegí un cliente existente o creá uno nuevo al vuelo.
								</p>
								<div className="space-y-2 max-h-96 overflow-y-auto">
									{clients.map((c) => (
										<button
											key={c.id}
											type="button"
											onClick={() => setValue("client_id", c.id)}
											className={`w-full text-left rounded-lg border p-3 transition-colors ${
												clientIdWatch === c.id
													? "border-cp-accent bg-cp-accent/10"
													: "border-line hover:border-cp-accent/50"
											}`}
										>
											<div className="flex items-center gap-3">
												<div className="w-8 h-8 rounded-full grid place-items-center bg-cp-accent/20 text-cp-accent font-mono text-xs font-semibold shrink-0">
													{c.name
														.split(" ")
														.map((w) => w[0])
														.slice(0, 2)
														.join("")}
												</div>
												<div className="flex-1 min-w-0">
													<p className="font-medium text-sm">{c.name}</p>
													<p className="text-xs text-muted-foreground">
														{c.email || c.phone}
													</p>
												</div>
											</div>
										</button>
									))}
								</div>
								<Button
									type="button"
									variant="outline"
									className="w-full"
									onClick={() => setClientDialogOpen(true)}
								>
									+ Crear cliente nuevo
								</Button>
							</div>
						)}

						{/* Step 2: Mueble */}
						{step === 2 && (
							<div className="space-y-4">
								<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
									¿Qué vas a hacer?
								</h2>
								<p className="text-sm text-muted-foreground">
									Elegí una plantilla o creá uno desde cero.
								</p>

								{templates.length > 0 && (
									<div>
										<label className="block text-xs font-medium text-muted-foreground mb-2">
											Plantillas
										</label>
										<div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
											{templates.map((t) => (
												<button
													key={t.id}
													type="button"
													onClick={() => {
														setValue("furniture_template_id", t.id);
														setValue("furniture_name", t.name);
														const cost = computeRecipeCost(
															t.recipe_items,
															t.labor_items,
														);
														setValue("recipe_cost", cost.total);
													}}
													className={`text-left rounded-lg border p-2 transition-colors ${
														templateIdWatch === t.id
															? "border-cp-accent bg-cp-accent/10"
															: "border-line hover:border-cp-accent/50"
													}`}
												>
													<div className="w-full aspect-square bg-cp-bg2 rounded mb-1 flex items-center justify-center text-xs text-muted-foreground" />
													<p className="font-medium text-xs line-clamp-2">
														{t.name}
													</p>
												</button>
											))}
										</div>
									</div>
								)}

								<FurnitureSection
									templates={templates}
									templateIdWatch={templateIdWatch}
									register={register}
									errors={errors}
									setValue={setValue}
								/>
							</div>
						)}

						{/* Step 3: Extras */}
						{step === 3 && (
							<div className="space-y-4">
								<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
									Costos extra
								</h2>
								<p className="text-sm text-muted-foreground">
									Flete, instalación, herrajes, lo que se te cobra aparte.
								</p>
								<QuoteExtrasFieldArray
									control={control}
									register={register}
									errors={errors}
								/>
							</div>
						)}

						{/* Step 4: Precio */}
						{step === 4 && (
							<div className="space-y-6">
								<h2 className="text-sm font-semibold uppercase tracking-wide text-muted-foreground">
									Margen y precio final
								</h2>

								<MarginSection
									marginModeWatch={marginModeWatch}
									register={register}
									errors={errors}
									setValue={setValue}
								/>

								<div className="space-y-3">
									<Label className="text-xs font-semibold uppercase tracking-wide">
										Estado inicial
									</Label>
									<Select
										value={statusWatch}
										onValueChange={(v) => setValue("status", v as QuoteStatus)}
									>
										<SelectTrigger className="w-full">
											<SelectValue />
										</SelectTrigger>
										<SelectContent>
											{(
												Object.entries(QUOTE_STATUS_LABELS) as [
													QuoteStatus,
													string,
												][]
											).map(([value, label]) => (
												<SelectItem key={value} value={value}>
													{label}
												</SelectItem>
											))}
										</SelectContent>
									</Select>
								</div>

								<div className="space-y-3">
									<Label
										htmlFor="notes"
										className="text-xs font-semibold uppercase tracking-wide"
									>
										Notas internas (opcional)
									</Label>
									<Textarea
										id="notes"
										{...register("notes")}
										rows={3}
										placeholder="Medidas, aclaraciones, etc."
									/>
								</div>
							</div>
						)}
					</div>
				</form>

				{/* Preview (desktop) */}
				<div className="hidden lg:flex lg:w-72 lg:flex-col gap-4">
					<div className="sticky top-4">
						<QuoteLivePreview
							recipeCost={recipeCostWatch ?? 0}
							extras={extrasWatch ?? []}
							marginMode={marginModeWatch}
							marginPct={marginPctWatch ?? 0}
						/>
					</div>
				</div>
			</div>

			{/* Footer with navigation */}
			<div className="border-t border-line bg-surface px-4 py-3 sm:px-6 flex flex-col-reverse sm:flex-row gap-2 sm:gap-4 sm:items-center sm:justify-between">
				{/* Mobile: Price preview */}
				<div className="lg:hidden text-center sm:text-left">
					<p className="text-xs text-muted-foreground">Precio final</p>
					<p className="font-display text-xl font-semibold">
						${(salePrice || 0).toLocaleString("es-AR")}
					</p>
				</div>

				{/* Buttons */}
				<div className="flex gap-2 sm:gap-3">
					<Button
						type="button"
						variant="outline"
						onClick={handlePrevStep}
						disabled={step === 1}
						className="flex-1 sm:flex-none"
					>
						<ChevronLeft className="h-4 w-4 mr-1" />
						Atrás
					</Button>
					<Button
						type="button"
						variant="outline"
						onClick={() => navigate("/quotes")}
						className="flex-1 sm:flex-none"
					>
						Cancelar
					</Button>
					{step < STEPS.length ? (
						<Button
							onClick={handleNextStep}
							disabled={!canAdvance(step)}
							className="flex-1 sm:flex-none"
						>
							Siguiente
							<ChevronRight className="h-4 w-4 ml-1" />
						</Button>
					) : (
						<Button
							onClick={handleSubmit(onSubmit)}
							disabled={isSubmitting || !isValid}
							className="flex-1 sm:flex-none"
						>
							{isSubmitting ? "Guardando..." : isEditing ? "Guardar" : "Crear"}
						</Button>
					)}
				</div>
			</div>

			<ClientDialog open={clientDialogOpen}>
				<ClientFormComponent
					open={clientDialogOpen}
					onOpenChange={setClientDialogOpen}
					onCreated={handleClientCreated}
				/>
			</ClientDialog>
		</div>
	);
}
