# Teacher key

_Generated from the physics model by `npm run teacher-key`. Do not edit by hand; edit the model or the tasks._

Values are noise-free equilibrium plateaus (what a student should read, to within needle reading of about 0.02 V).
Real runs approach the plateau asymptotically; the "settled" badge appears when the projected remaining rise (|dU/dt| times the local time constant) stays below 1 mV (or 0.1 % of U) for 5 s.

## Expected plateaus U0

| Line | ν (THz) | hν (eV) | Explore U0 (V) | Lab U0 (V, equilibrium) | Lab U0 (V, after 60 s) |
|---|---|---|---|---|---|
| yellow 578 nm | 519 | 2.15 | 0.616 | 0.592 | 0.592 |
| green 546 nm | 549 | 2.27 | 0.741 | 0.702 | 0.702 |
| blue 436 nm | 688 | 2.84 | 1.316 | 1.218 | 1.218 |
| violet 405 nm | 741 | 3.06 | 1.535 | 1.407 | 1.407 |

The leaflet example (Table 1) reads 0.59, 0.70, 1.23, 1.40 V, close to the lab column.

## Fitted h from the four visible lines

| Case | h (×10⁻³⁴ J·s) | vs true | slope (V/THz) | intercept (V) |
|---|---|---|---|---|
| Explore, clean | 6.63 | -0.0 % | 0.00414 | -1.529 |
| Lab, clean | 5.90 | -11.0 % | 0.00368 | -1.318 |
| Explore, dirty photocell | 6.38 | -3.6 % | 0.00399 | -1.463 |
| Explore, stray light (0.000084) | 5.96 | -10.1 % | 0.00372 | -1.247 |

True h = 6.63×10⁻³⁴ J·s (e = 1.6022×10⁻¹⁹ C). The leaflet obtains 6.1×10⁻³⁴.
The intercept of e·U0 vs ν is not the cathode work function (anode work function enters, leaflet eq. VII).

## Error sources: plateaus (explore)

| Line | Clean (V) | Dirty (V) | Stray light (V) |
|---|---|---|---|
| yellow 578 nm | 0.616 | 0.603 | 0.730 |
| green 546 nm | 0.741 | 0.724 | 0.740 |
| blue 436 nm | 1.316 | 1.280 | 1.305 |
| violet 405 nm | 1.535 | 1.488 | 1.520 |

- **Dirty photocell** (leakage 10¹² Ω): every plateau sags, the high ones more, so the slope and h fall (see the table).
- **Stray light** (preset): photocurrent from the other, higher-U0 lines keeps the capacitor charged, so the low-frequency plateaus are lifted most and the slope falls. Because the explore source is bright, a stray fraction of only ~10⁻⁴ is enough; with more, yellow and green merge into one value.
- In Explore, either error switch also puts in the electrometer input resistance (10¹³ Ω) instead of the ideal 10²¹ Ω. Without it any stray current would charge every line to the UV U0 and h would be ~0.
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
- Success: Two settled measurements of the same line, one at beam intensity ≥ 0.9 and one at ≤ 0.3.
- Teacher note: Answer: the same (to within noise). Misconception: more light means faster electrons. Point at the live chart: the slope differs, the plateau does not. Wait times grow at low beam intensity, so encourage speed ×20.

### `planck` — Measure Planck's constant

Level 2 · lab mode · concept: h from the slope

- Prediction answer: free number (h in 10⁻³⁴ J·s, recalled at the end, no check)
- Success: Four distinct settled lines and a fit with h within 15 % of 6.63×10⁻³⁴ J·s.
- Teacher note: Success: four settled lines and h within 15 % of the true value. Expected fit values per mode are in docs/teacher-key.md. Ask the class why the result is often 5–10 % low and why the intercept does not give W of potassium (anode work function, eq. VII).

### `threshold` — No light, no electrons

Level 3 · explore mode · concept: Threshold frequency

- Prediction answer: **No, not at all**
- Success: Cathode Zn, lamp warm, a visible line aligned, key released ≥ 30 s ago and U < 10 mV.
- Teacher note: Answer: no. Misconception: enough intensity must eventually eject electrons (classical wave picture). Even the 365 nm UV line (3.4 eV) is below Zn here, and it is not on the window anyway. Contrast with the previous tasks, where only the colour set U0.

### `error-sources` — When the bench lies

Level 3 · explore mode · concept: Systematic errors

- Prediction answer: **Lower**
- Success: Dirty or stray light on, four distinct settled lines measured with the error active, and a fit available.
- Teacher note: Answer: lower, in both cases (verified against the model; numbers in docs/teacher-key.md). With the stray preset the fit gives an h about 10 % low and yellow and green nearly merge; with more stray light they would collapse onto one value. Link to the leaflet notes on cleaning.

