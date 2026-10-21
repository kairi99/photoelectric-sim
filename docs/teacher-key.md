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

### Why the clean Lab run is about −10 %

The Lab bench is not ideal: the cell leaks (2.2×10¹² Ω) so the high plateaus sag most, and a small stray-light fraction (0.002) from bluer lines lifts the yellow and green plateaus. Both flatten the U0 vs ν line, so the clean Lab fit gives 5.90×10⁻³⁴ J·s (-11.0 %). The leaflet's own bench gives 6.1×10⁻³⁴ (about −8 %). This is a property of the bench model, not an error of the student.

The `planck` task therefore tests h against the Lab model value 5.90, with a ±10 % window: 5.31 to 6.49×10⁻³⁴ J·s. A needle misreading of up to 0.02 V in the worst pattern moves h only to 5.65–6.15 (-4.2 % to 4.2 %), so honest reading keeps a margin of about 5.8 percentage points inside the limit. A single bad point (e.g. a line recorded without discharging) pushes the fit out of the window and triggers the hint.

True h = 6.63×10⁻³⁴ J·s (e = 1.6022×10⁻¹⁹ C). The leaflet obtains 6.1×10⁻³⁴.
The intercept of e·U0 vs ν is not the cathode work function (anode work function enters, leaflet eq. VII).

## Uncertainty of the fit

Each Lab reading carries the needle readability σ = 0.020 V (a fifth of the smallest division, 0.1 V, on the 3 V range). One reading per line gives a weighted fit h = 5.90 ± 0.17 (×10⁻³⁴ J·s, statistical), which is -4.2 σ from the accepted 6.63: the clean Lab bench is off by a systematic effect (leakage, stray light), not by chance. The meter class (2.5 % of full scale) adds a separate, fully correlated systematic of about 0.15×10⁻³⁴ J·s on h (gain error) and up to ±0.075 V on the intercept (offset error, which does not change h). With n repeated readings of a line the error bar is max(s, σ)/√n.

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
- Success: Lamp on, the violet line was on the cell at some point during the task, and now the yellow line is aligned (`lineOnCell() === "yellow"`).
- Teacher note: Common mistake: picking the longest wavelength or the brightest line. Stress that frequency runs opposite to wavelength. This sets up the later tasks, where U0 grows with ν. About 2 minutes.

### `first-u0` — Your first U0

Level 1 · lab mode · concept: Limit voltage

- Prediction answer: **≈ 0.6 V**
- Success: A valid (settled and discharged) yellow measurement within ±0.05 V of the noise-free plateau of the mode (see table).
- Teacher note: Leaflet value 0.59 V; the simulated lab plateau is in docs/teacher-key.md. Tolerance ±0.05 V allows honest needle reading (~0.02 V). The reading only counts if the capacitor was discharged after the line was set. Typical mistake: 2.1 V, equating e·U0 with h·ν and forgetting W. Also remind them not to touch the setup while measuring.

### `repeat-spread` — Repeat and spread

Level 2 · lab mode · concept: Random vs systematic error

- Prediction answer: **Close, but not identical**
- Success: At least four valid (settled and discharged) readings of the same line, each taken after a fresh discharge (checked in the procedure log).
- Teacher note: Answer: close, but not identical. Success: at least 4 valid readings (settled, discharged since the line was set) of the same line, each after a fresh discharge. Typical Lab needle readability is 0.02 V on the 3 V range and the reading jitter is about 3 mV, so expect s of 0.01 to 0.03 V. Ask: would 100 readings fix a miscalibrated meter? (No: the error is systematic.) The error bar used in the fit is max(s, σ)/√n, where σ is the reading uncertainty.

### `intensity` — Brighter, higher U0?

Level 2 · explore mode · concept: Intensity vs energy

- Prediction answer: **The same**
- Success: Two valid (settled and discharged) measurements of the same line, one at beam intensity ≥ 0.9 and one at ≤ 0.3.
- Teacher note: Answer: the same (to within noise). Misconception: more light means faster electrons. Point at the live chart: the slope differs, the plateau does not. Wait times grow at low beam intensity, so encourage speed ×20.

### `planck` — Measure Planck's constant

Level 2 · lab mode · concept: h from the slope

- Prediction answer: **h/e**
- Success: Four distinct valid lines (settled and discharged) and a fit with h within 10 % of the Lab model value 5.90×10⁻³⁴ J·s (not of the true 6.63).
- Teacher note: Success: four valid lines (settled and discharged) and h within 10 % of the h this bench model gives for the mode (about 5.9 in Lab, not 6.63; see docs/teacher-key.md). The chart shows h ± σ and the distance from 6.63 in σ: with honest needle readings σ is about 0.17·10⁻³⁴, so the Lab result is several σ low, a systematic effect, not bad luck (the meter's own 2.5 % gain bound is listed separately). Ask the class why the result is about 10 % low and why the intercept does not give W of potassium (anode work function, eq. VII).

### `threshold` — Bright but below threshold

Level 3 · explore mode · concept: Threshold frequency

- Prediction answer: **No, not at all**
- Success: Cathode Zn, lamp warm, the violet line aligned, key released ≥ 30 s ago and U < 10 mV.
- Teacher note: Answer: no. Misconception: enough intensity must eventually eject electrons (classical wave picture). Even the 365 nm UV line (3.40 eV) is below Zn here; the UV line is invisible and weak, and it is not on the window anyway. Contrast with the previous tasks, where only the colour set U0.

### `error-sources` — When the bench lies

Level 3 · explore mode · concept: Systematic errors

- Prediction answer: **Lower**
- Success: Dirty or stray light on, four distinct valid (settled and discharged) lines measured with the error active, and a fit available.
- Teacher note: Answer: lower, in both cases (verified against the model; numbers in docs/teacher-key.md). With the stray preset the fit gives an h about 10 % low and yellow and green nearly merge; with more stray light they would collapse onto one value. Link to the leaflet notes on cleaning.

