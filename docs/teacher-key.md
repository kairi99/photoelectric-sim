# Teacher key

_Generated from the physics model by `npm run teacher-key`. Do not edit by hand; edit the model or the tasks._

Values are noise-free equilibrium plateaus (what a student should read, to within needle reading of about 0.02 V).
Real runs approach the plateau asymptotically; the "settled" badge appears when the projected remaining rise (|dU/dt| times the local time constant) stays below the threshold for 5 s: 1 mV in Explore (the digital reading sigma, so a settled Explore reading is within what the display resolves) and 1 mV or 0.1 % of U in Lab (far below the 20 mV needle readability).

## Expected plateaus U0

| Line | ν (THz) | hν (eV) | Explore U0 (V) | Lab U0 (V, equilibrium) | Lab U0 (V, after 60 s) |
|---|---|---|---|---|---|
| yellow 578 nm | 519 | 2.15 | 0.618 | 0.588 | 0.588 |
| green 546 nm | 549 | 2.27 | 0.743 | 0.704 | 0.704 |
| blue 436 nm | 688 | 2.84 | 1.318 | 1.226 | 1.226 |
| violet 405 nm | 741 | 3.06 | 1.537 | 1.401 | 1.401 |

The leaflet example (Table 1) reads 0.59, 0.70, 1.23, 1.40 V, close to the lab column.

## Fitted h from the four visible lines

| Case | h (×10⁻³⁴ J·s) | vs true | slope (V/THz) | intercept (V) |
|---|---|---|---|---|
| Explore, clean | 6.63 | -0.0 % | 0.00414 | -1.527 |
| Lab, clean | 5.90 | -10.9 % | 0.00368 | -1.319 |
| Explore, dirty photocell | 6.51 | -1.7 % | 0.00406 | -1.496 |
| Explore, stray light (0.000019) | 6.00 | -9.5 % | 0.00374 | -1.257 |
| Explore, anode emission (0.005) | 6.26 | -5.5 % | 0.00391 | -1.450 |

### Why the clean Lab run is about −10 %

The Lab bench is not ideal: the cell leaks (3.55×10¹² Ω), the K-contaminated ring anode emits a back-current from scattered light (0.5 % of each line reaches it), the Fermi–Dirac edge at room temperature fades the cutoff (the thermal tail alone lets the weak low-frequency lines charge slightly past U0), and a small stray-light fraction (0.00047) from bluer lines lifts the yellow and green plateaus. Leakage and the anode back-current pull the high plateaus down; together the four effects flatten the U0 vs ν line, so the clean Lab fit gives 5.90×10⁻³⁴ J·s (-10.9 %). The leaflet's own bench gives 6.1×10⁻³⁴ (about −8 %). This is a property of the bench model, not an error of the student.

The `planck` task therefore tests h against the Lab model value 5.90, with a ±10 % window: 5.31 to 6.49×10⁻³⁴ J·s. A needle misreading of up to 0.02 V in the worst pattern moves h only to 5.65–6.15 (-4.2 % to 4.2 %), so honest reading keeps a margin of about 5.8 percentage points inside the limit. A single bad point (e.g. a line recorded without discharging) pushes the fit out of the window and triggers the hint.

True h = 6.63×10⁻³⁴ J·s (e = 1.6022×10⁻¹⁹ C). The leaflet obtains 6.1×10⁻³⁴.
The intercept of e·U0 vs ν is not the cathode work function (anode work function enters, leaflet eq. VII).

## Uncertainty of the fit

Each Lab reading carries the needle readability u = 0.020 V (a fifth of the smallest division, 0.1 V, on the 3 V range). The error bar of a line with n readings is u_line = √(s²/n + u²): the scatter s/√n (Type A) averages down, the readability u does not (the needle is read against the same marks every time). Only valid readings (aligned, settled, discharged since the line was set) enter the fit; flagged readings stay in the table but are excluded, and readings under different conditions (cathode, dirty, stray, anode, quartz) form separate groups.

One reading per line gives a weighted fit h = 5.90 ± 0.17 (×10⁻³⁴ J·s, statistical). The meter class (2.5 % of full scale) is a limit of error, so its standard uncertainty is the GUM rectangular value σ_sys = h × (2.5 / 100) / √3 = 0.09×10⁻³⁴ J·s (gain error, fully correlated; the offset part, up to ±0.075 V, moves the intercept and not h). The verdict uses σ_tot = √(σ_stat² + σ_sys²) = 0.19×10⁻³⁴ J·s (σ_sys = 0 in Explore): h = (5.90 ± 0.17 stat ± 0.09 sys)×10⁻³⁴ J·s, deviation -10.9 % (-3.8 σ_tot), verdict "beyond2". The clean Lab bench is off by systematic effects (leakage, stray light, anode back-current and the thermal tail), not by chance.

With 4 identical readings per line (s = 0) the error bars stay at u = 0.020 V: h = 5.90 ± 0.17 stat, -3.8 σ_tot. Repeating shrinks only the random part; the readability and the systematics remain.

## Error sources: plateaus (explore)

| Line | Clean (V) | Dirty (V) | Stray light (V) | Anode emission (V) |
|---|---|---|---|---|
| yellow 578 nm | 0.618 | 0.610 | 0.735 | 0.578 |
| green 546 nm | 0.743 | 0.735 | 0.743 | 0.696 |
| blue 436 nm | 1.318 | 1.303 | 1.313 | 1.239 |
| violet 405 nm | 1.537 | 1.511 | 1.529 | 1.445 |

- **Dirty photocell** (leakage 10¹² Ω): every plateau sags, the high ones more, so the slope and h fall (see the table).
- **Stray light** (preset): photocurrent from the other, higher-U0 lines keeps the capacitor charged, so the low-frequency plateaus are lifted most and the slope falls. Because the explore source is very bright (the stray current is a fraction of it), a stray fraction of only about 10⁻⁵ is enough; with more, yellow and green merge into one value.
- **Anode emission** (the ring anode, whose work function is 0.37 eV below the cathode's (1.527 vs 1.9 eV) and far below Pt, is hit by scattered light): its electrons are accelerated back to the cathode, so a reverse current flows that does not vanish at U0. Every plateau stops where the charging current falls to this back-current, below U0, and more for the high-frequency lines, so the slope and h fall.
- In Explore, any error switch also puts in the electrometer input resistance (10¹³ Ω) instead of the ideal 10²¹ Ω. Without it any stray current would charge every line to the UV U0 and h would be ~0.
- All three effects give a **lower** h, so the answer to the `error-sources` prediction is "Lower".

## Lab instrument effects (not part of the plateaus above)

- **Needle zero:** the analog needle starts with a seeded mechanical offset of 0.03 to 0.06 V (either sign) on the 3 V range. The student must zero it with the key held (the zero-adjust control). A reading recorded with the zero off by more than 15 mV triggers a coach nudge; the first-U0 tolerance (±0.05 V) is of the same size as the offset, so a student who skips the zero adjust can miss it.
- **Meter accuracy:** class 2.5 (percent of full scale) is the bound; this instrument's seeded gain error is drawn within ±1.0 % of the reading.
- **Lamp drift:** the line intensities wander slowly by up to ±1 % (tens of seconds); the plateau moves by well under 1 mV, far below the needle resolution.
- **Capacitor dielectric absorption:** about 0.03 % of the charging voltage creeps back after a short discharge, a fraction of a millivolt, invisible on the needle.

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
- Teacher note: Leaflet value 0.59 V; the simulated lab plateau is in docs/teacher-key.md. Tolerance ±0.05 V allows honest needle reading (~0.02 V). The reading only counts if the capacitor was discharged after the line was set. Typical mistake: 2.1 V, equating e·U0 with h·ν and forgetting W. The needle starts a few hundredths of a volt off zero: a student who skips the zero adjust may miss the window. Also remind them not to touch the setup while measuring.

### `repeat-spread` — Repeat and spread

Level 2 · lab mode · concept: Random vs systematic error

- Prediction answer: **Nearly the same; tiny differences are possible**
- Success: At least four valid (settled and discharged) readings of the same line, each taken after a fresh discharge (checked in the procedure log).
- Teacher note: Answer: nearly the same, and identical readings are possible. Success: at least 4 valid readings (settled, discharged since the line was set) of the same line, each after a fresh discharge. In this model the needle does not vary between repeats (under 1 mV), so students reading to 0.02 V will often type the same value four times (s = 0): that is the teaching moment, the error bar then stays at the needle readability (0.02 V on the 3 V range), not zero. Any spread is the student's own reading scatter. Ask: would 100 readings fix a miscalibrated meter? (No: systematic.) Would they shrink the error bar to zero? (No: the readability does not average down.) The error bar is √(s²/n + u²), u the reading uncertainty.

### `intensity` — Brighter, higher U0?

Level 2 · explore mode · concept: Intensity vs energy

- Prediction answer: **The same**
- Success: Two valid (settled and discharged) measurements of the same line, one at beam intensity ≥ 0.9 and one at ≤ 0.3.
- Teacher note: Answer: the same (to within noise). Misconception: more light means faster electrons. Point at the live chart: the slope differs, the plateau does not. Wait times grow at low beam intensity, so encourage speed ×20.

### `planck` — Measure Planck's constant

Level 2 · lab mode · concept: h from the slope

- Prediction answer: **h/e**
- Success: Four distinct valid lines (settled and discharged) and a fit with h within 10 % of the Lab model value 5.90×10⁻³⁴ J·s (not of the true 6.63).
- Teacher note: Success: four valid lines (settled and discharged) and h within 10 % of the h this bench model gives for the mode (about 5.9 in Lab, not 6.63; see docs/teacher-key.md). The chart shows h ± stat ± sys and the distance from 6.63 in units of σ_tot = √(σ_stat² + σ_sys²): with honest needle readings σ_stat is about 0.17·10⁻³⁴ and the meter's class gives σ_sys = h·2.5 %/√3 ≈ 0.09·10⁻³⁴ (GUM, rectangular), so the clean Lab result is about 4 σ_tot low, a systematic effect, not bad luck. Ask the class why the result is about 10 % low and why the intercept does not give W of potassium (anode work function, eq. VII).

### `threshold` — Bright but below threshold

Level 3 · explore mode · concept: Threshold frequency

- Prediction answer: **No, not at all**
- Success: Cathode Zn, lamp warm, the violet line aligned, key released ≥ 30 s ago and U < 10 mV.
- Teacher note: Answer: no. Misconception: enough intensity must eventually eject electrons (classical wave picture). Even the 365 nm UV line (3.40 eV) is below Zn here; the UV line is invisible and weak, and it is not on the window anyway. Contrast with the previous tasks, where only the colour set U0.

### `error-sources` — When the bench lies

Level 3 · explore mode · concept: Systematic errors

- Prediction answer: **Lower**
- Success: Dirty, stray light or anode emission on, four distinct valid (settled and discharged) lines measured with the error active, and a fit available.
- Teacher note: Answer: lower, in all three cases (verified against the model; numbers in docs/teacher-key.md). With the stray preset the fit gives an h about 10 % low and yellow and green stay apart but close; with more stray light they would collapse onto one value. Anode emission lowers every plateau (violet most) and h by about 6 %: the reverse current of the low-work-function ring competes with the charging current, so the plateau stops where the two balance, below U0. Link to the leaflet notes on cleaning.

