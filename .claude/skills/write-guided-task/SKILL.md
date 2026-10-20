---
name: write-guided-task
description: Template and checklist for writing an educational guided task for the photoelectric-effect simulation (goal, prediction, allowed controls, auto-checked success condition, explanation, teacher note, bilingual EN/ES strings). Use whenever creating or editing content in src/pedagogy.
---

# Write a guided task

Audience: first-year university students in a modern-physics lab, possibly on a phone. Teachers use the tasks in
class. Each task teaches one idea, is checkable by the simulation, and is short (under 5 minutes).

## Shape: predict, act, observe, explain
1. **Predict**: the student commits to a guess first (choice or number). This turns playing into learning.
2. **Act**: the needed controls are highlighted (lamp, swivelling arm, key switch, dimming slider). Others stay usable.
3. **Observe**: feedback in the views (capacitor voltage climbing to U0, a point on the U0 vs frequency chart).
4. **Explain**: 2 to 4 sentences linking what they saw to Ekin = h·ν − W and e·U0 = h·ν − W, then show the prediction again.

## Task file shape (`src/pedagogy/tasks/<id>.ts`, type `GuidedTask` in `src/pedagogy/task.ts`)
```ts
export const task: GuidedTask = {
  id: 'u0-vs-colour',
  level: 1,                          // 1 intro, 2 core, 3 challenge
  controls: ['arm', 'keySwitch'],    // apparatus controls the task needs
  initial: { line: 'yellow' },
  predict: { kind: 'choice', answer: 2 },
  success: (a) => false,             // read measured data and src/physics; no magic thresholds
}
```
Strings live in `src/i18n.ts` (or a pedagogy dictionary with the same en/es key-parity test) under `task.<id>`:
`title`, `concept`, `predict`, `options`, `act`, `observe`, `explain`, `teacher`. English first, natural Spanish second.

## Checklist
- [ ] One concept, one success condition, under 5 minutes.
- [ ] Success comes from the physics model, not magic numbers.
- [ ] Confronts a misconception: light intensity changes the photocurrent but not U0; U0 depends on frequency, not
      brightness; U0 is reached when the current is exactly zero, not when the capacitor is "full" of charge in general;
      the e·U0 vs ν intercept is not the cathode work function (anode work function enters, equation VII).
- [ ] Uses leaflet symbols: ν (frequency), U0 (limit voltage), W (work function), h, e.
- [ ] Practical pitfalls teachable: dirty photocell leakage, stray light at low frequencies, do not move (induction).
- [ ] Teacher note gives the expected result with justification (example: slope near 0.38e-14 V s gives h about 6.1e-34 J s).
- [ ] Both languages complete, short enough for 360 px.

## Seed ideas
- Which line gives the larger U0, and why? (predict, then measure yellow vs violet)
- Dim the window: does U0 change? (it only changes how long the capacitor takes)
- Plot U0 vs ν for the four lines and read h from the slope.
- Why does stray light spoil the yellow measurement most?
- Why is the intercept not the cathode work function?
