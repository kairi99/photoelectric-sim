---
name: photoelectric-reference
description: Paraphrased facts from the LD leaflet P6.1.4.1 (Planck's constant, photoelectric effect, compact arrangement) - equations, apparatus, optical path, procedure, example data, caveats. Use before judging any physics number, writing apparatus logic, or writing tasks. Source PDFs are copyrighted and live in refs/ (gitignored); use this instead.
---

# Photoelectric effect: reference (paraphrased from LD leaflet P6.1.4.1)

## Goal
Measure the kinetic energy of photoelectrons as a function of light frequency and determine Planck's constant h.

## Physics
- Photon energy E = h·ν. Einstein: Ekin = ½·m·v² = h·ν − W (W = work function).
- Limit voltage U0: the anode voltage at which the photocurrent becomes exactly zero.
- (III) e·U0 = h·ν − W
- (IV) e·ΔU0 = h·Δν
- (V) slope ΔU0/Δν = h/e, so h = e · slope.

## Method
The retarding anode voltage comes from a 100 pF capacitor (rated 630 V) that the photoelectrons themselves charge
until it reaches U0, where the current stops. Light passes through a ring-shaped platinum anode onto a potassium
cathode. An electrometer amplifier lets the multimeter read the capacitor voltage without loading it.

## Apparatus (catalogue numbers)
Photocell for h (558 77) in the compact arrangement (558 79); Hg high-pressure lamp (451 15) with universal choke
(451 30); electrometer amplifier (532 14); 12 V AC plug-in supply (562 791); capacitor 100 pF (578 22); key switch,
normally open (579 10); analog multimeter LD-analog 20 (531 120) on its 3 V DC range; BNC / 4 mm screened cable,
distribution box, cables.

## Optical path (leaflet Fig. 2)
1 Hg lamp, 2 slider, 3 converging lens, 4 slit, 5 imaging lens, 6 direct-vision prism, 7 mirror,
8.1 BNC socket (cathode), 8.2 4 mm sockets (ring anode), 9 swivelling arm with thread guide,
10 converging lens with slit diaphragm, 11 photocell, 12 emission window with dimming slider.

### Optical adjustment
Image the lamp onto the slit with lens 3. Image the slit onto the emission window with lens 5 (via mirror 7).
Insert the prism so that both the violet and the yellow lines reach the window. Screw in the photocell and place the
lens with slit diaphragm so that a chosen spectral line is imaged onto the photocathode.

## Procedure
1. Partially darken the room. Set the multimeter to 3 V DC.
2. Turn the swivelling arm (thread guide) until the shadow of the chosen line is visible at the emission window.
   If the room is not dark enough, cover the window with the dimming slider.
3. Discharge the capacitor by holding the key switch until the meter reads zero.
4. Release the key and wait about 30 s to 1 min until the capacitor has charged to U0. Note U0.
5. Repeat for green, blue and violet (and yellow).

## Pitfalls
- The capacitor voltage is sensitive to induction: do not move around or touch the setup while measuring.
- Dirt on the photocell causes leakage currents between anode and cathode that shift U0. Clean with alcohol.
- Dust or fingerprints on the optics cause stray light, giving a too-high U0 at low frequencies.

## Table 1: measuring example
| Line | lambda (nm) | nu (THz) | U0 (V) |
|---|---|---|---|
| yellow | 578 | 519 | 0.59 |
| green | 546 | 549 | 0.70 |
| blue | 436 | 688 | 1.23 |
| violet | 405 | 741 | 1.40 |

## Example result
Slope 0.38e-14 V s with e = 1.6e-19 C gives h = 6.1e-34 J s (literature 6.62e-34 J s).

## Supplementary notes
- Potassium is chosen because alkali metals have a low work function.
- The intercept of e·U0 versus ν does NOT give the cathode work function. When cathode and anode are connected their
  Fermi levels align, so the electron has to overcome W_A + e·U0 (W_A = anode work function). The current is zero when
  (VII) h·ν = W_A + e·U0. W_A depends on crystal orientation and adsorbed gas, so it is hard to determine.
- Historical: the Compton effect later confirmed the particle nature of light. In the photoelectric effect the whole
  photon energy is absorbed.
