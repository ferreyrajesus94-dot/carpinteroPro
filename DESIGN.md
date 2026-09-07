---
name: CarpinteroPro
description: Diseño visual de un instrumento de taller open source para carpinteros que hablan español.
colors:
  primary: "oklch(62% 0.18 48)"
  primary-ink: "oklch(99% 0 0)"
  primary-soft: "oklch(94% 0.04 55)"
  neutral-bg: "oklch(97.5% 0.008 70)"
  neutral-bg-2: "oklch(94.8% 0.012 70)"
  neutral-surface: "oklch(99% 0.004 70)"
  text-primary: "oklch(22% 0.018 50)"
  text-secondary: "oklch(38% 0.014 55)"
  text-tertiary: "oklch(55% 0.010 60)"
  divider: "oklch(89% 0.010 60)"
  divider-strong: "oklch(82% 0.012 60)"
  success: "oklch(58% 0.14 155)"
  warn: "oklch(72% 0.16 75)"
  danger: "oklch(58% 0.19 25)"
  info: "oklch(60% 0.12 230)"
  chart-up: "oklch(52% 0.16 145)"
  chart-down: "oklch(52% 0.20 25)"
  chart-neutral: "oklch(55% 0.01 0)"
typography:
  display:
    fontFamily: "'Space Grotesk', system-ui, sans-serif"
    fontSize: "clamp(1.5rem, 4vw, 3.75rem)"
    fontWeight: 600
    lineHeight: 1.15
    letterSpacing: "-0.01em"
  headline:
    fontFamily: "'Space Grotesk', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1.2
    letterSpacing: "-0.01em"
  title:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: "1.5rem"
    fontWeight: 600
    lineHeight: 1
    letterSpacing: "-0.025em"
  body:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: "0.875rem"
    fontWeight: 400
    lineHeight: 1.5
  label:
    fontFamily: "'Inter', system-ui, sans-serif"
    fontSize: "0.75rem"
    fontWeight: 500
    letterSpacing: "0.05em"
    textTransform: "uppercase"
  mono:
    fontFamily: "'JetBrains Mono', ui-monospace, monospace"
    fontSize: "0.875rem"
    fontWeight: 500
    fontFeatureSettings: "'tnum' on"
rounded:
  sm: "6px"
  md: "8px"
  lg: "10px"
  xl: "14px"
  full: "9999px"
spacing:
  xs: "4px"
  sm: "8px"
  md: "12px"
  base: "16px"
  lg: "20px"
  xl: "24px"
  2xl: "32px"
components:
  button-primary:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  button-outline:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 16px"
    height: "40px"
  input-default:
    backgroundColor: "{colors.neutral-bg}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.md}"
    padding: "10px 12px"
    height: "40px"
  card:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "24px"
  chip-toggle-tab-active:
    backgroundColor: "{colors.neutral-surface}"
    textColor: "{colors.text-primary}"
    rounded: "{rounded.lg}"
    padding: "6px 12px"
  mobile-fab:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.primary-ink}"
    rounded: "{rounded.full}"
    size: "48px"
---

# Design System: CarpinteroPro

## Overview

**Creative North Star: "El Cuaderno del Taller"**

Utilitario, cálido, de taller. La herramienta desaparece detrás del trabajo: no decora, no vende, no entretiene. La calidez viene del papel (paleta cálida sobre `oklch(97.5% 0.008 70)`) y del acento cobre, no de los bordes redondeados ni de las gradientes. La densidad viene del ritmo 8/12 y del toggle cómodo/denso (`src/index.css:73–78`), no del tamaño de letra.

Solo se eleva lo que necesita elevarse: diálogos, popovers, el FAB móvil. El resto se queda plano sobre la mesa, marcado por bordes de 1px en `--line`. La numeración monetaria es siempre monospace.

**Key Characteristics:**

- Plano en reposo; las sombras aparecen solo como respuesta al estado (hover, overlay, FAB).
- Acento cobre único sobre papel cálido; sin tonos competidos ni colores secundarios.
- Densidad de taller: paneles `p-5`/`p-6`, campos `h-10`, gaps `8`/`12`px, sin respiración de más.
- Tipografía de dos voces (`Inter` cuerpo + `Space Grotesk` títulos + `JetBrains Mono` dinero).
- WCAG 2.1 AA no es opcional: contraste, teclado y tamaño de objetivo vienen del brief del piso del taller.

**Anti-referencias confirmadas:** gradientes decorativos, glassmorphism, sombras ornamentales, animaciones por capricho. Todos prohibidos.

## Colors

La paleta vive en OKLCH (`src/index.css:36–53`); los tokens HSL legacy (`src/index.css:14–34`) están marcados `DEPRECATED` y solo sobreviven en `Skeleton` (`bg-muted`). La fuente de verdad es una sola.

### Primary

- **Cobrizo cálido** (`oklch(62% 0.18 48)`): la única voz de acento. Botón primario, foco, FAB móvil, icono de marca, switch encendido, sidebar activo, botón destructive. Su rareza es el punto: aparece sobre el 10% del lienzo y nunca como decoración pasiva.
- **Tinta sobre acento** (`oklch(99% 0 0)`): blanco de contraste para texto sobre el acento.
- **Acento suave** (`oklch(94% 0.04 55)`): superficie tintada para estados activos suaves (sidebar hover, chip-toggle filter activo, ghost button hover, focus ring offset).

### Secondary

- *(omitido: la paleta tiene un solo acento)*

### Tertiary

- *(omitido: la paleta tiene un solo acento)*

### Neutral

- **Papel cálido** (`oklch(97.5% 0.008 70)`): fondo de página y de inputs. La sensación de hoja de cuaderno.
- **Arena** (`oklch(94.8% 0.012 70)`): fondo alterno (botón secundario, secciones alternas, sidebar hover, separador reforzado, chip-toggle tab inactivo).
- **Superficie** (`oklch(99% 0.004 70)`): la carta sobre la mesa; paneles y tarjetas elevadas 1px sobre el papel.
- **Tinta primaria** (`oklch(22% 0.018 50)`): texto principal. Nunca negro puro.
- **Tinta secundaria** (`oklch(38% 0.014 55)`): párrafos, descripciones, texto de celda, button secondary.
- **Tinta terciaria** (`oklch(55% 0.010 60)`): placeholders, helper text, eyebrow muted, table heads, ink-3.
- **Línea** (`oklch(89% 0.010 60)`): separador 1px por defecto; bordes de input, card, tabla, sidebar, dialog.
- **Línea fuerte** (`oklch(82% 0.012 60)`): separador con énfasis (chip-toggle `tab`, section-howto button hover).

### Status colors

- **Éxito** (`oklch(58% 0.14 155)`): aprobación de presupuesto, stock sobre mínimo, taller activo. Chip + barra superior + texto + variantes 10/15/25/70.
- **Atención** (`oklch(72% 0.16 75)`): stock bajo, requiere atención. Chip + texto + variantes 10/15/25/40/70/80.
- **Peligro** (`oklch(58% 0.19 25)`): sin stock, error, destructive. Botón + chip + variantes 5/10/15/30/40/80/90.
- **Info** (`oklch(60% 0.12 230)`): aviso informativo, linktone secundario. Chip + variantes 10/30.

### Chart colors

- **Subió** (`oklch(52% 0.16 145)`): línea de precio al alza en términos neutrales. `PriceSparkline` aplica semántica invertida para el carpintero: cuando el último precio es mayor que el primero, se pinta `chart-down` (subir el costo del material es malo para el margen).
- **Bajó** (`oklch(52% 0.20 25)`): línea de precio a la baja; mismo componente la pinta cuando el costo sube.
- **Neutro** (`oklch(55% 0.01 0)`): gris cálido para líneas de comparación y series base.

### Named Rules

**The One Voice Rule.** El cobrizo cálido se usa en ≤10% del lienzo en cualquier pantalla dada. Su rareza es el punto. Si un componente necesita jerarquía visual sin acción, usa `text-secondary`, `bg-2` o `border-line`, no el acento.

**The Single Source Rule.** Los tokens OKLCH (`src/index.css:36–53`) son la única fuente de verdad. Los tokens HSL legacy (`src/index.css:14–34`) están marcados `DEPRECATED` y solo se usan en `Skeleton`. Toda paleta nueva entra por OKLCH; no se agregan valores HSL.

**The No Color-Only State Rule.** Ningún estado (aprobación, stock bajo, sin stock, mantenimiento) se señaliza solo por color. Cada uno viene con un icono (`AlertTriangle`, `CheckCircle2`, etc.), una etiqueta visible, o una posición espacial. WCAG 2.1 AA, pero también sentido común en un taller polvoriento donde el sol cambia el color percibido.

## Typography

**Display Font:** Space Grotesk (400/500/600/700, con fallback `system-ui, sans-serif`)
**Body Font:** Inter (400/500/600/700, con fallback `system-ui, sans-serif`)
**Tabular Font:** JetBrains Mono (400/500/600, con fallback `ui-monospace, monospace`)

**Character:** Dos voces legibles más una voz numérica. Inter es el papel sobre el que se escribe; Space Grotesk es el encabezado del cuaderno; JetBrains Mono es el valor anotado. Los tres comparten un mismo eje visual cálido y una cadencia consistente (terminales suaves en Space Grotesk, `tnum` activo en Mono).

### Hierarchy

- **Display** (`Space Grotesk`, `clamp(1.5rem, 4vw, 3.75rem)`, peso 600, line-height 1.15, tracking `-0.01em`): hero del landing y títulos de sección de marketing. Solo donde el contenido es narrativa, no operación.
- **Headline** (`Space Grotesk`, `1.5rem`, peso 600, line-height 1.2, tracking `-0.01em`): `PageHeader` (`text-2xl font-semibold tracking-tight text-ink`) y KPI destacados en panel (`font-display text-[22px] leading-none font-semibold`).
- **Title** (`Inter`, `1.5rem`, peso 600, line-height 1, tracking `-0.025em`): títulos de `Card`, headings de detalle (settings), subtítulos de sección cuando se quiere cuerpo y no display.
- **Body** (`Inter`, `0.875rem`, peso 400, line-height 1.5): párrafos, descripciones de card, texto principal de celdas. Tamaño dominante del sistema.
- **Caption / Label** (`Inter`, `0.75rem`, peso 500, line-height 1.4, uppercase, tracking `0.05em`): eyebrow, helper text, table heads (`text-[11px] uppercase tracking-[0.06em]`), error inline.
- **Mono** (`JetBrains Mono`, `0.875rem`, peso 500, `font-feature-settings: 'tnum' on`): todo lo que sea dinero, ID, kbd shortcut, paso de wizard, número tabular. El carpintero quiere alinear decimales.

#### Dashboard micro-ramp (extensión documentada en prosa)

El dashboard necesita cinco pasos intermedios que el ramp canónico (Display/Headline/Title/Body/Caption/Mono) no cubre. La jerarquía densa del taller — eyebrow → valor KPI → sub-label → etiqueta de chart — no se sostiene solo con `0.75rem` y `0.875rem`. Para no contaminar el frontmatter derivado de Material, estos pasos se documentan en prosa y se atan explícitamente a sus usos en la superficie del dashboard. Cualquier valor nuevo debe pasar por aquí antes de entrar al código.

- **Micro-xs** (`Inter`, `9px`, peso 500): etiqueta de mes debajo de cada barra del mini bar chart del hero de facturación. Solo donde el ancho horizontal aprieta; el cuerpo jamás baja de este tamaño.
- **Micro** (`Inter`, `10.5px`, peso 500): eyebrow mono del label de cada tarjeta en `KPICards`. Sostiene la separación visual entre el label y el valor `22px` que tiene debajo sin pisar el cuerpo de `0.875rem`.
- **Eyebrow-mono** (`JetBrains Mono`, `11px`, peso 500, uppercase, tracking `0.08em`): eyebrows mono que encabezan secciones del dashboard (`Facturado — Mes actual`, `Pipeline · presupuestos activos`, `Accesos rápidos`, `Requiere atención`). Coherente con el principio mono para datos tabulares que se alinean.
- **KPI** (mono o display según el valor, `22px`, peso 600, line-height `1.05`): valor destacado de cada tarjeta del grid 2×2. Mono si es dinero (`Ticket promedio`, `Facturado total`); display si es count o porcentaje (`Presupuestos`, `Conversión`). La Money Is Mono Rule decide.
- **KPI hero** (`JetBrains Mono`, `40px`, peso 600, line-height 1): valor del hero de facturación del período. Mono por la Money Is Mono Rule; sin excepciones.

### Named Rules

**The Money Is Mono Rule.** Todo número monetario se renderiza en `JetBrains Mono` con `tnum` activado. Celdas de precio en listas, totales en cards, gráficos de precio histórico. Sin excepciones.

**The Two-Voice Rule.** Solo dos voces para texto corrido: Inter (cuerpo) y Space Grotesk (display/headline). Cualquier intento de meter una tercera fuente para "jerarquía" se reemplaza por peso y tamaño dentro de las dos voces existentes.

## Layout

El layout es un shell de dos columnas en escritorio (`≥1024px`, sidebar `w-60` de 240px + main flexible) y un shell de una columna en mobile con tabs fijos abajo y un FAB contextual. El main reserva `pb-24` en mobile para no tapar contenido con los bottom-tabs.

### Containers

- **Auth:** `max-w-sm` (login) / `max-w-md` (perfil, billing-blocked).
- **Onboarding:** `max-w-3xl` (header del wizard) + `max-w-2xl` (body).
- **Settings:** `max-w-lg` (forms densos).
- **Landing hero:** `max-w-6xl` (heading + párrafo + CTAs lado a lado).

### Page padding

- `p-4 md:p-6` en `<main>` para diferenciar mobile vs desktop.
- `pb-24 lg:pb-4` en main para reservar el alto de los bottom-tabs en mobile.

### Density toggle

- `.dense` (`src/index.css:73–78`) reduce los tokens: `--pad-y: 10px`, `--pad-x: 12px`, `--row-y: 8px`, `--gap: 8px`. Por defecto cómodo. Persistido en `localStorage['cp.density']` y aplicado vía el hook `useTheme()`.

### Touch-target heights (binding WCAG + taller)

- `h-9` (36px) — fila de tabla densa, chip compacto.
- `h-10` (40px) — input, select, botón primario. **Mínimo del sistema.**
- `h-11` (44px) — icon-square nav, botón grande, search bar global.
- `h-12` (48px) — FAB móvil, CTA de hero, header mobile.
- Todos los icon-square miden `h-11 w-11` para alinearse con WCAG 2.1 AA objetivo 44×44.

### Wizard exception

- En `/quotes/:quoteId` no-canónico (`isWizardPath` en `AppLayout.tsx:184–326`): colapsa a `flex h-screen flex-col bg-background` sin sidebar, sin topbar. Solo banners + skip link + main a sangre.

## Elevation & Depth

El sistema es deliberadamente plano. Las superficies se separan por bordes de 1px en `--line`, no por sombras. Las sombras existen únicamente como respuesta al estado: overlay (diálogo, popover, search results, switch thumb) o acción (FAB móvil).

### Shadow Vocabulary

- **`shadow-sm`** (`0 1px 2px 0 rgb(0 0 0 / 0.05)`): card, pill de landing, panel admin. No es decoración; es la elevación natural de una tarjeta sobre la mesa.
- **`shadow-md`** (`0 4px 6px -1px rgb(0 0 0 / 0.1), 0 2px 4px -2px rgb(0 0 0 / 0.1)`): tooltip, contenido de select, tooltips de dashboard.
- **`shadow-lg`** (`0 10px 15px -3px rgb(0 0 0 / 0.1), 0 4px 6px -4px rgb(0 0 0 / 0.1)`): diálogo, search dropdown, switch thumb.
- **`shadow-xl`** (`0 20px 25px -5px rgb(0 0 0 / 0.1), 0 8px 10px -6px rgb(0 0 0 / 0.1)`): solo FAB móvil.
- **Cero sombra** sobre el resto del chrome (topbar, mobile header, bottom tabs). Suspenden el efecto con `backdrop-blur` y un tinte `bg-cp-surface/85` o `/95`.

### Tonal layering

- En dark mode (`src/index.css:124–156`), la jerarquía pasa por `--bg-2` y `--surface`, no por sombras añadidas. El plano se mantiene.

### Named Rules

**The Flat-By-Default Rule.** Las superficies son planas en reposo. Las sombras aparecen solo como respuesta al estado (hover, elevación, focus, overlay). Si un componente necesita "elevación" en reposo, primero probá con `border-line` y `bg-cp-surface`; solo agregá `shadow-sm` si la jerarquía visual no se lee.

**The Backdrop-Blur Surface Rule.** El topbar desktop, el header mobile y los bottom-tabs usan `bg-cp-surface/85` o `/95` + `backdrop-blur`. Translúcidos para no romper el flujo visual, no translúcidos para "lujo".

## Shapes

La forma dominante es el rectángulo con radio controlado. Sin píldoras decorativas; sin `rounded-full` por estilo.

### Radius scale

- **`rounded-sm` (6px)** — kbd shortcut chips, dialog close, chip-toggle neutral badge, focus ring offset (`--cp-radius-sm`).
- **`rounded-md` (8px)** — botones, inputs, select trigger, chip-toggle filter, sidebar row-icon links. El radio operativo (`--radius - 2px`).
- **`rounded-lg` (10px)** — cards, tooltips, select content, table wrapper, section-howto button, panel cards, chip-toggle tab (`--radius` / `--cp-radius`).
- **`rounded-xl` (14px)** — feedback-state panels (ErrorState/EmptyState), onboarding/error cards, FAB (`--cp-radius-lg`).
- **`rounded-2xl` (16px)** — landing testimonials, landing CTA card.
- **`rounded-full`** — badges, brand-mark icon disc, switch track, side-nav bottom-tab/icon-square/chip, kbd chips, status pills.

### Border treatment

- 1px solid en `--line` para separadores y bordes de card/input/dialog/select.
- `--line-2` para hover imminent (chip-toggle `tab`, section-howto button).
- Cero combo border-shadow: si hay borde, no hay sombra adicional.

### Clipping

- Sin clipping decorativo. La geometría de la página no usa wave / blob / SVG masks. Las únicas formas no rectangulares del sistema son los iconos (`fi fi-rr-*` / `fi fi-br-*` Flaticon, `lucide-react`).

## Components

### Buttons

**Forma:** rectángulo compacto con `rounded-md` (8px). Altura operativa `h-10` (40px), variante `sm` `h-9` (36px), variante `lg` `h-11` (44px), variante `icon` `h-10 w-10` (40×40). Padding horizontal `px-4` (default) / `px-3` (sm) / `px-8` (lg). Gap interno `gap-2`.

- **Primary (`default`):** relleno `bg-cp-accent` (cobrizo cálido), texto `cp-accent-ink`, hover `bg-cp-accent/90`. Focus ring `ring-2 ring-cp-accent ring-offset-2 ring-offset-cp-bg`. Disabled `opacity-50 pointer-events-none`.
- **Outline:** `bg-cp-bg` (papel), borde `border-line`, hover `bg-cp-accent-soft hover:text-cp-accent`. Estado para "acción secundaria que no es CTA".
- **Secondary:** `bg-cp-bg2` (arena), texto `text-ink2`, hover `bg-cp-bg2/80`. Estado para agrupación de acciones dentro de un card.
- **Ghost:** transparente en reposo, hover `bg-cp-accent-soft hover:text-cp-accent`. Para acciones terciarias en listas densas.
- **Destructive:** `bg-cp-danger`, texto `cp-accent-ink`, hover `bg-cp-danger/90`. Solo para cancelaciones irreversibles (cerrar un presupuesto aprobado, eliminar un material).
- **Link:** texto `text-cp-accent underline-offset-4 hover:underline`. Para enlaces dentro de párrafos.
- **Focus / Disabled:** todos comparten `focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-cp-accent focus-visible:ring-offset-2` y `disabled:pointer-events-none disabled:opacity-50`. Sin excepciones.
- **Iconografía interna:** `lucide-react`, tamaño heredado `h-4 w-4` (`[&_svg]:size-4 [&_svg]:shrink-0`).

### Cards / Containers

**Forma:** `rounded-lg` (10px) con `border border-line bg-cp-surface text-ink shadow-sm`. Padding `p-6` en header / content / footer.

- **Header:** `flex flex-col space-y-1.5 p-6`.
- **Title:** `text-2xl font-semibold leading-none tracking-tight` (Inter title role).
- **Description:** `text-sm text-ink3` (caption role).
- **Content:** `p-6 pt-0`.
- **Footer:** `flex items-center p-6 pt-0`.

Variantes sin shadow: paneles admin densos (`OverviewPage.tsx:51,188,243`, `WorkshopDetailPage.tsx:111,174`) usan `rounded-lg border bg-cp-bg2` sin `shadow-sm` para integrarse visualmente con el sidebar.

### Inputs / Fields

**Forma:** `rounded-md` (8px), `border border-line bg-cp-bg`, `h-10` (40px). Padding `px-3 py-2`. Texto `text-base md:text-sm` para no saltar al hacer zoom. Placeholder `text-ink3`.

- **Focus:** `focus-visible:ring-2 focus-visible:ring-cp-accent focus-visible:ring-offset-2`. Sin cambio de borde; el ring hace todo el trabajo.
- **Disabled:** `disabled:cursor-not-allowed disabled:opacity-50`.
- **Error:** `aria-invalid` lo aplica el wrapper con `text-destructive text-xs`. El primitive no tiene estado de error propio.
- **Helper text:** `text-xs text-ink3` debajo del campo. Errores en `text-destructive text-xs`.
- **Field row pattern:** `<div className="space-y-1.5"><Label htmlFor="…">…</Label><Input id="…" … /><p className="text-xs text-muted-foreground">…</p></div>`.
- **Search inputs:** van `bg-cp-bg2 pl-9/pl-10` con icono leading (`Search`) — se ven "empotrados" en la superficie, distintos a los form inputs.

### Navigation

**Estilo:** sidebar `w-60` desktop con `bg-cp-surface border-r border-line`, topbar `h-14` con `bg-cp-surface/85 backdrop-blur sticky top-0 z-10`. Bottom-tabs mobile `bg-cp-surface/95 backdrop-blur` con FAB contextual encima (`shadow-xl`).

- **Sidebar item (`row-icon`):** `flex items-center gap-3 rounded-md px-3 h-9 text-[13.5px] font-medium text-ink2 hover:bg-cp-bg2 hover:text-ink`. Activo: `bg-cp-accent-soft text-cp-accent`. Iconos `fi fi-rr-*` (Flaticon Uicons regular-rounded, `text-base leading-none shrink-0`).
- **Bottom-tab mobile:** `flex flex-1 flex-col items-center justify-center gap-0.5 py-2 text-[10px] font-medium`. Mismo tratamiento de activo.
- **Mobile header:** `h-12 px-4 border-b bg-cp-surface/85 backdrop-blur lg:hidden sticky top-0 z-10`. Title brand con `truncate flex-1 text-[14px]`. Square nav buttons `h-11 w-11`.
- **Skip links:** dos skip-to-content (`Saltar al contenido`) anclados a `#main`. WCAG 2.1 AA obligatorios; `focus-visible` los muestra.

### Chips (toggle)

**Forma:** cuatro variantes de chip toggle según contexto (`filter`, `tab`, `category`, `nav-chip`):

- `filter` — `rounded-md px-3 py-1.5 text-[12.5px]`. Activo: `bg-cp-accent-soft text-cp-accent`.
- `tab` — `flex-1 rounded-lg px-3 py-1.5 text-[13px]`. Activo: `bg-cp-surface text-ink shadow-sm` (separado del fondo `bg-cp-bg2`).
- `category` — `rounded-full border border-line px-3 py-1 text-[12px]`. Activo: `border-cp-accent bg-cp-accent-soft text-cp-accent`.
- `nav-chip` — `rounded-full border border-line px-3 py-1.5 text-xs`. Activo: `bg-cp-accent text-cp-accent-ink border-cp-accent`.

Todos comparten `aria-pressed={active}` y `focus-ring` (outline 2px en `cp-accent`, offset 2px).

### Mobile FAB (signature)

**Forma:** píldora `rounded-full bg-cp-accent px-5 h-12 text-[14px] font-medium text-cp-accent-ink shadow-xl`. Posición fija `left-1/2 -translate-x-1/2 bottom-[calc(72px+env(safe-area-inset-bottom)+14px)]`. Solo mobile (`lg:hidden`).

- **Hover / Active:** `hover:scale-[1.02] active:scale-95`. Único componente con scale-transform.
- **Focus ring:** usa `.focus-ring` global (`outline 2px var(--cp-accent) offset 2px`).

### Dialog (signature)

**Forma:** `fixed left-[50%] top-[50%] z-50 grid w-full max-w-lg max-h-[90vh] translate-x-[-50%] translate-y-[-50%] gap-4 overflow-y-auto border bg-cp-bg p-6 shadow-lg duration-200 sm:rounded-lg`. Overlay `fixed inset-0 z-50 bg-black/80`.

- Animación Radix: `data-[state=open]:animate-in fade-in-0 zoom-in-95 slide-in-from-left-1/2 slide-in-from-top-[48%]`.
- Overlay cerrado: `data-[state=closed]:pointer-events-none` para no tragarse clicks.
- Header / Title / Description: `flex flex-col space-y-1.5 text-center sm:text-left`, `text-lg font-semibold leading-none tracking-tight`, `text-sm text-ink3`.
- Footer: `flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2`.

### Brand mark (signature)

**Forma:** cuadrado `bg-cp-accent text-cp-accent-ink` con icono `fi fi-br-hammer` (Flaticon bold-rounded). Tamaños `xs h-6 w-6 text-[11px]` / `sm h-7 w-7 text-sm` / `md h-9 w-9 text-base` / `lg h-10 w-10 text-lg`. Shape `square` (`rounded-md`) o `rounded` (`rounded-xl`).

- **Wordmark:** `font-display font-semibold tracking-tight text-ink text-[15px]`. Solo visible en `sm+`.
- En mobile, la wordmark se reemplaza por el `sectionTitle` derivado de la nav activa (mono eyebrow pequeño).

## Do's and Don'ts

### Do:

- **Do** usá `bg-cp-accent` para acciones primarias; el resto es `bg-cp-bg2`, `bg-cp-surface` o borde. La voz del acento es única.
- **Do** mantené `h-10` (40px) como altura mínima de cualquier control tappable. WCAG 2.1 AA + taller polvoriento.
- **Do** renderizá todo número monetario en `JetBrains Mono` con `tnum`. Alineación decimal > estética.
- **Do** usá `border-line` para separar superficies; las sombras son para overlays.
- **Do** usá `font-display` (Space Grotesk) para `PageHeader` y KPI destacados; `Inter` para todo lo demás.
- **Do** usá `bg-cp-accent-soft` para hover/activo de nav y chips cuando el contexto es plano.
- **Do** usá `focus-visible:ring-2 focus-visible:ring-cp-accent focus-visible:ring-offset-2 focus-visible:ring-offset-cp-bg` en todo focusable. Sin outline nativo.
- **Do** respetá `prefers-reduced-motion: reduce` (`src/index.css:315–329`). Cero animaciones para ese usuario.
- **Do** proveé skip-to-content anchors (`#main`) en cualquier layout con navegación lateral.

### Don't:

- **Don't** agregues un color secundario de acento. La paleta tiene uno. Sumar un segundo es romper la `One Voice Rule`.
- **Don't** uses `shadow-sm` fuera de cards, panels y pills de landing. La sombra es señal de elevación, no decoración.
- **Don't** uses gradientes. Ni en hero, ni en card, ni en botón. La paleta es plana y el cobre es plano.
- **Don't** uses `transition-all`. Solo `transition-colors`, `transition-transform` (FAB y Switch thumb), `transition-opacity` (dialog close).
- **Don't** uses `rounded-full` por estilo en componentes estructurales. Solo en badges, avatars, pills de status y el FAB.
- **Don't** uses los tokens HSL legacy (`hsl(var(--primary))` etc.). OKLCH es la fuente de verdad.
- **Don't** uses `text-black` o `text-white` literales. Usá `text-ink` y `text-cp-accent-ink`; el sistema nunca es blanco puro ni negro puro.
- **Don't** uses animaciones de `tailwindcss-animate` que no sean `fade-*` o `zoom-*`. `accordion-down/up` está sin usar por diseño.
- **Don't** uses dark mode como default. El sistema arranca en `.theme-sawdust` (papel cálido). Dark es opt-in por usuario vía `useTheme()`.
- **Don't** signalices estado solo con color. Cada estado lleva icono, etiqueta o posición adicional.