# Photoelectric effect simulation (LD P6.1.4.1 · determining Planck's constant)

Browser-based, physics-driven, **educational** simulation of the compact photoelectric-effect arrangement:
Hg high-pressure lamp, prism, potassium photocell with ring anode, and a 100 pF capacitor that charges to the
limit voltage U0, read on a multimeter. Runs on almost any device (GitHub Pages). Public and **open source**
(MIT code, CC BY 4.0 content). Live: https://kairi99.github.io/photoelectric-sim/

Source documents live in `refs/` (gitignored, copyrighted). Use the `photoelectric-reference` skill instead of the PDFs.

## Commands

```bash
npm install
npm run dev      # Vite dev server
npm test         # Vitest (tests/**/*.test.ts)
npm run build    # tsc && vite build -> dist/
npm run teacher-key  # regenerates docs/teacher-key.md from the model
```

## Non-negotiable invariants

1. **Pure physics.** `src/physics` is pure and DOM-free (no `document`, `window`, `localStorage`, timers, `Math.random`).
2. **SI units with the unit in the name:** `lambda_nm`, `nu_Hz`, `U_V`, `t_s`, `C_F`, `I_A`. Convert only locally
   inside a function (nm to m, eV to J), never across an API.
3. **Views render state and never compute physics.** Physics lives in `src/physics`, device logic in `src/apparatus`.
4. **Expectation is not noise.** Every model function returns the deterministic expected value. Noise (reading
   jitter, leakage drift) is one separate final step with an injected RNG.
5. **Honest model.** Every empirical parameter is documented in `PARAMETERS.md` with value, unit, source or fit, and
   date. Never tune a parameter to hide a physical discrepancy. Remember the leaflet's own lesson: the intercept of
   e·U0 vs ν is not the cathode work function.
6. **i18n:** English default, Spanish second. Never hard-code user-facing text in views; use `src/i18n.ts`.
7. **Mobile first:** must work at 360 px width, touch targets >= 44 px, light and dark themes.

## Style

- Code, comments, commit messages and docs: English. UI strings through the i18n dictionary.
- Visual design: elegant, calm, Apple-like, one accent colour, yet a real instrument. See `.claude/rules/design-system.md`.
- Open-source hygiene: `.claude/rules/open-source.md` (never commit LD material).

## Project Claude config

Rules (`.claude/rules/`): `design-system`, `physics-model`, `open-source`.

Skills (`.claude/skills/`):
- `photoelectric-reference`: paraphrased facts from the leaflet (equations, apparatus, procedure, example data).
- `write-guided-task`: template for guided tasks (predict, act, observe, explain).

Agents (`.claude/agents/`, read-only reviewers; call them after meaningful changes in their area):
`physics-reviewer`, `pedagogy-reviewer`, `design-reviewer`.

## Model roles

The main Opus session reviews, analyzes, plans, orchestrates and reasons. Building, coding, fixing and implementing go
to subagents dispatched with `model: "sonnet"`. Give each a self-contained brief: the goal, the files involved, the
invariants above that apply, and how to verify (which tests to run, `npm run build`). Review its diff before accepting
it. Small edits (typo, one-line fix, docs or config tweak) Opus makes directly. The read-only reviewers stay on Opus.
