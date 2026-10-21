# Empirical model parameters

Every empirical or fitted parameter of the model is listed here (honest-model invariant). Physical constants are not listed. Numbers below were computed with the model by `scripts/model-tables.ts` (calibration by `scripts/fit-lab.ts`), dated 2026-10-21 unless stated.

| Parameter | Value | Unit | Source / fit | Date |
|---|---|---|---|---|
| `W_A_eV` (effective ring-anode work function) | 1.527 | eV | FITTED (free calibration parameter, one of 4 for 4 data points, see the calibration section) so the LAB steady-state U0 values match Table 1. Far below Pt (~5.6 eV) because the ring is K-contaminated (evaporated cathode material); U0 follows the anode barrier (eq. VII). Since W_A < W_C the ring pulls electrons (contact field) up to U = (W_C - W_A)/e = 0.373 V. | 2026-10-21 |
| `CATHODES.photocell.W_C_eV` | 1.9 | eV | Effective/as-built threshold of the LD 558 77 K layer, chosen so yellow (2.145 eV) still emits; pure K (2.29 eV) would not emit at 578 nm. It sets the emission threshold (W_C/h = 459 THz) and the energy spread h nu - W_C, but does not enter U0. | 2026-10-20 |
| `CATHODES.Cs / Na / K / Zn .W_C_eV` | 2.1 / 2.36 / 2.29 / 4.3 | eV | Literature polycrystalline work functions (CRC Handbook of Chemistry and Physics, "Electron work function of the elements"); explore-only ideal metals. | 2026-10-20 |
| `HG_LINES[].lambda_nm` | 578.0 / 546.1 / 435.8 / 404.7 / 365.0 | nm | Hg spectral lines; yellow is the mean of the 577.0/579.1 nm doublet. | 2026-10-20 |
| `HG_LAMP_POWER` (relative power of each line in the arc) | yellow 0.80, green 1.00, blue 0.75, violet 0.40, uv 0.90 | relative (546 nm = 1) | ASSUMED. Typical shape of a high-pressure Hg arc spectrum as shown in lamp-maker spectra: 546 nm strongest of the visible lines, the 577/579 doublet and 436 nm somewhat weaker, 405 nm about half, the 365/366 nm triplet comparable to 436 nm. No datasheet was available to verify the numbers, so they are NOT a literature value; real ratios also depend on lamp type and pressure. Not fitted. | 2026-10-21 |
| `OPTICS_TRANSMISSION.glass` | yellow 0.90, green 0.90, blue 0.85, violet 0.78, uv 0.01 | fraction | ASSUMED. Converging lenses plus a direct-vision (flint) prism: near-flat in the yellow/green, falling towards the violet, and almost opaque at 365 nm (flint glass cuts off near 350 to 380 nm). Not measured on the LD optics. | 2026-10-21 |
| `OPTICS_TRANSMISSION.quartz` | 0.92 for yellow to violet, uv 0.90 | fraction | ASSUMED. Fused-silica optics (Fresnel losses only), UV transparent. Explore-only option. | 2026-10-21 |
| `HG_LINES[].relPower` (glass, derived) | yellow 0.720, green 0.900, blue 0.637, violet 0.312, uv 0.009 | relative | = `HG_LAMP_POWER` x glass transmission. Replaces the earlier "all visible lines equal" assumption (violet was once fitted to 0.6 in the first calibration; that free parameter stays removed). With quartz: 0.736, 0.920, 0.690, 0.368, 0.810. | 2026-10-21 |
| `I_REF_A` | 2.56e-10 | A | FITTED jointly with W_A, LAB stray fraction and LAB leakage (see below). Saturation photocurrent for a unit-power, full-QE line. Table 1 fixes only the product R*I_sat; the individual value comes from the timing constraint (meter within 1.5 mV of the plateau at 50 s, so the leaflet's 30 s to 1 min wait works), taking the smallest I_REF that meets it (largest R_cell, i.e. the cleanest cell the data allow). Gives I_sat of 10.7 pA (yellow), 29.5 (green), 96.4 (blue), 59.2 (violet) and 2.1 pA (365 nm through glass). | 2026-10-21 |
| `QE_RAMP_eV` (x0 of the Fowler-type yield) | 1.0 | eV | ASSUMED energy scale of the quantum yield Y(x) = 1 - exp(-(x/x0)^2), x = h nu - W. Fowler theory gives Y proportional to (h nu - W)^2 near threshold (Y ~ (x/x0)^2 for x << x0); the smooth saturation to 1 and the scale are assumptions. Yields at the cathode (W_C = 1.9): yellow 0.058, green 0.128, blue 0.591, violet 0.742, uv 0.894; at the anode (W_A = 1.527): 0.317, 0.425, 0.824, 0.906, 0.970. The old linear ramp (value 1.0 eV too) gave 0.245 / 0.37 / 0.945 / 1 / 1. | 2026-10-21 |
| `T_ROOM_K` (LAB electron temperature) | 298 | K | Room temperature, kT = 0.02568 eV (k_B = 8.617333e-5 eV/K, CODATA 2018). Used by LAB only; the IDEAL scenario has T = 0 (sharp cutoff). | 2026-10-21 |
| `THERMAL_MARGIN_kT` | 12 | kT | Numerical only: the forward current is 6e-6 of saturation at 12 kT past the T = 0 limit voltage, so the steady-state bisection and the voltage clamp use U0 + 12 kT (0.31 V) as the upper bound. | 2026-10-21 |
| `ANODE_ILLUM_FRACTION` | 0.005 | fraction | ASSUMED share of each line's power that reaches the ring anode (light scattered by the cathode and the lens diaphragm, whose reflectance is high for a K film; the ring itself is outside the focused beam). Used by LAB and by the Explore "anode emission" toggle (same value). The anode yield uses the anode work function W_A and the same Fowler-type law. | 2026-10-21 |
| `C_DA_F` | 3.6e-14 | F | Dielectric-absorption branch of the capacitor: 0.036 pF in series with `R_DA_Ohm`. Chosen so the recovered fraction C_da/(C_total + C_da) = 3.0e-4 (0.03 %), the middle of the literature range for polystyrene/styroflex film capacitors (about 0.01 to 0.05 %). LAB only. | 2026-10-21 |
| `TAU_DA_s` (R_DA_Ohm = 5.6e14) | 20 | s | ASSUMED time constant of the absorption branch (R_da = tau/C_da = 5.6e14 Ohm); typical slow absorption times are seconds to minutes. | 2026-10-21 |
| `C_TOTAL_F` | 120e-12 | F | 100 pF capacitor (leaflet) + ~20 pF estimated for cell, screened cable and electrometer input. | 2026-10-20 |
| `R_CELL_CLEAN_Ohm` | 1e14 | Ohm | Estimated surface leakage of a freshly alcohol-cleaned cell; not used by LAB (LAB is a moderately contaminated bench cell). | 2026-10-20 |
| `R_CELL_DIRTY_Ohm` | 1e12 | Ohm | Estimate for a fingerprinted/dirty cell (leaflet names leakage from dirt as an error source); not fitted. | 2026-10-20 |
| `R_INPUT_Ohm` | 1e13 | Ohm | Electrometer input resistance, lower bound (> 1e13 Ohm), acts in parallel with the cell leakage. | 2026-10-20 |
| `KEY_TAU_s` | 0.05 | s | ASSUMED discharge time constant with the key switch held (it is a short across the capacitor; the real short is microseconds, so this is a deliberately slow, visible discharge). Held 1 s gives e^-20, i.e. 0. Not the needle lag (`NEEDLE_TAU_s`). Not changed: the dielectric absorption below does not need a different value. | 2026-10-20 |
| `LAB.stray_fraction` | 4.7e-4 | fraction | Each non-selected line reaches the cathode at this fraction of its own current (dust/fingerprints on optics). Fitted jointly, but WEAKLY CONSTRAINED (the Table 1 fit is nearly as good for 0 to about 6e-4, since it is mainly lifted away by the leakage). Ideal = 0. | 2026-10-21 |
| `LAB.R_cell_Ohm` | 3.55e12 | Ohm | FITTED surface leakage of the bench cell (some dirt, which the leaflet names as an error source); in parallel with `R_INPUT_Ohm` gives R_total ~2.6e12 Ohm. Leakage pulls each plateau below U0, more for high U0 and weak light, which lowers the fitted slope. Cleaner than `R_CELL_DIRTY_Ohm` now that the anode back-current and the thermal tail share the deficit. | 2026-10-21 |
| `IDEAL.R_cell_Ohm = R_input_Ohm` | 1e21 | Ohm | "Effectively infinite" but finite so the ODE and bisection stay well-defined; small enough that the equilibrium sits within 1 mV of U0 even for the weak UV line. Used only while NO error toggle is on. With T > 0 this leak would let U creep past U0 (see the thermal tail), which is why IDEAL keeps T = 0. | 2026-10-20 |
| `IDEAL.I_ref_A` | 1e-9 | A | Explore-mode idealised bright source (about 4x the lab `I_REF_A`), chosen so the approach reaches U0 within ~5 mV after about a minute; does not change any ideal U0. Unchanged by the recalibration. | 2026-10-20 |
| `STRAY_PRESET_FRACTION` | 2.6e-4 | fraction | Explore "stray light" switch. Chosen (scan below) so the fitted h falls by ~10 % (5.95 vs 6.63e-34) while the four plateaus stay strictly increasing (0.714, 0.740, 1.301, 1.507 V) and the low-frequency lines are lifted most. It rose from 8.4e-5 because the yellow line is now much weaker (Fowler yield 0.058, power 0.72) while the stray current from the violet and blue lines is what must lift it. Above ~3e-4 yellow and green merge into one plateau. | 2026-10-21 |
| Explore with an error toggle | `R_input_Ohm` = 1e13 | Ohm | With the ideal 1e21 Ohm any stray current charges every line up to the UV U0 (1.87 V), giving a flat line and h ~ 0. A real bench always has the electrometer input resistance, so while "dirty", "stray light" or "anode emission" is on, Explore uses `R_INPUT_Ohm` (and `R_CELL_DIRTY_Ohm` for the cell when dirty). With the input resistance alone and the bright explore source h is 6.49e-34 (-2.0 %). | 2026-10-21 |
| `NOISE` (explore / lab) | sigma 0.5 mV, offset 0 / sigma 3 mV, offset 2 mV | V | Assumed meter reading jitter and zero offset of the electrometer chain (the amplifier; unrelated to the needle's mechanical zero below); lab values are of the order of a needle reading (0.02 V) divided by a few. Applied as one final step with the injected RNG. | 2026-10-20 |
| `ZERO_OFFSET_MIN_FRAC` / `MAX_FRAC` | 0.010 / 0.020 | fraction of full scale | ASSUMED seeded mechanical zero offset of the analog needle (LAB only, either sign): 0.03 to 0.06 V on the 3 V range, about two to three fine divisions (0.02 V each). The student cancels it with the zero-adjust screw (key held, capacitor empty). | 2026-10-21 |
| `ZERO_ADJUST_RANGE_FRAC` | 0.04 | fraction of full scale | Range of the zero-adjust screw (+-0.12 V on 3 V), enough to cancel any seeded offset. | 2026-10-21 |
| `ZERO_TOL_FRAC` | 0.005 | fraction of full scale | A zero error below 0.015 V on 3 V (under one fine division) counts as zeroed (checklist step, coach nudge). | 2026-10-21 |
| `NEEDLE_MIN_FRAC` | -0.06 | fraction of full scale | The needle can swing slightly below the zero mark before its stop, so a negative zero error is visible. | 2026-10-21 |
| `METER_CLASS_PCT` | 2.5 | % of full scale | ASSUMED accuracy class of a simple analog multimeter (the reference skill gives none). It is the guaranteed error BOUND; a given instrument is typically well inside it, so the seeded gain error is drawn uniformly within +-`METER_GAIN_TYPICAL` x class. Exported for the data-analysis work. | 2026-10-21 |
| `METER_GAIN_TYPICAL` | 0.4 | fraction of the class | ASSUMED: actual gain error of this instrument within +-0.4 x 2.5 % = +-1.0 % of the reading (LAB only; Explore is ideal). Reading error at 2.9 V on the 3 V range stays within 2.5 % of 3 V = 75 mV. | 2026-10-21 |
| `LAMP_DRIFT_REL` | 0.01 | relative | ASSUMED slow wander of the lamp output (LAB only): three seeded sinusoids with periods ~23, 37 and 70 s, total amplitude +-1 % of every line. Lives in the apparatus. Effect on the plateau: 0.3 mV (yellow, blue) to 0.8 mV (violet) peak to peak over 10 minutes, five seeds. | 2026-10-21 |
| `AMBIENT_REL` | 0.01 | relative | ASSUMED room-light level at the cell with the window fully uncovered: every Hg line at 1 % of its own lab current (white light). It is weighted by (1 - `windowCover`) and applies only in lab with room lights on. Effect on the 120 s reading (dark room 0.588 / 0.704 / 1.226 / 1.401 V): window open 0.761 / 0.757 / 1.228 / 1.400 V (yellow +0.173, green +0.053, blue and violet within 2 mV); cover 50 %: yellow 0.645, green 0.726 V; cover 100 %: no effect. With the weaker yellow line the open-window yellow plateau now reads slightly above green: a stray-light artefact of the kind the leaflet warns about. | 2026-10-21 |
| `LINE_SIGMA` | 0.025 | arm fraction | Assumed 1-sigma width of a spectral line image at the window; the cell counts as aligned for overlap > 0.9. Purely geometrical, no physics. Neighbouring lines are 0.18 or more apart (7 sigma), so partial alignment mixes lines only through the tails and the new line powers do not change that. | 2026-10-20 |
| `NEEDLE_TAU_s` | 0.3 | s | Assumed first-order lag of the analogue needle. Not the key discharge (`KEY_TAU_s`). | 2026-10-20 |
| `BEAM_INTENSITY_MIN` | 0.1 | relative | Explore-only neutral-density filter range (0.1 to 1). The real bench has no such filter; the slider (12) covers the emission window and only keeps room light out. | 2026-10-20 |
| `MAX_STEP_V` | 0.01 | V | Numerical only: largest voltage change per integration sub-step, so RK4 cannot jump over the kink of the saturated F(U). | 2026-10-20 |
| `LAB.wait_s` | 60 | s | Upper end of the leaflet's "30 s to 1 min" waiting time. | 2026-10-20 |

## Retarding-field shape F(U), Fowler window and thermal tail

Forward photocurrent = I_sat * F(U) with

F(U) = Phi_T(h nu - max(W_C, W_A + e U)) / Phi_T(h nu - max(W_C, W_A)), clamped to [0, 1],

where Phi_T(x) = 2 (kT)^2 f(x/kT) and f is Fowler's function f(t) = -Li2(-e^t) (derivative ln(1 + e^t)); Phi_T is the number of electrons that can overcome a barrier lying x below the photon energy for an electron gas at temperature T. At T = 0 it is the sharp parabola max(x, 0)^2, so F(U) = ((h nu - max(W_C, W_A + e U)) / (h nu - max(W_C, W_A)))^2: the energy-window law of Fowler theory (the earlier "assumed DuBridge-like parabola" is now its T = 0 limit). An electron needs a total energy above the Fermi level of max(W_C, W_A + e U): W_C to leave the cathode, W_A + e U to climb onto the anode barrier. With W_A < W_C (the K-contaminated ring) F = 1 (saturated) up to U = (W_C - W_A)/e = 0.373 V, then falls over the real energy spread h nu - W_C and is 0 at U0 = (h nu - W_A)/e. It does not move any ideal U0: U0 depends on the anode only, so the e U0 vs nu intercept is -W_A, not -W_C.

**Thermal tail (LAB, T = 298 K, kT = 0.0257 eV).** The Fermi-Dirac edge smears the cutoff: F no longer stops at U0 but fades as e^(-(U - U0)/kT). For blue (U0 = 1.318 V) F is 9.0e-3 at U0 - 3kT, 2.7e-3 at U0 - kT, 1.2e-3 at U0, 5.0e-4 at U0 + kT, 7.3e-5 at U0 + 3kT and 3.7e-6 at U0 + 6kT (the sharp T = 0 law is exactly 0 beyond U0). The slope used by the integrator's step control is the exact derivative (2 kT ln(1 + e^(x/kT)) / Phi_T), and the steady-state upper bound is U0 + 12 kT. With an almost infinite leak (1e21 Ohm) a thermal tail would let U creep past U0 until the tail current has faded below U/R, which for 1e21 Ohm is beyond the whole tail: the steady state runs up to the 12 kT numerical bound (+0.31 V for every line, computed). That is why IDEAL has T = 0 and Explore stays ideal.

**Reverse (anode) photocurrent.** The capacitor makes the anode negative by U relative to the cathode. For an electron leaving the anode that is an ACCELERATING field, not a retarding one: the reverse current is the mirror image of the forward one with the field sign flipped. The barriers for an anode electron of energy epsilon above the anode Fermi level are W_A (to leave) and the cathode vacuum level at W_C - e U, so it needs epsilon >= max(W_A, W_C - e U). With W_A < W_C the reverse current is partly held back by the contact field at U = 0 (e.g. blue: R(0) = ((h nu - W_C)/(h nu - W_A))^2 = 0.51) and exactly saturated for U >= 0.373 V, i.e. at every voltage of interest. It does not vanish at U0 (where the forward current is 0), so the net current charging the capacitor becomes negative there and the plateau stops where I_forward(U) = I_reverse + U/R_total, below U0. Saturated reverse currents in LAB (own line, at 0.8 V): yellow 0.29 pA, green 0.49, blue 0.67, violet 0.36, against forward saturation currents of 10.7 / 29.5 / 96.4 / 59.2 pA. The model keeps U >= 0 (U is the retarding voltage; the anode charging positive is not modelled).

## Lab calibration (2026-10-21)

**This calibration has 4 free parameters (W_A, I_REF_A, LAB.stray_fraction, LAB.R_cell_Ohm) for 4 data points (Table 1), so agreement with Table 1 is a consistency check, not a validation.** Constraints besides the four points: a plateau reached within about a minute (U(50 s) within 1.5 mV of the equilibrium), h in 5.7 to 6.4e-34. The new effects (line powers, Fowler yield, anode back-current, thermal tail, dielectric absorption) use literature or assumed values and add NO fitted parameter; the four parameters above were re-fitted with them in place. Fit: Nelder-Mead on the equilibrium residuals (scale 10 mV) plus the timing penalty and a weak preference for the smallest I_REF (`node scripts/fit-lab.ts`).

| Line | U(30 s) | U(60 s) | U(120 s) | U(600 s) | Steady state | Table 1 | Residual | Ideal U0 (W_A = 1.527) |
|---|---|---|---|---|---|---|---|---|
| yellow 578 | 0.584 | 0.588 | 0.588 | 0.588 | 0.588 | 0.59 | -0.002 | 0.618 |
| green 546 | 0.703 | 0.704 | 0.704 | 0.704 | 0.704 | 0.70 | +0.004 | 0.743 |
| blue 436 | 1.225 | 1.226 | 1.226 | 1.226 | 1.226 | 1.23 | -0.004 | 1.318 |
| violet 405 | 1.389 | 1.401 | 1.401 | 1.401 | 1.401 | 1.40 | +0.001 | 1.537 |

Previous calibration (2026-10-20, other model): steady states 0.592 / 0.702 / 1.218 / 1.407 V, h = 5.90e-34. New: **h = 5.90e-34 J s (-10.9 % vs 6.63e-34 true)**, against 5.91e-34 for the Table 1 fit itself.

### Where the h deficit comes from (computed with the model, steady states, four visible lines)

The effects are NOT additive (each drains or lifts the same plateaus), so every row is a complete case; "alone" rows use the electrometer input resistance (1e13 Ohm) as the only other leak.

| Case | yellow | green | blue | violet | h (1e-34 J s) | vs true |
|---|---|---|---|---|---|---|
| Ideal (no leakage, no stray light) | 0.618 | 0.743 | 1.318 | 1.537 | 6.63 | 0 |
| Electrometer input resistance only (1e13 Ohm) | 0.609 | 0.734 | 1.300 | 1.507 | 6.49 | -2.0 % |
| Leakage alone (cell 3.55e12 Ohm and input) | 0.600 | 0.725 | 1.284 | 1.479 | 6.37 | -3.9 % |
| Stray light alone (4.7e-4, input resistance only) | 0.845 | 0.845 | 1.301 | 1.507 | 4.95 | -25.4 % |
| Anode (reverse) current alone (0.005, input resistance only) | 0.577 | 0.695 | 1.237 | 1.441 | 6.24 | -5.8 % |
| Thermal tail alone (298 K, input resistance only) | 0.683 | 0.810 | 1.353 | 1.542 | 6.21 | -6.3 % |
| Leakage + stray light | 0.618 | 0.733 | 1.289 | 1.487 | 6.31 | -4.8 % |
| Leakage + stray + anode current | 0.567 | 0.686 | 1.215 | 1.394 | 6.00 | -9.5 % |
| Leakage + stray + thermal tail | 0.617 | 0.741 | 1.268 | 1.435 | 5.94 | -10.4 % |
| **Full LAB** (all four) | 0.588 | 0.704 | 1.226 | 1.401 | 5.90 | -10.9 % |

Reading the table: the anode back-current lowers every plateau (most the high ones) and costs h 5.8 % on its own; the thermal tail alone LIFTS the plateaus above U0 (the tail current keeps charging, most for the weak low-frequency lines, which flattens the slope, -6.3 %), in the leaky Lab cell the same leakage drains most of the tail current, so what remains is a lift of yellow by 0.021 V and violet by 0.007 V relative to the same Lab without the tail. Taking the anode current out of full LAB changes h by +0.04e-34 (5.94) and the thermal tail by +0.10e-34 (6.00): both matter at the 1 to 2 % level once leakage is present. Stray light alone would be far worse (-25 %), but the leakage drains the stray-lifted low plateaus (leakage + stray: -4.8 %).

### Lab intensity effect (the lab has no filter; the model says what a filter would do)

The plateau is where the photocurrent equals the leakage plus the back-current, so it depends on the photocurrent. Steady states (V) and fitted h with `beamIntensity` 1 versus 0.25:

| beamIntensity | yellow | green | blue | violet | h (1e-34 J s) |
|---|---|---|---|---|---|
| 1 | 0.588 | 0.704 | 1.226 | 1.401 | 5.90 |
| 0.25 | 0.553 | 0.673 | 1.174 | 1.309 | 5.53 |

A quarter of the light lowers the plateaus by 0.03 V (yellow, green) to 0.09 V (violet) and h by 6.3 %. In Explore without an error toggle the plateau does not depend on the beam intensity (U0 is independent of intensity).

### Explore before/after for the error toggles (steady states, four visible lines)

| Case | yellow | green | blue | violet | h (1e-34 J s) | vs ideal |
|---|---|---|---|---|---|---|
| Clean (ideal) | 0.618 | 0.743 | 1.318 | 1.537 | 6.626 | 0 |
| Input resistance only (1e13 Ohm) | 0.609 | 0.734 | 1.300 | 1.507 | 6.49 | -2.0 % |
| Dirty cell (1e12 Ohm, input 1e13 Ohm) | 0.588 | 0.713 | 1.261 | 1.440 | 6.19 | -6.6 % |
| Stray light preset (2.6e-4, input 1e13 Ohm) | 0.714 | 0.740 | 1.301 | 1.507 | 5.95 | -10.2 % |
| Anode emission (0.005, input 1e13 Ohm) | 0.577 | 0.695 | 1.237 | 1.441 | 6.24 | -5.8 % |

Anode emission lowers each plateau by 0.032 V (yellow) to 0.066 V (violet) relative to the input-resistance baseline and keeps them strictly increasing; the reverse current of the K-contaminated ring is what makes the plateau stop below U0. Scan of the explore anode fraction (h vs ideal): 0.001 -3.1 %, 0.002 -4.0 %, 0.005 -5.8 %, 0.01 -8.0 %, 0.02 -11.1 %, 0.05 -17.4 % (violet plateau 1.486 down to 1.248 V). Scan of the explore stray fraction: 1e-4 -2.4 % (yellow 0.612), 2e-4 -5.8 % (0.657), 2.6e-4 -10.2 % (0.714), 3e-4 -12.9 % (yellow = green = 0.747), 5e-4 -27 % (0.858).

### Quartz optics (Explore option)

With glass, the 365 nm line (relative power 0.009) is a weak I_sat (8.0 pA with the Explore source, 2.1 pA with the Lab source); with fused quartz (0.81) it is 724 pA with the Explore source, 90 times stronger. The ideal U0 does not change (1.870 V for UV); a five-point fit (yellow, green, blue, violet, UV with quartz) returns h = 6.63e-34. The UV point is at arm position 0.04 in Explore only.

### Capacitor dielectric absorption (LAB, computed from the model)

C_da = 0.036 pF, tau_da = 20 s. A 1.4 V capacitor discharged by holding the key, then released in the dark and watched for 15 minutes, soaks back (peak, with the Lab leakage draining it): hold 0.5 s 0.39 mV (0.028 %), 1 s 0.33 mV (0.024 %), 5 s 0.27 mV (0.019 %), 20 s 0.13 mV (0.009 %), 60 s 0.017 mV (0.001 %); without leakage 0.47 / 0.40 / 0.33 / 0.16 / 0.021 mV. That is a hundredth of the needle's reading resolution (0.02 V): physically right and, honestly, invisible to the student (it would matter with a digital voltmeter reading to 0.1 mV).
