import { FileText, MessageCircle } from "lucide-react";
import { useEffect, useMemo, useState } from "react";

const walkthroughSteps = [
	"Elegí el mueble",
	"Revisá el costo",
	"Definí el precio",
	"Enviá por WhatsApp",
] as const;

function prefersReducedMotion() {
	if (typeof window === "undefined" || !window.matchMedia) return true;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function WalkthroughDemoSection() {
	const [step, setStep] = useState(0);
	const [autoAdvance, setAutoAdvance] = useState(() => !prefersReducedMotion());

	useEffect(() => {
		if (!autoAdvance) return undefined;
		const intervalId = window.setInterval(() => {
			setStep((current) => (current + 1) % walkthroughSteps.length);
		}, 3_000);

		return () => window.clearInterval(intervalId);
	}, [autoAdvance]);

	const screen = useMemo(() => {
		switch (step) {
			case 1:
				return <CostScreen />;
			case 2:
				return <PriceScreen />;
			case 3:
				return <SendScreen />;
			default:
				return <FurnitureScreen />;
		}
	}, [step]);

	return (
		<section
			className="landing-demo-section landing-demo-section-alt"
			aria-labelledby="walkthrough-heading"
		>
			<div className="landing-demo-container landing-demo-container-narrow">
				<div className="landing-demo-header">
					<span className="landing-demo-overline">Miralo en acción</span>
					<h2 id="walkthrough-heading" className="landing-demo-title">
						Un presupuesto en 4 toques
					</h2>
					<p className="landing-demo-subtitle">
						Así de fácil es crear y enviar un presupuesto profesional.
					</p>
				</div>

				<div className="landing-walkthrough">
					<div
						className="landing-walkthrough-steps"
						aria-label="Pasos del demo"
					>
						{walkthroughSteps.map((label, index) => (
							<button
								key={label}
								type="button"
								className={`landing-walkthrough-step ${step === index ? "is-active" : ""} ${step > index ? "is-done" : ""}`}
								onClick={() => {
									setStep(index);
									setAutoAdvance(false);
								}}
							>
								<span>{step > index ? "✓" : index + 1}</span>
								{label}
							</button>
						))}
					</div>
					<div className="landing-walkthrough-progress" aria-hidden="true">
						<div
							style={{
								width: `${((step + 1) / walkthroughSteps.length) * 100}%`,
							}}
						/>
					</div>
					<div
						className="landing-phone-frame"
						role="img"
						aria-label="Demo animado de presupuesto en cuatro pasos"
					>
						<div className="landing-phone-notch" />
						<div className="landing-walkthrough-screen" key={step}>
							{screen}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function FurnitureScreen() {
	return (
		<div className="landing-walkthrough-panel">
			<div className="landing-walkthrough-topbar">
				<span>Nuevo presupuesto</span>
				<span>Paso 1/4</span>
			</div>
			<div className="landing-walkthrough-body">
				<p className="landing-walkthrough-instruction">Seleccioná un mueble</p>
				<div className="landing-walkthrough-option is-selected">
					<span>🪑</span>
					<strong>Alacena 2 puertas</strong>
					<small>Melamina 18mm + herrajes</small>
					<b>✓</b>
				</div>
				<div className="landing-walkthrough-option">
					<span>🛏️</span>
					<strong>Mesa ratona</strong>
					<small>Paraíso + lustre</small>
				</div>
				<div className="landing-walkthrough-option">
					<span>🚪</span>
					<strong>Bajo mesada 1.20m</strong>
					<small>MDF + pintura poliuretánica</small>
				</div>
			</div>
		</div>
	);
}

function CostScreen() {
	const rows = [
		["Melamina 18mm blanca", "$32.400"],
		["Bisagras cierre suave ×4", "$12.800"],
		["Tiradores ×2", "$5.600"],
		["Mano de obra", "$31.200"],
	];

	return (
		<div className="landing-walkthrough-panel">
			<div className="landing-walkthrough-topbar">
				<span>Nuevo presupuesto</span>
				<span>Paso 2/4</span>
			</div>
			<div className="landing-walkthrough-body">
				<p className="landing-walkthrough-instruction">
					Costo calculado automáticamente
				</p>
				{rows.map(([name, value]) => (
					<div key={name} className="landing-walkthrough-row">
						<span>{name}</span>
						<strong>{value}</strong>
					</div>
				))}
				<div className="landing-walkthrough-total">
					<span>Costo total</span>
					<strong>$85.200</strong>
				</div>
			</div>
		</div>
	);
}

function PriceScreen() {
	return (
		<div className="landing-walkthrough-panel">
			<div className="landing-walkthrough-topbar">
				<span>Nuevo presupuesto</span>
				<span>Paso 3/4</span>
			</div>
			<div className="landing-walkthrough-body">
				<p className="landing-walkthrough-instruction">Aplicá tu margen</p>
				<div className="landing-walkthrough-row">
					<span>Costo base</span>
					<strong>$85.200</strong>
				</div>
				<div className="landing-walkthrough-margin">
					<span>Margen: 50%</span>
					<div>
						<i />
					</div>
				</div>
				<div className="landing-walkthrough-row">
					<span>Ganancia</span>
					<strong className="landing-positive">+$42.600</strong>
				</div>
				<div className="landing-walkthrough-total">
					<span>Precio final</span>
					<strong>$127.800</strong>
				</div>
			</div>
		</div>
	);
}

function SendScreen() {
	return (
		<div className="landing-walkthrough-panel">
			<div className="landing-walkthrough-topbar">
				<span>Nuevo presupuesto</span>
				<span>Paso 4/4</span>
			</div>
			<div className="landing-walkthrough-body">
				<p className="landing-walkthrough-instruction">¡Listo para enviar!</p>
				<div className="landing-demo-receipt">
					<strong>PRESUPUESTO #0042</strong>
					<span>Cliente: Juan Pérez</span>
					<span>Mueble: Alacena 2 puertas</span>
					<b>Total: $127.800</b>
				</div>
				<div className="landing-walkthrough-actions">
					<span>
						<MessageCircle size={16} /> Enviar por WhatsApp
					</span>
					<span>
						<FileText size={16} /> Descargar PDF
					</span>
				</div>
				<div className="landing-walkthrough-time">
					⚡ Flujo pensado para resolverse en pocos minutos
				</div>
			</div>
		</div>
	);
}
