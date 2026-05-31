import type { ReactNode } from "react";
import { Link } from "react-router-dom";

const LAST_UPDATED = "29 de abril de 2025";

export function TermsPage() {
	return (
		<div className="min-h-screen bg-background">
			<header className="border-b border-line bg-cp-surface px-6 py-4 flex items-center justify-between">
				<Link
					to="/login"
					className="flex items-center gap-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
				>
					<i className="fi fi-rr-arrow-left text-sm leading-none" />
					Volver
				</Link>
				<div className="flex items-center gap-2">
					<div className="flex h-7 w-7 items-center justify-center rounded-md bg-cp-accent">
						<i className="fi fi-br-hammer text-sm text-[var(--cp-accent-ink)]" />
					</div>
					<span className="font-display font-semibold text-[15px] tracking-tight text-ink">
						CarpinteroPro
					</span>
				</div>
			</header>

			<main className="mx-auto max-w-3xl px-6 py-12 space-y-8">
				<div className="space-y-2">
					<h1 className="text-2xl font-bold text-ink">
						Términos y Condiciones
					</h1>
					<p className="text-sm text-muted-foreground">
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
						CarpinteroPro es una plataforma SaaS de gestión para talleres de
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

				<Section title="4. Período de prueba y suscripción">
					<ul>
						<li>
							Al completar el onboarding inicial del taller comienza un período
							de prueba gratuito de <strong>14 días</strong> con acceso completo
							al Servicio.
						</li>
						<li>
							Al vencimiento del período de prueba, el acceso queda suspendido
							de forma inmediata y sin período de gracia salvo que se active una
							suscripción paga.
						</li>
						<li>
							El precio de la suscripción mensual es el vigente al momento de
							contratar, publicado en la página de ajustes.
						</li>
						<li>
							El cobro se realiza mediante MercadoPago. Al suscribirse usted
							autoriza los débitos automáticos mensuales.
						</li>
						<li>
							Puede cancelar su suscripción en cualquier momento desde la
							sección de facturación en Ajustes o, si fuera necesario, desde el
							panel de MercadoPago. Cuando el proveedor lo permite, el acceso se
							mantiene hasta el fin del período abonado; si no, la cancelación
							puede aplicarse de inmediato.
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
						Servicio. La responsabilidad total no excederá el importe abonado
						por el usuario en los últimos 3 meses.
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

				<p className="text-sm text-muted-foreground pt-4 border-t border-line">
					Consultas:{" "}
					<a
						href="mailto:hola@carpinteropro.app"
						className="underline hover:text-foreground"
					>
						hola@carpinteropro.app
					</a>
				</p>
			</main>
		</div>
	);
}

function Section({ title, children }: { title: string; children: ReactNode }) {
	return (
		<section className="space-y-3">
			<h2 className="text-base font-semibold text-ink">{title}</h2>
			<div className="text-sm text-muted-foreground leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1">
				{children}
			</div>
		</section>
	);
}
