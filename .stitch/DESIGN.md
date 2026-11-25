# Design System: gifkit Studio

## 1. Visual Theme & Atmosphere
A restrained, darkroom-inspired media utility with tactile precision and calibrated density (Density: 6/10 — Daily Studio Balanced, Variance: 6/10 — Asymmetric Tool Layout, Motion: 5/10 — Crisp Hardware-Accelerated CSS). The interface evokes a physical video color-grading console: deep neutral graphite surfaces, 1px hairline structural dividers, tabular monospace telemetry, and a single warm signal accent that guides the eye strictly to active controls and the primary export action.

## 2. Color Palette & Roles
- **Carbon Slate** (`#111214`) — Primary application canvas (never pure `#000000`)
- **Elevated Graphite** (`#17191D`) — Primary panel and container surface
- **Control Well** (`#1E2127`) — Nested trim controls, stat cells, inputs, and inactive presets
- **Pressed Well** (`#262A32`) — Hover states on secondary surfaces and chips
- **Chalk White** (`#F4F4F5`) — Primary headings, values, and labels (Zinc-100)
- **Muted Pewter** (`#9CA3AF`) — Secondary descriptions, field hints, and metadata
- **Hairline Divider** (`rgba(255, 255, 255, 0.08)`) — Primary 1px structural borders
- **Crisp Edge** (`rgba(255, 255, 255, 0.16)`) — Interactive control borders and hover hairlines
- **Signal Amber** (`#D97736`) — Single calibrated accent (saturation ~68% < 80%) for primary CTA, active mode tab, slider thumbs, focus rings, and active width presets
- **Signal Amber Hover** (`#E48749`) — Primary CTA hover fill
- **Amber Wash** (`rgba(217, 119, 54, 0.14)`) — Tinted badge and dragover surface fill
- **Alert Crimson** (`#DC2626`) — Destructive cancel action and error states (with `rgba(220, 38, 38, 0.12)` tint)

## 3. Typography Rules
- **Display & Headings:** `Space Grotesk` (weights 600–700) — Track-tight (`-0.025em`), controlled scale, weight-and-contrast hierarchy rather than oversized headings.
- **UI Body:** `Plus Jakarta Sans` (weights 400–600) — Clean geometric legibility, relaxed line-height (`1.5`), descriptions constrained to `65ch` max-width.
- **Monospace Telemetry:** `JetBrains Mono` (weights 500–600, `font-variant-numeric: tabular-nums`) — Mandatory for all timestamps, frame counts, FPS readouts, dimensions, percentages, and byte sizes.
- **Banned:** `Inter`, generic serif fonts, decorative script fonts.

## 4. Component Stylings
- **Buttons:** Flat geometry (`10px` radius), zero outer neon glow. Primary button uses solid **Signal Amber** (`#D97736`) with high-contrast dark ink (`#111214`) and tactile `-1px` active feedback. Secondary buttons use **Control Well** (`#1E2127`) with a `1px` **Crisp Edge** border.
- **Panels & Surfaces:** Restrained `14px` corners, `1px` **Hairline Divider** border, subtle ambient shadow without bloom.
- **Inputs & Sliders:** Labels strictly above inputs (never floating). Focus rings use `2px` **Signal Amber** outline offset by `2px`. Range sliders use calibrated **Signal Amber** accent track and tabular monospace readout aligned right.
- **Empty State / Dropzone:** Composed geometric inline SVG film-frame graphic paired with crisp typographic hierarchy and asymmetric left-aligned editorial metadata strip — zero raw emojis.
- **Progress Indicator:** Linear hairline progress track (`6px` height) with solid **Signal Amber** fill and monospace percentage counter.

## 5. Layout Principles
- **Grid-First Responsive Architecture:** Max-width `1140px` container, generous breathing room (`28px` vertical rhythm).
- **Asymmetric Studio Split:** `1.25fr / 1fr` two-column desktop grid prioritizing live media preview and timeline trimming on the left, export parameters on the right.
- **Mobile Collapse:** Clean single-column collapse below `768px` with full-width tap targets.

## 6. Motion & Interaction
- Hardware-accelerated `transform` and `opacity` transitions (`150ms cubic-bezier(0.2, 0.8, 0.2, 1)`).
- Tactile press states (`translateY(1px)`) on buttons and chips.
- Smooth `width` interpolation on the extraction/encoding progress bar.

## 7. Anti-Patterns (Banned)
- No AI purple/blue neon gradients or glowing button halos.
- No pure `#000000` backgrounds.
- No `Inter` font or serif fonts in the studio UI.
- No raw emojis as UI icons (use crisp inline SVG strokes).
- No generic filler copy ("Unleash", "Elevate", "Seamless", "Next-Gen").
- No 3-column equal card grids or floating input labels.
