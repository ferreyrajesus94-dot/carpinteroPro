import { useMemo, useState } from "react";
import { BILLING_PRICE } from "@/shared/constants/billingPricing";

const AVG_QUOTE_VALUE = 150_000;

const formatCurrency = (value: number) =>
	new Intl.NumberFormat("es-AR", {
		style: "currency",
		currency: "ARS",
		maximumFractionDigits: 0,
	}).format(value);

export function ROICalculatorSection() {
	const [hoursPerWeek, setHoursPerWeek] = useState(6);
	const [quotesPerMonth, setQuotesPerMonth] = useState(8);
	const [hourlyRate, setHourlyRate] = useState(3_000);

	const results = useMemo(() => {
		const hoursSaved = hoursPerWeek * 0.7;
		const monthlySaved = hoursSaved * 4 * hourlyRate;
		const lostQuotes = Math.round(quotesPerMonth * 0.2);
		const revenueRecovered = lostQuotes * AVG_QUOTE_VALUE;
		const totalBenefit = monthlySaved + revenueRecovered;

		return {
			hoursSavedPerMonth: Math.round(hoursSaved * 4),
			monthlySaved: Math.round(monthlySaved),
			lostQuotes,
			totalBenefit: Math.round(totalBenefit),
			returnRate: Math.max(
				1,
				Math.round(totalBenefit / BILLING_PRICE.amountARS),
			),
		};
	}, [hourlyRate, hoursPerWeek, quotesPerMonth]);

	return (
		<section className="landing-demo-section" aria-labelledby="roi-heading">
			<div className="landing-demo-container">
				<div className="landing-demo-header">
					<span className="landing-demo-overline">Calculadora de ahorro</span>
					<h2 id="roi-heading" className="landing-demo-title">
						¿Cuánto te cuesta NO tener CarpinteroPro?
					</h2>
					<p className="landing-demo-subtitle">
						Mové los controles y mirá una estimación orientativa de ahorro
						mensual.
					</p>
				</div>

				<div className="landing-roi-card">
					<div className="landing-roi-inputs">
						<div className="landing-roi-group">
							<label className="landing-roi-label" htmlFor="roi-hours">
								Horas/semana en presupuestos y admin
								<span className="landing-roi-value">{hoursPerWeek}hs</span>
							</label>
							<input
								id="roi-hours"
								type="range"
								min="1"
								max="20"
								step="1"
								value={hoursPerWeek}
								onChange={(event) =>
									setHoursPerWeek(Number(event.target.value))
								}
								className="landing-range"
							/>
							<div className="landing-roi-range-labels">
								<span>1hs</span>
								<span>20hs</span>
							</div>
						</div>

						<div className="landing-roi-group">
							<label className="landing-roi-label" htmlFor="roi-quotes">
								Presupuestos por mes
								<span className="landing-roi-value">{quotesPerMonth}</span>
							</label>
							<input
								id="roi-quotes"
								type="range"
								min="1"
								max="30"
								step="1"
								value={quotesPerMonth}
								onChange={(event) =>
									setQuotesPerMonth(Number(event.target.value))
								}
								className="landing-range"
							/>
							<div className="landing-roi-range-labels">
								<span>1</span>
								<span>30</span>
							</div>
						</div>

						<div className="landing-roi-group">
							<label className="landing-roi-label" htmlFor="roi-rate">
								Valor de tu hora de trabajo
								<span className="landing-roi-value">
									{formatCurrency(hourlyRate)}
								</span>
							</label>
							<input
								id="roi-rate"
								type="range"
								min="500"
								max="10000"
								step="500"
								value={hourlyRate}
								onChange={(event) => setHourlyRate(Number(event.target.value))}
								className="landing-range"
							/>
							<div className="landing-roi-range-labels">
								<span>$500</span>
								<span>$10.000</span>
							</div>
						</div>
					</div>

					<div className="landing-roi-results" aria-live="polite">
						<div className="landing-roi-result-item">
							<span>Horas que recuperás/mes</span>
							<strong className="landing-roi-accent">
								{results.hoursSavedPerMonth}hs
							</strong>
						</div>
						<div className="landing-roi-result-item">
							<span>Ahorro en tiempo</span>
							<strong>{formatCurrency(results.monthlySaved)}</strong>
						</div>
						<div className="landing-roi-result-item">
							<span>Trabajos que no perdés</span>
							<strong>
								~{results.lostQuotes} × {formatCurrency(AVG_QUOTE_VALUE)}
							</strong>
						</div>
						<div className="landing-roi-total">
							<span>Beneficio total estimado/mes</span>
							<strong>{formatCurrency(results.totalBenefit)}</strong>
							<p>
								Cálculo orientativo según tus datos vs.{" "}
								{formatCurrency(BILLING_PRICE.amountARS)}
								/mes de suscripción →{" "}
								<b>retorno estimado {results.returnRate}x</b>
							</p>
						</div>
					</div>
				</div>
			</div>
		</section>
	);
}
