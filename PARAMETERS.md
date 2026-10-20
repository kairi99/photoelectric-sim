# Empirical model parameters

Every empirical or fitted parameter of the model is listed here (honest-model invariant). Physical constants are not listed.

| Parameter | Value | Unit | Source / fit | Date |
|---|---|---|---|---|
| `W_A_eV` (effective ring-anode work function) | 1.529 | eV | FITTED (free calibration parameter, one of 4 for 4 data points, see the calibration section) so the LAB steady-state U0 values match Table 1. Far below Pt (~5.6 eV) because the ring is K-contaminated (evaporated cathode material); U0 follows the anode barrier (eq. VII). Since W_A < W_C the ring pulls electrons (contact field) up to U = (W_C - W_A)/e = 0.371 V. | 2026-10-20 |
| `CATHODES.photocell.W_C_eV` | 1.9 | eV | Effective/as-built threshold of the LD 558 77 K layer, chosen so yellow (2.145 eV) still emits; pure K (2.29 eV) would not emit at 578 nm. It sets the emission threshold (W_C/h = 459 THz) and the energy spread h nu - W_C, but does not enter U0. | 2026-10-20 |
| `CATHODES.Cs / Na / K / Zn .W_C_eV` | 2.1 / 2.36 / 2.29 / 4.3 | eV | Literature polycrystalline work functions (CRC Handbook of Chemistry and Physics, "Electron work function of the elements"); explore-only ideal metals. | 2026-10-20 |
| `HG_LINES[].lambda_nm` | 578.0 / 546.1 / 435.8 / 404.7 / 365.0 | nm | Hg spectral lines; yellow is the mean of the 577.0/579.1 nm doublet. | 2026-10-20 |
| `HG_LINES[].relPower` | yellow, green, blue, violet 1.0; uv 0.05 | relative | Visible lines ASSUMED EQUAL (1.0): not fitted and not taken from a literature intensity ratio (the ratios depend on lamp pressure, prism and lens transmission, which are unknown here). Violet was fitted to 0.6 in the first calibration; that free parameter was removed. UV 0.05 is an assumption: glass optics absorb it (explore only, not reachable in lab). | 2026-10-20 |
| `I_REF_A` | 6.5e-11 | A | FITTED jointly with W_A, LAB stray fraction and LAB leakage (see below). Saturation photocurrent for a unit-power, full-QE line. The leakage balance fixes only the product R*I_sat (a few hundred V); the individual value is set by requiring the meter to be within 1.5 mV of the plateau at 50 s, so the leaflet's 30 s to 1 min wait works. Gives I_sat of ~16 pA (yellow) to ~65 pA (blue, violet). | 2026-10-20 |
| `QE_RAMP_eV` | 1.0 | eV | Photon energy above threshold over which the quantum yield ramps 0 to 1. The ramp is LINEAR BY ASSUMPTION; Fowler theory gives a quadratic yield near threshold. Makes yellow current ~4x weaker than violet. | 2026-10-20 |
| `C_TOTAL_F` | 120e-12 | F | 100 pF capacitor (leaflet) + ~20 pF estimated for cell, screened cable and electrometer input. | 2026-10-20 |
| `R_CELL_CLEAN_Ohm` | 1e14 | Ohm | Estimated surface leakage of a freshly alcohol-cleaned cell; not used by LAB (LAB is a moderately contaminated bench cell). | 2026-10-20 |
| `R_CELL_DIRTY_Ohm` | 1e12 | Ohm | Estimate for a fingerprinted/dirty cell (leaflet names leakage from dirt as an error source); not fitted. | 2026-10-20 |
| `R_INPUT_Ohm` | 1e13 | Ohm | Electrometer input resistance, lower bound (> 1e13 Ohm), acts in parallel with the cell leakage. | 2026-10-20 |
| `KEY_TAU_s` | 0.05 | s | ASSUMED discharge time constant with the key switch held (it is a short across the capacitor; the real short is microseconds, so this is a deliberately slow, visible discharge). Held 1 s gives e^-20, i.e. 0. Not the needle lag (`NEEDLE_TAU_s`). | 2026-10-20 |
| `LAB.stray_fraction` | 0.002 | fraction | Each non-selected line reaches the cathode at this fraction of its own current (dust/fingerprints on optics). Fitted jointly, but WEAKLY CONSTRAINED: the Table 1 fit is just as good for 0 to 0.002 (cost 1.6 to 2.1) and worsens beyond 0.005, so 0.002 is the largest value consistent with Table 1. Ideal = 0. | 2026-10-20 |
| `LAB.R_cell_Ohm` | 2.2e12 | Ohm | FITTED surface leakage of the bench cell (some dirt, which the leaflet names as an error source); in parallel with `R_INPUT_Ohm` gives R_total ~1.8e12 Ohm. Leakage pulls each plateau below U0, more for high U0 and weak light, which lowers the fitted slope. | 2026-10-20 |
| `IDEAL.R_cell_Ohm = R_input_Ohm` | 1e21 | Ohm | "Effectively infinite" but finite so the ODE and bisection stay well-defined; small enough that the equilibrium sits within 1 mV of U0 even for the weak UV line. Used only while NO error toggle is on. | 2026-10-20 |
| `IDEAL.I_ref_A` | 1e-9 | A | Explore-mode idealised bright source (about 15x the lab `I_REF_A`), chosen so the approach reaches U0 within ~5 mV after about a minute; does not change any ideal U0. | 2026-10-20 |
| `STRAY_PRESET_FRACTION` | 8.4e-5 | fraction | Explore "stray light" switch. Chosen (scan of the fraction) so the fitted h falls by ~10 % (5.96 vs 6.63e-34), the four plateaus stay strictly increasing (0.731, 0.740, 1.305, 1.520 V) and the low-frequency lines are lifted most (yellow +0.118 V, green +0.004 V, blue/violet +0 V relative to the explore input-resistance baseline). Tiny because the explore source is bright: the stray current competes with a leakage of ~1e-13 A at 1 V. Above ~9e-5 yellow and green merge into one plateau, and at larger fractions every line sits at the same value. | 2026-10-20 |
| Explore with an error toggle | `R_input_Ohm` = 1e13 | Ohm | With the ideal 1e21 Ohm any stray current charges every line up to the UV U0 (1.87 V), giving a flat line and h ~ 0. A real bench always has the electrometer input resistance, so while "dirty" or "stray light" is on, Explore uses `R_INPUT_Ohm` (and `R_CELL_DIRTY_Ohm` for the cell when dirty). With the input resistance alone and the bright explore source h is 6.55e-34 (-1.1 %). | 2026-10-20 |
| `NOISE` (explore / lab) | sigma 0.5 mV, offset 0 / sigma 3 mV, offset 2 mV | V | Assumed meter reading jitter and zero offset of the electrometer chain; lab values are of the order of a needle reading (0.02 V) divided by a few. Applied as one final step with the injected RNG. | 2026-10-20 |
| `AMBIENT_REL` | 0.01 | relative | ASSUMED room-light level at the cell with the window fully uncovered: every Hg line at 1 % of its own lab current (white light). It is weighted by (1 - `windowCover`) and applies only in lab with room lights on. Effect on the 120 s reading: yellow 0.592 -> 0.818 V, green 0.702 -> 0.830 V, blue +4 mV, violet +1 mV; cover 50 %: yellow 0.700 V; cover 100 %: no effect. | 2026-10-20 |
| `LINE_SIGMA` | 0.025 | arm fraction | Assumed 1-sigma width of a spectral line image at the window; the cell counts as aligned for overlap > 0.9. Purely geometrical, no physics. | 2026-10-20 |
| `NEEDLE_TAU_s` | 0.3 | s | Assumed first-order lag of the analogue needle. Not the key discharge (`KEY_TAU_s`). | 2026-10-20 |
| `BEAM_INTENSITY_MIN` | 0.1 | relative | Explore-only neutral-density filter range (0.1 to 1). The real bench has no such filter; the slider (12) covers the emission window and only keeps room light out. | 2026-10-20 |
| `MAX_STEP_V` | 0.01 | V | Numerical only: largest voltage change per integration sub-step, so RK4 cannot jump over the kink of the saturated F(U). | 2026-10-20 |
| `LAB.wait_s` | 60 | s | Upper end of the leaflet's "30 s to 1 min" waiting time. | 2026-10-20 |

## Retarding-field shape F(U)

Photocurrent = I_sat * F(U) with

F(U) = ((h nu - max(W_C, W_A + e U)) / (h nu - max(W_C, W_A)))^2, clamped to [0, 1].

An electron needs a total energy above the Fermi level of max(W_C, W_A + e U): W_C to leave the cathode, W_A + e U to climb onto the anode barrier. With W_A < W_C (the model's K-contaminated ring) F = 1 (saturated) up to U = (W_C - W_A)/e = 0.371 V, then falls over the real energy spread h nu - W_C and is 0 at U0 = (h nu - W_A)/e. For W_A >= W_C it reduces to (1 - U/U0)^2. The parabolic law itself is an assumed parabolic (DuBridge-like) shape near cutoff, not a derived Fowler result. It does not move any ideal U0: U0 depends on the anode only, so the e U0 vs nu intercept is -W_A, not -W_C.

## Lab calibration (2026-10-20)

**This calibration has 4 free parameters (W_A, I_REF_A, LAB.stray_fraction, LAB.R_cell_Ohm) for 4 data points (Table 1), so agreement with Table 1 is a consistency check, not a validation.** Constraints besides the four points: a plateau reached within about a minute (U(50 s) within 1.5 mV of the equilibrium), h in 5.7 to 6.4e-34. The violet relative power is no longer fitted (assumed 1.0 like the other visible lines). The steady states fix W_A and the product R*I_sat; the stray fraction is nearly unconstrained (see its row). Fit: Nelder-Mead on the equilibrium residuals (scale 10 mV) plus the timing penalty.

| Line | Before (steady / 60 s) | U(30 s) | U(60 s) | U(120 s) | U(600 s) | Steady state | Table 1 | Residual | Ideal U0 (W_A = 1.529) |
|---|---|---|---|---|---|---|---|---|---|
| yellow 578 | 0.587 / 0.581 | 0.590 | 0.592 | 0.592 | 0.592 | 0.592 | 0.59 | +0.002 | 0.616 |
| green 546 | 0.700 / 0.698 | 0.700 | 0.702 | 0.702 | 0.702 | 0.702 | 0.70 | +0.002 | 0.741 |
| blue 436 | 1.236 / 1.235 | 1.212 | 1.218 | 1.218 | 1.218 | 1.218 | 1.23 | -0.012 | 1.316 |
| violet 405 | 1.404 / 1.398 | 1.398 | 1.407 | 1.407 | 1.407 | 1.407 | 1.40 | +0.007 | 1.535 |

Fitted h from the steady states = 5.90e-34 J s (before: 5.97e-34), against 5.91e-34 for the Table 1 fit and 6.63e-34 true (-11 %).

### Where the h deficit comes from (computed with the model, steady states, four visible lines)

| Case | h (1e-34 J s) | vs true |
|---|---|---|
| Ideal (no leakage, no stray light) | 6.626 | 0 |
| Electrometer input resistance only (1e13 Ohm) | 6.342 | -4.3 % |
| Leakage alone (cell 2.2e12 Ohm and input, no stray light) | 5.975 | -9.8 % |
| Stray light alone (stray 0.002 with the input resistance only, no cell leak) | 4.836 | -27 % |
| Leakage and stray light together (LAB) | 5.899 | -11.0 % |

Leakage alone explains almost all of the LAB deficit (0.651 of 0.727 e-34). Stray light alone would be far worse, but in the real lab the same leakage drains the stray-lifted low plateaus, so the two effects are not additive: adding the stray light on top of the leakage costs only 0.076e-34 (1 %). Both lower h: leakage sags the high-U0 plateaus (weak light, high U0), stray light lifts the low-frequency ones.

### Lab intensity effect (the lab has no filter; the model says what a filter would do)

The plateau is where the photocurrent equals the leakage U/R, so it depends on the photocurrent. Steady states (V) and fitted h with `beamIntensity` 1 versus 0.25:

| beamIntensity | yellow | green | blue | violet | h (1e-34 J s) |
|---|---|---|---|---|---|
| 1 | 0.592 | 0.702 | 1.218 | 1.407 | 5.90 |
| 0.25 | 0.553 | 0.655 | 1.126 | 1.290 | 5.35 |

A quarter of the light lowers the plateaus by 0.04 V (yellow) to 0.12 V (violet) and h by 9.4 %. In Explore without an error toggle the plateau does not depend on the beam intensity (U0 is independent of intensity).

### Explore before/after for the error toggles (steady states, four visible lines)

| Case | yellow | green | blue | violet | h (1e-34 J s) | vs ideal |
|---|---|---|---|---|---|---|
| Clean (ideal) | 0.616 | 0.741 | 1.316 | 1.535 | 6.626 | 0 |
| Dirty cell (1e12 Ohm, input 1e13 Ohm) | 0.603 | 0.724 | 1.280 | 1.488 | 6.385 | -3.6 % |
| Stray light preset (8.4e-5, input 1e13 Ohm) | 0.731 | 0.740 | 1.305 | 1.520 | 5.959 | -10.1 % |
