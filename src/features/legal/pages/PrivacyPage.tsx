import type { ReactNode } from "react";
import { Link } from "react-router-dom";
import { BrandMark } from "@/shared/ui/brand-mark";
import {
	getSupportEmail,
	getSupportMailtoHref,
} from "@/shared/lib/supportContact";

const LAST_UPDATED = "14 de septiembre de 2026";

export function PrivacyPage() {
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
						Política de Privacidad
					</h1>
					<p className="text-sm text-ink2">
						Última actualización: {LAST_UPDATED}
					</p>
				</div>

				<Section title="1. Responsable del tratamiento">
					<p>
						CarpinteroPro, con contacto en{" "}
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
						, es responsable del tratamiento de sus datos personales conforme a
						la Ley 25.326 de Protección de Datos Personales de la República
						Argentina y normativas complementarias.
					</p>
				</Section>

				<Section title="2. Datos que recopilamos">
					<p>
						Recopilamos únicamente los datos necesarios para prestar el
						Servicio:
					</p>
					<ul>
						<li>
							<strong>Datos de cuenta:</strong> dirección de email, nombre del
							taller.
						</li>
						<li>
							<strong>Datos del taller:</strong> materiales, presupuestos,
							clientes, recetas y configuraciones que usted carga
							voluntariamente.
						</li>
						<li>
							<strong>Datos de uso:</strong> logs técnicos, errores y métricas
							de rendimiento (sin datos personales identificables de sus
							clientes).
						</li>
						<li>
							<strong>Historial de facturación (solo auditoría):</strong>{" "}
							identificadores de suscripción anteriores y eventos de webhook
							de MercadoPago registrados antes de la migración al modelo
							gratuito. Estos datos se conservan únicamente con fines de
							auditoría histórica; CarpinteroPro no los utiliza para cobrar
							ni para condicionar el acceso al Servicio, y no almacena datos
							de tarjetas ni cuentas bancarias.
						</li>
					</ul>
				</Section>

				<Section title="3. Finalidad del tratamiento">
					<ul>
						<li>Proveer y mejorar el Servicio.</li>
						<li>
							Enviar comunicaciones transaccionales (confirmación de cuenta,
							facturas, avisos de seguridad).
						</li>
						<li>Cumplir obligaciones legales y prevenir fraudes.</li>
						<li>
							Enviar comunicaciones comerciales sobre el Servicio (puede darse
							de baja en cualquier momento).
						</li>
					</ul>
				</Section>

				<Section title="4. Base legal">
					<p>
						El tratamiento se basa en: (a) ejecución del contrato de prestación
						del Servicio, (b) consentimiento explícito prestado al registrarse, y
						(c) interés legítimo para mejorar el Servicio y prevenir fraudes.
					</p>
				</Section>

				<Section title="5. Compartición de datos">
					<p>
						No vendemos ni cedemos sus datos personales a terceros. Podemos
						compartir datos con:
					</p>
					<ul>
						<li>
							<strong>Supabase:</strong> base de datos y autenticación
							(infraestructura en AWS us-east-1).
						</li>
						<li>
							<strong>Vercel:</strong> hosting del frontend (servidores en EE.
							UU.).
						</li>
						<li>
							<strong>Resend:</strong> envío de emails transaccionales.
						</li>
						<li>
							<strong>Sentry (opcional):</strong> reportero de errores de
							frontend. Solo se activa si el operador configura{" "}
							<code>VITE_SENTRY_DSN</code>; en ese caso Sentry recibe
							eventos de error sin contenido personal identificable.
						</li>
						<li>
							<strong>MercadoPago (solo histórico):</strong> la integración
							con MercadoPago permanece en el código fuente únicamente para
							soportar una eventual funcionalidad paga a futuro. Hoy no se
							realizan pagos ni se gestionan suscripciones activas a través de
							MercadoPago desde el Servicio.
						</li>
					</ul>
					<p>
						Todos los proveedores cuentan con políticas de privacidad propias y
						medidas de seguridad adecuadas.
					</p>
				</Section>

				<Section title="6. Retención de datos">
					<p>
						Sus datos se conservan mientras su cuenta esté activa. Al eliminar
						su cuenta, los datos se borran en un plazo máximo de 30 días, salvo
						obligación legal de conservación.
					</p>
				</Section>

				<Section title="7. Sus derechos (Ley 25.326)">
					<p>Usted tiene derecho a:</p>
					<ul>
						<li>
							<strong>Acceso:</strong> solicitar una copia de sus datos
							personales.
						</li>
						<li>
							<strong>Rectificación:</strong> corregir datos inexactos o
							incompletos.
						</li>
						<li>
							<strong>Cancelación/Supresión:</strong> solicitar la eliminación
							de sus datos.
						</li>
						<li>
							<strong>Oposición:</strong> oponerse al tratamiento para fines de
							marketing directo.
						</li>
					</ul>
					<p>
						Para ejercer estos derechos, escriba a{" "}
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
						. Responderemos en un plazo máximo de 10 días hábiles. La Dirección
						Nacional de Protección de Datos Personales actúa como autoridad de
						control (
						<a
							href="https://www.argentina.gob.ar/aaip"
							target="_blank"
							rel="noopener noreferrer"
							className="underline hover:text-ink"
						>
							www.argentina.gob.ar/aaip
						</a>
						).
					</p>
				</Section>

				<Section title="8. Seguridad">
					<p>
						Implementamos medidas técnicas y organizativas para proteger sus
						datos: conexiones TLS/HTTPS, RLS (Row Level Security) en la base de
						datos, autenticación con tokens de sesión y acceso restringido al
						personal.
					</p>
				</Section>

				<Section title="9. Cookies y tecnologías similares">
					<p>
						Utilizamos cookies de sesión estrictamente necesarias para el
						funcionamiento de la autenticación. No utilizamos cookies de
						seguimiento ni publicidad de terceros.
					</p>
				</Section>

				<Section title="10. Modificaciones">
					<p>
						Podemos actualizar esta Política en cualquier momento. Notificaremos
						los cambios relevantes por email o mediante aviso en la aplicación.
						El uso continuado del Servicio tras la notificación implica
						aceptación.
					</p>
				</Section>

				<p className="text-sm text-ink2 pt-4 border-t border-line">
					Consultas de privacidad:{" "}
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
			<div className="text-sm text-ink2 leading-relaxed space-y-2 [&_ul]:list-disc [&_ul]:pl-5 [&_ul]:space-y-1 [&_a]:text-ink">
				{children}
			</div>
		</section>
	);
}
