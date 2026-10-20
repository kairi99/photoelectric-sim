# Empirical model parameters

Every empirical or fitted parameter of the model is listed here (honest-model invariant). Physical constants are not listed.

| Parameter | Value | Unit | Source / fit | Date |
|---|---|---|---|---|
| `W_A_eV` (effective ring-anode work function) | 1.52 | eV | Free calibration parameter, fitted (with `I_REF_A`, LAB stray fraction and LAB leakage) so the LAB steady-state U0 values match Table 1. Far below Pt (~5.6 eV) because the ring is K-contaminated (evaporated cathode material); U0 follows the anode barrier (eq. VII). | 2026-10-20 |
| `CATHODES.photocell.W_C_eV` | 1.9 | eV | Effective/as-built threshold of the LD 558 77 K layer, chosen so yellow (2.145 eV) still emits; pure K (2.29 eV) would not emit at 578 nm. Does not enter U0. | 2026-10-20 |
| `CATHODES.Cs / Na / K / Zn .W_C_eV` | 2.1 / 2.36 / 2.29 / 4.3 | eV | Literature polycrystalline work functions (CRC Handbook of Chemistry and Physics, "Electron work function of the elements"); explore-only ideal metals. | 2026-10-20 |
| `HG_LINES[].lambda_nm` | 578.0 / 546.1 / 435.8 / 404.7 / 365.0 | nm | Hg spectral lines; yellow is the mean of the 577.0/579.1 nm doublet. | 2026-10-20 |
| `HG_LINES[].relPower` | yellow 1.0, green 1.0, blue 1.0, violet 0.6, uv 0.05 | relative | Effective line power on the cathode (lamp output x prism/lens transmission). Violet fitted (grid search) to Table 1 jointly with `I_REF_A`; others set to 1 (no evidence to distinguish them). UV 0.05 because glass optics absorb it. | 2026-10-20 |
| `I_REF_A` | 1e-10 | A | Saturation photocurrent for a unit-power, full-QE line, fitted jointly with the LAB leakage: the leakage deficit at equilibrium is ~U0*sqrt(U/(R*I_sat)), so a ~0.1 V violet deficit needs R*I_sat of a few hundred V. Gives I_sat of ~25 pA (yellow) to ~100 pA (blue). Tens of pA, not a few, also so the plateau is reached within 60 s. | 2026-10-20 |
| `QE_RAMP_eV` | 1.0 | eV | Photon energy above threshold over which the quantum yield ramps 0 to 1 (linear). Assumed shape; makes yellow current ~4x weaker than violet. | 2026-10-20 |
| `C_TOTAL_F` | 120e-12 | F | 100 pF capacitor (leaflet) + ~20 pF estimated for cell, screened cable and electrometer input. | 2026-10-20 |
| `R_CELL_CLEAN_Ohm` | 1e14 | Ohm | Estimated surface leakage of a freshly alcohol-cleaned cell; not used by LAB (LAB is a moderately contaminated bench cell). | 2026-10-20 |
| `R_CELL_DIRTY_Ohm` | 1e12 | Ohm | Estimate for a fingerprinted/dirty cell (leaflet names leakage from dirt as an error source); not fitted. | 2026-10-20 |
| `R_INPUT_Ohm` | 1e13 | Ohm | Electrometer input resistance, lower bound (> 1e13 Ohm), acts in parallel with the cell leakage. | 2026-10-20 |
| `KEY_TAU_s` | 0.05 | s | Discharge time constant with the key held (analytic decay; contact short is faster). Held 1 s gives e^-20, i.e. 0. | 2026-10-20 |
| `LAB.stray_fraction` | 0.002 | fraction | Each non-selected line reaches the cathode at this fraction of its own current (dust/fingerprints on optics). Fitted jointly; small enough that yellow/green plateaus stay near Table 1. Ideal = 0. | 2026-10-20 |
| `LAB.R_cell_Ohm` | 4e12 | Ohm | Surface leakage of the bench cell (some dirt, which the leaflet names as an error source), fitted jointly; in parallel with `R_INPUT_Ohm` gives R_total ~2.9e12 Ohm. Leakage pulls each plateau below U0, more for high U0, which lowers the fitted slope. | 2026-10-20 |
| `IDEAL.R_cell_Ohm = R_input_Ohm` | 1e21 | Ohm | "Effectively infinite" but finite so the ODE and bisection stay well-defined; small enough that the equilibrium sits within 1 mV of U0 even for the weak UV line. | 2026-10-20 |
| `LAB.wait_s` | 60 | s | Upper end of the leaflet's "30 s to 1 min" waiting time. | 2026-10-20 |
| LAB dimming note | - | - | In LAB, dimming changes the plateau slightly (the leakage balance depends on I_sat): a real effect and a teaching point. In IDEAL the plateau is independent of dimming. | 2026-10-20 |

## Lab calibration result (2026-10-20, steady-state based)

Grid search over W_A, I_ref, violet relative power (kept at 0.6), stray fraction and cell leakage, requiring the equilibrium (not a transient) to match Table 1, a plateau between 60 s and 600 s, and h in the target window. Noise-free values:

| Line | U(30 s) | U(60 s) | U(120 s) | U(600 s) | Steady state | Table 1 | Residual | Ideal U0 (W_A = 1.52) |
|---|---|---|---|---|---|---|---|---|
| yellow 578 | 0.562 | 0.581 | 0.586 | 0.587 | 0.587 | 0.59 | -0.003 | 0.625 |
| green 546 | 0.682 | 0.698 | 0.700 | 0.700 | 0.700 | 0.70 | +0.000 | 0.750 |
| blue 436 | 1.222 | 1.235 | 1.236 | 1.236 | 1.236 | 1.23 | +0.006 | 1.325 |
| violet 405 | 1.360 | 1.398 | 1.404 | 1.404 | 1.404 | 1.40 | +0.004 | 1.544 |

Fitted h from the steady states = 5.97e-34 J s (intercept -1.34 V), against 5.91e-34 for the Table 1 fit. The slope deficit comes from leakage: the equilibrium deficit grows with U0, lowering violet (-0.14 V) more than yellow (-0.04 V). Stray light lifts the low-frequency plateaus slightly.

| `IDEAL.I_ref_A` | 1e-9 | A | Explore-mode idealised bright source (10× the lab `I_REF_A`), chosen so the (1−U/U0)² approach reaches U0 within ~10 mV after 60 s; does not change any U0 | 2026-10-20 |
