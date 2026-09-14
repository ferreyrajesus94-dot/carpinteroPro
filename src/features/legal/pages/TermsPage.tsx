import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/shared/ui/brand-mark";
import {
	getSupportEmail,
	getSupportMailtoHref,
} from "@/shared/lib/supportContact";

const LAST_UPDATED = "14 de septiembre de 2026";

export function TermsPage() {
	const supportEmail = getSupportEmail() ?? "soporte@example.com";
	const supportHref = getSupportMailtoHref();
	return (
		<div className="min-h-screen bg-cp-bg">
			<header className="border-b border-line bg-cp-surface px-6 py-4 flex items-center justify-between">
				<Link
					to="/login"
					className="flex items-center gap-2 text-sm text-ink3 hover:text-ink transition-colors"
				>
					<i className="fi fi-rr-arrow-left text-sm leading-none" />
					Volver
				</Link>
				<div className="flex items-center gap-2">
					<BrandMark size="sm" />
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
				<div className="space-y-2">
					<h1 className="text-2xl font-bold text-ink">
						Términos y Condiciones
					</h1>
					<p className="text-sm text-ink2">
						Última actualización: {LAST_UPDATED}
					</p>
				</div>

				<Section title="1. Aceptación">
					<p>
						Al crear una cuenta o utilizar CarpinteroPro (el "Servicio"), usted
						acepta quedar vinculado por estos Términos y Condiciones
						("Términos"). Si no está de acuerdo, no utilice el Servicio.
					</p>
				</Section>

				<Section title="2. Descripción del Servicio">
					<p>
						CarpinteroPro es una plataforma de gestión para talleres de
						carpintería que incluye módulos de inventario, presupuestos, CRM,
						muebles (BOM) y ajustes del taller. El Servicio se presta a través
						de Internet y está dirigido a personas físicas o jurídicas que
						operen talleres de carpintería o rubros afines en la República
						Argentina.
					</p>
				</Section>

				<Section title="3. Registro y cuenta">
					<ul>
						<li>
							Debe proporcionar información veraz y mantenerla actualizada.
						</li>
						<li>
							Usted es responsable de la confidencialidad de sus credenciales.
						</li>
						<li>
							Está prohibido compartir el acceso con terceros no autorizados.
						</li>
						<li>
							Nos reservamos el derecho de suspender cuentas con información
							falsa o que infrinjan estos Términos.
						</li>
					</ul>
				</Section>

				<Section title="4. Modelo gratuito y datos históricos de facturación">
					<p>
						CarpinteroPro se ofrece actualmente de forma gratuita a todos los
						talleres autenticados. El acceso al Servicio no requiere
						suscripción, pago ni período de prueba: una vez completado el
						onboarding inicial, la cuenta queda habilitada para uso pleno sin
						costos a cargo del usuario.
					</p>
					<ul>
						<li>
							No existe un plan pago activo ni se realizan cobros recurrentes a
							los usuarios por el uso del Servicio. Esta es la única
							modalidad vigente al momento de la última actualización de estos
							Términos.
						</li>
						<li>
							El módulo de MercadoPago permanece en el código fuente para
							soportar una eventual funcionalidad paga a futuro. Mientras esa
							funcionalidad no esté activada para su taller, no se realiza
							ningún cargo ni se solicita información de pago.
						</li>
						<li>
							Históricamente, CarpinteroPro ofreció un período de prueba
							gratuito y suscripciones mensuales gestionadas a través de
							MercadoPago. La tabla <code>subscriptions</code> puede contener
							filas para talleres que optaron por ese modelo antes de la
							migración al modelo gratuito actual. Esas filas se conservan
							únicamente con fines de auditoría histórica y no afectan el
							acceso al Servicio.
						</li>
						<li>
							Si en el futuro se ofreciera una función paga opcional, se lo
							informaremos previamente mediante aviso en la aplicación y por
							correo electrónico, y solicitaremos su consentimiento expreso
							antes de cualquier cargo.
						</li>
					</ul>
				</Section>

				<Section title="5. Uso aceptable">
					<p>Usted se compromete a no:</p>
					<ul>
						<li>
							Utilizar el Servicio para actividades ilícitas o contrarias a la
							legislación argentina.
						</li>
						<li>
							Intentar acceder a datos de otros usuarios o a partes no
							autorizadas del sistema.
						</li>
						<li>
							Realizar ingeniería inversa, descompilar o copiar el Servicio.
						</li>
						<li>Introducir malware, spam u otro contenido dañino.</li>
					</ul>
				</Section>

				<Section title="6. Propiedad intelectual">
					<p>
						Todo el código, diseño, marca y contenido del Servicio son propiedad
						de CarpinteroPro o sus licenciantes. Usted conserva la propiedad de
						los datos que cargue (presupuestos, clientes, materiales, etc.).
					</p>
				</Section>

				<Section title="7. Disponibilidad y modificaciones">
					<p>
						Nos esforzamos por mantener el Servicio disponible las 24 horas. Sin
						embargo, no garantizamos disponibilidad ininterrumpida y podemos
						realizar mantenimientos programados o urgentes. Nos reservamos el
						derecho de modificar o discontinuar funcionalidades con previo aviso
						razonable.
					</p>
				</Section>

				<Section title="8. Limitación de responsabilidad">
					<p>
						En la máxima medida permitida por la ley aplicable, CarpinteroPro no
						será responsable por daños indirectos, incidentales, especiales o
						emergentes que surjan del uso o la imposibilidad de uso del
						Servicio. Dado que el Servicio es actualmente gratuito, no existen
						importes abonados por el usuario sobre los cuales calcular una
						responsabilidad económica; la responsabilidad total por cualquier
						reclamo no excederá el costo razonable de mantener el Servicio
						durante el período en que ocurrió el hecho generador.
					</p>
				</Section>

				<Section title="9. Modificaciones a los Términos">
					<p>
						Podemos actualizar estos Términos en cualquier momento.
						Notificaremos los cambios relevantes por email o mediante aviso en
						la aplicación. El uso continuado del Servicio tras la notificación
						implica aceptación.
					</p>
				</Section>

				<Section title="10. Ley aplicable">
					<p>
						Estos Términos se rigen por las leyes de la República Argentina.
						Cualquier disputa se someterá a la jurisdicción de los tribunales
						ordinarios de la Ciudad Autónoma de Buenos Aires.
					</p>
				</Section>

				<p className="text-sm text-ink3 pt-4 border-t border-line">
					Consultas:{" "}
					{supportHref ? (
						<a
							href={supportHref}
							className="underline hover:text-ink"
						>
							{supportEmail}
						</a>
					) : (
						<span>{supportEmail}</span>
					)}
				</p>
			</main>
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3">
			<h2 className="text-base font-semibold text-ink">{title}</h2>
			<div className="text-sm text-ink2 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_code]:font-mono [&_code]:bg-cp-bg2 [&_code]:px-1 [&_code]:rounded">
				{children}
			</div>
		</section>
	);
}
