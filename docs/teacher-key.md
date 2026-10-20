# Teacher key

_Generated from the physics model by `npm run teacher-key`. Do not edit by hand; edit the model or the tasks._

Values are noise-free equilibrium plateaus (what a student should read, to within needle reading of about 0.02 V).
Real runs approach the plateau asymptotically; the "settled" badge appears when the rate is below 1 mV/s.

## Expected plateaus U0

| Line | ν (THz) | hν (eV) | Explore U0 (V) | Lab U0 (V, equilibrium) | Lab U0 (V, after 60 s) |
|---|---|---|---|---|---|
| yellow 578 nm | 519 | 2.15 | 0.625 | 0.587 | 0.581 |
| green 546 nm | 549 | 2.27 | 0.750 | 0.701 | 0.698 |
| blue 436 nm | 688 | 2.84 | 1.325 | 1.236 | 1.235 |
| violet 405 nm | 741 | 3.06 | 1.544 | 1.404 | 1.398 |

The leaflet example (Table 1) reads 0.59, 0.70, 1.23, 1.40 V, close to the lab column.

## Fitted h from the four visible lines

| Case | h (×10⁻³⁴ J·s) | vs true | slope (V/THz) | intercept (V) |
|---|---|---|---|---|
| Explore, clean | 6.63 | -0.0 % | 0.00414 | -1.520 |
| Lab, clean | 5.97 | -10.0 % | 0.00372 | -1.342 |
| Explore, dirty photocell | 6.33 | -4.4 % | 0.00395 | -1.453 |
| Explore, stray light (0.02) | 0.00 | -100.0 % | 0.00000 | 1.877 |

True h = 6.63×10⁻³⁴ J·s (e = 1.6022×10⁻¹⁹ C). The leaflet obtains 6.1×10⁻³⁴.
The intercept of e·U0 vs ν is not the cathode work function (anode work function enters, leaflet eq. VII).

## Error sources: plateaus (explore)

| Line | Clean (V) | Dirty (V) | Stray light (V) |
|---|---|---|---|
| yellow 578 nm | 0.625 | 0.594 | 1.877 |
| green 546 nm | 0.750 | 0.717 | 1.877 |
| blue 436 nm | 1.325 | 1.276 | 1.877 |
| violet 405 nm | 1.544 | 1.467 | 1.877 |

- **Dirty photocell** (leakage 10¹² Ω): every plateau sags, the high ones more, so the slope and h fall slightly.
- **Stray light** (preset): the highest-U0 component (the UV line) charges the capacitor too and drags every reading towards one value, the low-frequency lines most. The slope collapses, so h is far too low. Real stray light is weaker but pushes the same way.
- Both effects give a **lower** h, so the answer to the `error-sources` prediction is "Lower".

## Photon energies and the zinc threshold

Zn work function in the model: 4.3 eV. Violet photon: 3.06 eV, so no emission, whatever the intensity.

## Tasks

### `find-line` — Find the yellow line

Level 1 · explore mode · concept: Photon energy

- Prediction answer: **Violet, 405 nm**
- Success: Lamp on and the yellow line aligned on the cell (`lineOnCell() === "yellow"`).
- Teacher note: Common mistake: picking the longest wavelength or the brightest line. Stress that frequency runs opposite to wavelength. This sets up the later tasks, where U0 grows with ν. About 2 minutes.

### `first-u0` — Your first U0

Level 1 · lab mode · concept: Limit voltage

- Prediction answer: **≈ 0.6 V**
- Success: A settled yellow measurement within ±0.05 V of the noise-free plateau of the mode (see table).
- Teacher note: Leaflet value 0.59 V; the simulated lab plateau is in docs/teacher-key.md. Tolerance ±0.05 V allows honest needle reading (~0.02 V). Typical mistake: 2.1 V, equating e·U0 with h·ν and forgetting W. Also remind them not to touch the setup while measuring.

### `intensity` — Brighter, higher U0?

Level 2 · explore mode · concept: Intensity vs energy

- Prediction answer: **The same**
- Success: Two settled measurements of the same line, one at dimming ≥ 0.9 and one at ≤ 0.3.
- Teacher note: Answer: the same (to within noise). Misconception: more light means faster electrons. Point at the live chart: the slope differs, the plateau does not. Wait times grow at low dimming, so encourage speed ×20.

### `planck` — Measure Planck's constant

Level 2 · lab mode · concept: h from the slope

- Prediction answer: free number (h in 10⁻³⁴ J·s, recalled at the end, no check)
- Success: Four distinct settled lines and a fit with h within 15 % of 6.63×10⁻³⁴ J·s.
- Teacher note: Success: four settled lines and h within 15 % of the true value. Expected fit values per mode are in docs/teacher-key.md. Ask the class why the result is slightly low and why the intercept does not give W of potassium (anode work function, eq. VII).

### `threshold` — No light, no electrons

Level 3 · explore mode · concept: Threshold frequency

- Prediction answer: **No, not at all**
- Success: Cathode Zn, lamp warm, a visible line aligned, key released ≥ 30 s ago and U < 10 mV.
- Teacher note: Answer: no. Misconception: enough intensity must eventually eject electrons (classical wave picture). Even the 365 nm UV line (3.4 eV) is below Zn here, and it is not on the window anyway. Contrast with the previous tasks, where only the colour set U0.

### `error-sources` — When the bench lies

Level 3 · explore mode · concept: Systematic errors

- Prediction answer: **Lower**
- Success: Dirty or stray light on, four distinct settled lines measured with the error active, and a fit available.
- Teacher note: Answer: lower, in both cases (verified against the model; numbers in docs/teacher-key.md). The stray preset is strong, so the points collapse towards one value. Real stray light is weaker but acts in the same direction. Link to the leaflet notes on cleaning.

