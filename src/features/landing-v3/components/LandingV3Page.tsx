import {
	ArrowDown,
	ArrowRight,
	Check,
	CircleCheck,
	Clock3,
	Hammer,
} from "lucide-react";
import { Link } from "react-router-dom";
import productionPhoto from "/assets/landing-v3/variations/production-b.jpg";
import quotePhoto from "/assets/landing-v3/variations/quote-b.jpg";
import "./landing-v3.css";

const stages = [
	{ number: "01", label: "Materiales", href: "#stage-01" },
	{ number: "02", label: "Presupuesto", href: "#stage-02" },
	{ number: "03", label: "Producción", href: "#stage-03" },
] as const;

interface StageRailProps {
	active: (typeof stages)[number]["number"];
	label: string;
}

function StageRail({ active, label }: StageRailProps) {
	return (
		<nav className="landing-v3__progress" aria-label={label}>
			<div className="landing-v3__progress-rule" aria-hidden="true" />
			{stages.map((stage) => (
				<a
					key={stage.number}
					className="landing-v3__stage"
					data-active={stage.number === active || undefined}
					href={stage.href}
					aria-label={`${stage.number} ${stage.label}`}
					aria-current={stage.number === active ? "step" : undefined}
				>
					<span>{stage.number}</span>
					<strong>{stage.label}</strong>
				</a>
			))}
		</nav>
	);
}

export function LandingV3Page() {
	return (
		<main className="landing-v3">
			<section
				id="stage-01"
				className="landing-v3__hero"
				aria-labelledby="landing-v3-title"
			>
				<div className="landing-v3__hero-photo" aria-hidden="true" />

				<Link className="landing-v3__brand" to="/" aria-label="CarpinteroPro, inicio">
					<span>Carpintero</span>
					<strong>Pro</strong>
				</Link>

				<StageRail active="01" label="Recorrido del trabajo" />

				<div className="landing-v3__hero-copy">
					<h1
						id="landing-v3-title"
						className="landing-v3__headline"
						aria-label="Seguí el trabajo, no los papeles"
					>
						Seguí el trabajo,
						<br />
						no los papeles
					</h1>
					<a className="landing-v3__primary-action" href="#stage-02">
						Ver cómo funciona
						<ArrowDown aria-hidden="true" />
					</a>
				</div>

				<p className="landing-v3__disclosure">Ejemplo ilustrativo</p>

			</section>

			<section
				id="stage-02"
				className="landing-v3__scene landing-v3__scene--quote"
				aria-labelledby="landing-v3-quote-title"
			>
				<img className="landing-v3__scene-photo" src={quotePhoto} alt="" loading="lazy" />
				<div className="landing-v3__scene-shade" aria-hidden="true" />
				<StageRail active="02" label="Etapa actual: presupuesto" />

				<div className="landing-v3__scene-copy">
					<h2 id="landing-v3-quote-title">El precio deja de depender de tu memoria.</h2>
					<p>
						Materiales, mano de obra y margen quedan juntos. Si un costo cambia mañana,
						el presupuesto que enviaste conserva sus valores.
					</p>
				</div>

				<article className="landing-v3__quote-sheet" aria-label="Ejemplo de presupuesto">
					<header>
						<div><span>Presupuesto</span><strong>Mesa de nogal</strong></div>
						<b>Congelado</b>
					</header>
					<dl>
						<div><dt>Materiales</dt><dd>$ 286.400</dd></div>
						<div><dt>Mano de obra</dt><dd>$ 180.000</dd></div>
						<div><dt>Margen</dt><dd>$ 93.280</dd></div>
					</dl>
					<div className="landing-v3__quote-total"><span>Total</span><strong>$ 559.680</strong></div>
					<footer><span>PDF listo para enviar</span><span>Ejemplo ilustrativo</span></footer>
				</article>

				<div className="landing-v3__approval-bridge">
					<CircleCheck aria-hidden="true" />
					<div>
						<strong>El cliente aprueba</strong>
						<span>El mismo trabajo pasa a producción y actualiza el stock.</span>
					</div>
					<a href="#stage-03" aria-label="Continuar a producción"><ArrowRight aria-hidden="true" /></a>
				</div>
			</section>

			<section
				id="stage-03"
				className="landing-v3__scene landing-v3__scene--production"
				aria-labelledby="landing-v3-production-title"
			>
				<img className="landing-v3__scene-photo" src={productionPhoto} alt="" loading="lazy" />
				<div className="landing-v3__scene-shade" aria-hidden="true" />
				<StageRail active="03" label="Etapa actual: producción" />

				<div className="landing-v3__scene-copy">
					<h2 id="landing-v3-production-title">En el banco sabés qué sigue.</h2>
					<p>
						La orden reúne el cliente, la fecha y el estado del trabajo. Menos preguntas;
						más tiempo para fabricar.
					</p>
				</div>

				<article className="landing-v3__production-board" aria-label="Estado ilustrativo de producción">
					<header>
						<div><span>Orden de producción</span><strong>Mesa de nogal</strong></div>
						<Hammer aria-hidden="true" />
					</header>
					<ol>
						<li data-done="true"><Check aria-hidden="true" /><span>Presupuesto aprobado</span></li>
						<li data-done="true"><Check aria-hidden="true" /><span>Stock descontado</span></li>
						<li data-current="true"><Clock3 aria-hidden="true" /><span>Terminación en curso</span></li>
					</ol>
					<footer><span>Próximo paso</span><strong>Coordinar entrega</strong></footer>
				</article>
			</section>

			<section className="landing-v3__closing" aria-labelledby="landing-v3-closing-title">
				<div>
					<h2 id="landing-v3-closing-title">Un trabajo. Una historia completa.</h2>
					<p>Desde la primera tabla hasta la entrega, sin perder el control del taller.</p>
				</div>
				<div className="landing-v3__closing-actions">
					<Link className="landing-v3__closing-primary" to="/login">
						Entrar a CarpinteroPro
						<ArrowRight aria-hidden="true" />
					</Link>
					<a
						className="landing-v3__closing-secondary"
						href="https://github.com/ferreyrajesus94-dot/carpinteroPro"
						target="_blank"
						rel="noreferrer"
					>
						Ver el proyecto abierto
					</a>
				</div>
			</section>
		</main>
	);
}
