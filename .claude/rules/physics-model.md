---
paths:
  - "src/physics/**"
  - "src/apparatus/**"
  - "tests/**"
  - "PARAMETERS.md"
---

# Physics model rules

- `src/physics` is pure and DOM-free: no DOM, storage, timers or hidden randomness. Functions take and return numbers
  or plain data.
- SI units with the unit in the name (`lambda_nm`, `nu_Hz`, `U_V`, `t_s`, `C_F`, `I_A`). State units in the doc comment
  when a name cannot carry them. Convert nm/eV only locally inside a function.
- Every function's doc comment cites where its physics comes from: leaflet equation (III to VII), Einstein relation, or
  a standard reference. Facts from the leaflet come from the `photoelectric-reference` skill.
- Model functions return the deterministic expectation. Noise is one separate final step with an injected RNG
  (no `Math.random` in physics, no global seeds).
- Every empirical or fitted parameter (photocell quantum efficiency, leakage resistance, stray light, lamp line
  intensities, anode work function, ...) is a named constant with a row in `PARAMETERS.md`: value, unit, source or fit,
  date. Never tune one to hide a physical discrepancy.
- Handle edge cases explicitly: hv below the work function (no photocurrent), U0 = 0, zero illumination, discharged vs
  fully charged capacitor, leakage dominating at low light.
- Do not teach that the e·U0 vs ν intercept is the cathode work function: with connected electrodes the zero-current
  condition is h·ν = W_A + e·U0 (anode work function, equation VII).
- Tests assert physics (leaflet Table 1 values, the linear relation (IV), limits), not snapshot numbers. Give tolerances
  and justify them. Name each test for the physics it checks.
