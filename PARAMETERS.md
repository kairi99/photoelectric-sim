# Empirical model parameters

Every empirical or fitted parameter of the model is listed here (honest-model invariant). Physical constants are not listed.

| Parameter | Value | Unit | Source / fit | Date |
|---|---|---|---|---|
| `W_A_eV` (effective ring-anode work function) | 1.555 | eV | Fitted so the clean, long-wait U0 of yellow (578 nm) = h*nu/e - 1.555 = 0.590 V (leaflet Table 1 yellow). Far below Pt (~5.6 eV) because the ring is K-contaminated (evaporated cathode material); U0 follows the anode barrier (eq. VII). | 2026-10-20 |
| `CATHODES.photocell.W_C_eV` | 1.9 | eV | Effective/as-built threshold of the LD 558 77 K layer, chosen so yellow (2.145 eV) still emits; pure K (2.29 eV) would not emit at 578 nm. Does not enter U0. | 2026-10-20 |
| `CATHODES.Cs / Na / K / Zn .W_C_eV` | 2.1 / 2.36 / 2.29 / 4.3 | eV | Literature polycrystalline work functions (CRC Handbook of Chemistry and Physics, "Electron work function of the elements"); explore-only ideal metals. | 2026-10-20 |
| `HG_LINES[].lambda_nm` | 578.0 / 546.1 / 435.8 / 404.7 / 365.0 | nm | Hg spectral lines; yellow is the mean of the 577.0/579.1 nm doublet. | 2026-10-20 |
| `HG_LINES[].relPower` | yellow 1.0, green 1.0, blue 1.0, violet 0.6, uv 0.05 | relative | Effective line power on the cathode (lamp output x prism/lens transmission). Violet fitted (grid search) to Table 1 jointly with `I_REF_A`; others set to 1 (no evidence to distinguish them). UV 0.05 because glass optics absorb it. | 2026-10-20 |
| `I_REF_A` | 8e-11 | A | Saturation photocurrent for a unit-power, full-QE line, fitted so the lab 60 s readings match Table 1. Gives I_sat of ~20 pA (yellow) to 80 pA (blue/violet). Larger than the "few pA" first guess because the (1-U/U0)^2 approach is only algebraic: the deficit at time t is C*U0^2/(I_sat*t), and the violet deficit of ~0.11 V at 60 s needs tens of pA. | 2026-10-20 |
| `QE_RAMP_eV` | 1.0 | eV | Photon energy above threshold over which the quantum yield ramps 0 to 1 (linear). Assumed shape; makes yellow current ~4x weaker than violet. | 2026-10-20 |
| `C_TOTAL_F` | 120e-12 | F | 100 pF capacitor (leaflet) + ~20 pF estimated for cell, screened cable and electrometer input. | 2026-10-20 |
| `R_CELL_CLEAN_Ohm` | 1e14 | Ohm | Estimated surface leakage of a clean cell (alcohol-cleaned glass); fitted within an order of magnitude in the lab calibration. | 2026-10-20 |
| `R_CELL_DIRTY_Ohm` | 1e12 | Ohm | Estimate for a fingerprinted/dirty cell (leaflet names leakage from dirt as an error source); not fitted. | 2026-10-20 |
| `R_INPUT_Ohm` | 1e13 | Ohm | Electrometer input resistance, lower bound (> 1e13 Ohm), acts in parallel with the cell leakage. | 2026-10-20 |
| `KEY_TAU_s` | 0.05 | s | Discharge time constant with the key held (analytic decay; contact short is faster). Held 1 s gives e^-20, i.e. 0. | 2026-10-20 |
| `stray_fraction` (lab) | 0.005 | fraction | Each non-selected line leaks into the cathode at this fraction of its own current (dust/fingerprints on optics). Fitted jointly in the lab calibration; ideal = 0. | 2026-10-20 |
| `IDEAL.R_cell_Ohm = R_input_Ohm` | 1e21 | Ohm | "Effectively infinite" but finite so the ODE and bisection stay well-defined; small enough that the equilibrium sits within 1 mV of U0 even for the weak UV line. | 2026-10-20 |
| `LAB.wait_s` | 60 | s | Upper end of the leaflet's "30 s to 1 min" waiting time. | 2026-10-20 |

## Lab calibration result (2026-10-20)

Grid search over I_ref, violet/blue/yellow relative power, stray fraction and cell leakage; noise-free reading at t = 60 s after release.

| Line | Model U (V) | Table 1 (V) | Residual (V) | Ideal U0 (V) |
|---|---|---|---|---|
| yellow 578 | 0.5943 | 0.59 | +0.004 | 0.590 |
| green 546 | 0.7003 | 0.70 | +0.000 | 0.715 |
| blue 436 | 1.2282 | 1.23 | -0.002 | 1.290 |
| violet 405 | 1.3946 | 1.40 | -0.005 | 1.509 |

Fitted h = 5.86e-34 J s (slope 3.66e-15 V s, intercept -1.30 V) against the Table 1 fit of 5.91e-34. The ~10 % under-reading of the slope arises from the finite waiting time (the approach to U0 is algebraic, slowest at high U0) plus cell leakage; stray light lifts the low-frequency lines.
