---
paths:
  - "src/views/**"
  - "src/styles/**"
  - "src/pedagogy/**"
  - "src/main.ts"
  - "index.html"
---

# UI design rules

- **Feel:** elegant, simple, calm, Apple-like. Also precise: a lab instrument, not a toy.
- Use only the design tokens (CSS custom properties) from `src/styles/tokens.css`. No ad-hoc colours, font sizes,
  radii, shadows or durations.
- One accent colour. The four Hg line colours (`--phys-yellow` 578 nm, `--phys-green` 546 nm, `--phys-blue` 436 nm,
  `--phys-violet` 405 nm) mean the same thing in every view (bench, charts, table, legends), and are never the only
  signal: always add the wavelength label.
- Motion only when it carries meaning (swivelling arm, capacitor voltage rising, a point appearing on the chart).
  Ease-out, 150 to 350 ms for UI. Always honour `prefers-reduced-motion`.
- Light and dark themes both work: `prefers-color-scheme` plus the manual toggle.
- Mobile first: works at 360 px width, touch targets >= 44 px, no hover-only affordances. Canvas is sized with
  `devicePixelRatio`.
- Accessibility: WCAG AA contrast, full keyboard operation, ARIA labels from the i18n dictionary, never colour alone.
- All user-facing text comes from the i18n dictionary (en default, es).
- Views render state; they do not compute physics.
- After a visible change, ask the `design-reviewer` agent for a critique at 390 / 820 / 1440 px.
