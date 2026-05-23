import { FileText, MessageCircle, Smartphone } from "lucide-react";
import { useEffect, useState } from "react";

const screens = ["Dashboard", "Presupuesto", "Inventario"] as const;

function prefersReducedMotion() {
	if (typeof window === "undefined" || !window.matchMedia) return true;
	return window.matchMedia("(prefers-reduced-motion: reduce)").matches;
}

export function MobileFirstSection() {
	const [activeScreen, setActiveScreen] = useState(0);
	const [autoAdvance, setAutoAdvance] = useState(() => !prefersReducedMotion());

	useEffect(() => {
		if (!autoAdvance) return undefined;
		const intervalId = window.setInterval(() => {
			setActiveScreen((current) => (current + 1) % screens.length);
		}, 2_500);

		return () => window.clearInterval(intervalId);
	}, [autoAdvance]);

	return (
		<section
			className="landing-demo-section landing-demo-section-alt"
			aria-labelledby="mobile-first-heading"
		>
			<div className="landing-demo-container landing-mobile-grid">
				<div>
					<span className="landing-demo-overline">Desde tu celular</span>
					<h2 id="mobile-first-heading" className="landing-demo-title">
						Tu taller en el bolsillo
					</h2>
					<p className="landing-demo-subtitle landing-mobile-copy">
						CarpinteroPro está pensado mobile-first: presupuestá en el taller,
						revisá stock en el proveedor y enviá el PDF antes de que el cliente
						se enfríe.
					</p>
					<div className="landing-mobile-features">
						<div>
							<Smartphone size={18} />
							<strong>Diseño táctil</strong>
							<span>Botones grandes, pantallas simples y flujos cortos.</span>
						</div>
						<div>
							<FileText size={18} />
							<strong>PDF listo para enviar</strong>
							<span>Presupuesto profesional sin volver a la compu.</span>
						</div>
						<div>
							<MessageCircle size={18} />
							<strong>WhatsApp integrado</strong>
							<span>Compartí el presupuesto apenas lo terminás.</span>
						</div>
					</div>
				</div>

				<div className="landing-mobile-phone-wrap">
					<div className="landing-mobile-badge landing-mobile-badge-1">
						PDF listo para enviar
					</div>
					<div className="landing-mobile-badge landing-mobile-badge-2">
						Stock actualizado
					</div>
					<div
						className="landing-phone-frame landing-mobile-phone"
						role="group"
						aria-label="Vista móvil de CarpinteroPro con dashboard, presupuesto e inventario"
					>
						<div className="landing-phone-notch" />
						<div className="landing-mobile-appbar">
							<strong>{screens[activeScreen]}</strong>
							<span>Online</span>
						</div>
						<div className="landing-mobile-screen">
							{activeScreen === 0 && <DashboardScreen />}
							{activeScreen === 1 && <QuoteScreen />}
							{activeScreen === 2 && <InventoryScreen />}
						</div>
						<div className="landing-mobile-tabs">
							{screens.map((screen, index) => (
								<button
									key={screen}
									type="button"
									className={activeScreen === index ? "is-active" : ""}
									onClick={() => {
										setActiveScreen(index);
										setAutoAdvance(false);
									}}
								>
									<span />
									{screen}
								</button>
							))}
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}

function DashboardScreen() {
	return (
		<>
			<div className="landing-mobile-kpi">
				<span>Facturado este mes</span>
				<strong>$1.284.000</strong>
			</div>
			<div className="landing-mobile-card-grid">
				<span>12 presupuestos</span>
				<span>8 aprobados</span>
				<span>4 en producción</span>
				<span>98% al día</span>
			</div>
		</>
	);
}

function QuoteScreen() {
	return (
		<>
			<div className="landing-demo-receipt">
				<strong>Presupuesto #0042</strong>
				<span>Alacena 2 puertas</span>
				<b>Total $127.800</b>
			</div>
			<div className="landing-mobile-wa">
				<MessageCircle size={14} /> Enviar por WhatsApp
			</div>
		</>
	);
}

function InventoryScreen() {
	return (
		<div className="landing-mobile-stock-list">
			<span>
				Melamina blanca <b className="ok">OK</b>
			</span>
			<span>
				Bisagras suaves <b className="low">Bajo</b>
			</span>
			<span>
				Tiradores negros <b className="ok">OK</b>
			</span>
			<span>
				Correderas telescópicas <b className="low">Bajo</b>
			</span>
		</div>
	);
}
