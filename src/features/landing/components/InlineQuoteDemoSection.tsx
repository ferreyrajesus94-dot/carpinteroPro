import { ArrowRight, MessageCircle } from "lucide-react";
import { useMemo, useState } from "react";

const furnitureOptions = [
	{ name: "Juego de sillas", cost: 85_200, icon: "🪑" },
	{ name: "Cama 1 plaza", cost: 220_000, icon: "🛏️" },
	{ name: "Puerta granero", cost: 94_800, icon: "🚪" },
] as const;

const formatCurrency = (value: number) =>
	new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
		maximumFractionDigits: 0,
	}).format(value);

export function InlineQuoteDemoSection() {
	const [demoStep, setDemoStep] = useState(0);
	const [selectedIndex, setSelectedIndex] = useState<number | null>(null);
	const [margin, setMargin] = useState(40);
	const [sent, setSent] = useState(false);

	const selected =
		selectedIndex === null ? null : furnitureOptions[selectedIndex];
	const price = useMemo(
		() => (selected ? Math.round(selected.cost * (1 + margin / 100)) : 0),
		[margin, selected],
	);

	const reset = () => {
		setDemoStep(0);
		setSelectedIndex(null);
		setMargin(40);
		setSent(false);
	};

	return (
		<section
			className="landing-demo-section"
			aria-labelledby="inline-demo-heading"
		>
			<div className="landing-demo-container landing-demo-container-narrow">
				<div className="landing-demo-header">
					<span className="landing-demo-overline">Probalo vos mismo</span>
					<h2 id="inline-demo-heading" className="landing-demo-title">
						Creá un presupuesto ahora
					</h2>
					<p className="landing-demo-subtitle">
						Sin registrarte. Sin instalar nada. Tocá y sentí la velocidad.
					</p>
				</div>

				<div className="landing-inline-demo">
					<div
						className="landing-inline-progress"
						aria-label="Progreso del demo"
					>
						{["Elegir", "Margen", "Enviar"].map((label, index) => (
							<div key={label} className={demoStep >= index ? "is-active" : ""}>
								<span>{demoStep > index ? "✓" : index + 1}</span>
								{label}
							</div>
						))}
					</div>

					{demoStep === 0 && (
						<div className="landing-inline-body">
							<p className="landing-inline-instruction">
								Elegí un mueble para presupuestar:
							</p>
							<div className="landing-inline-options">
								{furnitureOptions.map((option, index) => (
									<button
										key={option.name}
										type="button"
										className={selectedIndex === index ? "is-selected" : ""}
										onClick={() => setSelectedIndex(index)}
									>
										<span>{option.icon}</span>
										<strong>{option.name}</strong>
										<small>Costo: {formatCurrency(option.cost)}</small>
									</button>
								))}
							</div>
							{selected && (
								<button
									type="button"
									className="landing-demo-button"
									onClick={() => setDemoStep(1)}
								>
									Siguiente <ArrowRight size={16} />
								</button>
							)}
						</div>
					)}

					{demoStep === 1 && selected && (
						<div className="landing-inline-body">
							<p className="landing-inline-instruction">
								Ajustá tu margen de ganancia:
							</p>
							<label className="landing-inline-margin" htmlFor="inline-margin">
								<span>Margen de ganancia</span>
								<strong>{margin}%</strong>
							</label>
							<input
								id="inline-margin"
								type="range"
								min="10"
								max="100"
								step="5"
								value={margin}
								onChange={(event) => setMargin(Number(event.target.value))}
								className="landing-range"
							/>
							<div className="landing-inline-summary">
								<span>
									Costo <b>{formatCurrency(selected.cost)}</b>
								</span>
								<span>
									Ganancia <b>{formatCurrency(price - selected.cost)}</b>
								</span>
								<strong>Precio final {formatCurrency(price)}</strong>
							</div>
							<div className="landing-demo-actions">
								<button
									type="button"
									className="landing-demo-button-secondary"
									onClick={() => setDemoStep(0)}
								>
									Volver
								</button>
								<button
									type="button"
									className="landing-demo-button"
									onClick={() => setDemoStep(2)}
								>
									Preparar envío <ArrowRight size={16} />
								</button>
							</div>
						</div>
					)}

					{demoStep === 2 && selected && !sent && (
						<div className="landing-inline-body">
							<p className="landing-inline-instruction">
								Tu presupuesto está listo:
							</p>
							<div className="landing-demo-receipt">
								<strong>PRESUPUESTO</strong>
								<span>Mueble: {selected.name}</span>
								<span>Margen: {margin}%</span>
								<b>Total: {formatCurrency(price)}</b>
							</div>
							<div className="landing-demo-actions">
								<button
									type="button"
									className="landing-demo-button-secondary"
									onClick={() => setDemoStep(1)}
								>
									Volver
								</button>
								<button
									type="button"
									className="landing-demo-button"
									onClick={() => setSent(true)}
								>
									<MessageCircle size={16} /> Enviar por WhatsApp
								</button>
							</div>
						</div>
					)}

					{demoStep === 2 && sent && (
						<div className="landing-inline-body landing-inline-sent">
							<div aria-hidden="true">✓</div>
							<h3>¡Presupuesto enviado!</h3>
							<p>
								Eso es todo. En la app real, tu cliente recibe un PDF
								profesional por WhatsApp.
							</p>
							<button
								type="button"
								className="landing-demo-button-secondary"
								onClick={reset}
							>
								Probar de nuevo
							</button>
						</div>
					)}
				</div>
			</div>
		</section>
	);
}
