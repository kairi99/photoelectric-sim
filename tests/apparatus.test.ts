import { describe, expect, it } from 'vitest'
import {
  Apparatus, LAMP_DRIFT_REL, MAX_REAL_DT_s, METER_CLASS_PCT, METER_GAIN_TYPICAL, STRAY_PRESET_FRACTION, ZERO_ADJUST_RANGE_FRAC, ZERO_OFFSET_MAX_FRAC,
  ZERO_OFFSET_MIN_FRAC, ZERO_TOL_FRAC,
} from '../src/apparatus/index.ts'
import { IDEAL, LAB, limitVoltage_V, nuFromLambda, getLine, steadyState_V } from '../src/physics/index.ts'
import type { HgLineId } from '../src/physics/index.ts'

const VISIBLE: HgLineId[] = ['yellow', 'green', 'blue', 'violet']

function run(a: Apparatus, sim_s: number): void {
  const step = a.speed
  for (let t = 0; t < sim_s - 1e-9; t += step) a.tick(1)
}

function procedure(a: Apparatus, wait_s: number): void {
  a.setLamp(true)
  if (a.mode === 'lab') a.setRange(3)
  run(a, 70)
  for (const id of VISIBLE) {
    a.setArm(a.linePosition(id))
    a.pressKey()
    a.tick(2)
    a.releaseKey()
    run(a, wait_s)
    expect(a.lineOnCell()).toBe(id)
    const typed = a.mode === 'lab' ? Math.round(a.readout().needleValue_V! * 100) / 100 : undefined
    expect(a.record(typed).ok).toBe(true)
  }
}

describe('apparatus procedure', () => {
  it('lab: full procedure gives 4 measurements and a loose h', () => {
    const a = new Apparatus({ mode: 'lab', seed: 7 })
    expect(a.readout().meterRange).toBe('OFF')
    a.setSpeed(5)
    procedure(a, 60)
    expect(a.measurements).toHaveLength(4)
    const fit = a.fitResult()!
    expect(fit.h_Js).toBeGreaterThan(5.0e-34)
    expect(fit.h_Js).toBeLessThan(7.5e-34)
    const acts = a.procedureLog.map((l) => l.action)
    for (const x of ['lampOn', 'meterOn', 'range', 'lineAligned', 'discharged', 'released', 'waited', 'recorded'])
      expect(acts).toContain(x)
  })

  it('explore: same procedure gives h within 2 percent', () => {
    const a = new Apparatus({ mode: 'explore', seed: 3 })
    a.setSpeed(20)
    procedure(a, 1500)
    const fit = a.fitResult()!
    expect(Math.abs(fit.h_Js / 6.62607015e-34 - 1)).toBeLessThan(0.02)
  })
})

describe('device behaviour', () => {
  it('key held keeps the meter near zero', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setLamp(true)
    run(a, 70)
    a.setArm(a.linePosition('blue'))
    run(a, 20)
    expect(a.readout().U_V!).toBeGreaterThan(0.1)
    a.pressKey()
    a.tick(2)
    expect(a.readout().U_V!).toBeLessThan(1e-3)
    run(a, 20)
    expect(Math.abs(a.readout().meterValue_V!)).toBeLessThan(0.01)
  })

  it('lamp off: no charging', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setArm(a.linePosition('violet'))
    run(a, 120)
    expect(a.readout().U_V).toBe(0)
  })

  it('warm-up scales the charging rate', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setLamp(true)
    a.setArm(a.linePosition('violet'))
    a.tick(1)
    expect(a.readout().lampBrightness).toBeLessThan(0.05)
    run(a, 70)
    expect(a.readout().lampBrightness).toBe(1)
  })

  it('misaligned arm charges less and reports no line', () => {
    const al = new Apparatus({ mode: 'explore' })
    const mis = new Apparatus({ mode: 'explore' })
    for (const a of [al, mis]) a.setLamp(true)
    al.setArm(al.linePosition('blue'))
    mis.setArm((mis.linePosition('blue') + mis.linePosition('violet')) / 2)
    for (const a of [al, mis]) run(a, 80)
    expect(mis.lineOnCell()).toBeNull()
    expect(al.lineOnCell()).toBe('blue')
    expect(mis.readout().U_V!).toBeLessThan(al.readout().U_V!)
  })

  it('range 0.3 V with 1.2 V is over range', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.forceCapacitorVoltage_V(1.2)
    a.setRange(0.3)
    run(a, 3)
    expect(a.readout().overRange).toBe(true)
    expect(a.needleFraction()).toBe(1)
    a.setRange(3)
    run(a, 3)
    expect(a.readout().overRange).toBe(false)
  })

  it('is deterministic for the same seed and sequence', () => {
    const mk = () => {
      const a = new Apparatus({ mode: 'lab', seed: 11 })
      a.setLamp(true)
      a.setRange(3)
      a.setArm(a.linePosition('green'))
      const out: unknown[] = []
      for (let i = 0; i < 80; i++) {
        a.tick(0.7)
        out.push(a.readout())
      }
      return out
    }
    expect(mk()).toEqual(mk())
  })

  it('big dt at 20x is stable', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setSpeed(20)
    a.setLamp(true)
    a.setArm(a.linePosition('uv'))
    const max = a.maxU0_V()
    for (let i = 0; i < 100; i++) {
      a.tick(2)
      const U = a.readout().U_V!
      expect(Number.isFinite(U)).toBe(true)
      expect(U).toBeGreaterThanOrEqual(0)
      expect(U).toBeLessThanOrEqual(max)
    }
    a.tick(1e6)
    expect(a.clock_s).toBeLessThanOrEqual(100 * 40 + MAX_REAL_DT_s * 20 + 1e-6)
  })

  it('uv is unreachable in lab, reachable in explore', () => {
    const lab = new Apparatus({ mode: 'lab' })
    const uvLab = lab.spectrumOnWindow().find((l) => l.id === 'uv')!
    expect(uvLab.reachable).toBe(false)
    for (let x = 0; x <= 1; x += 0.005) {
      lab.setArm(x)
      expect(lab.lineOnCell()).not.toBe('uv')
    }
    lab.setSpeed(20)
    expect(lab.speed).toBe(1)
    const ex = new Apparatus({ mode: 'explore' })
    ex.setArm(ex.linePosition('uv'))
    expect(ex.lineOnCell()).toBe('uv')
  })

  it('validates typed values and emits events', () => {
    const a = new Apparatus({ mode: 'lab' })
    const seen: string[] = []
    a.on('record', () => seen.push('record'))
    a.on('release', () => seen.push('release'))
    expect(a.record().ok).toBe(false)
    expect(a.record(31).ok).toBe(false)
    expect(a.record(Number.NaN).ok).toBe(false)
    a.pressKey()
    a.releaseKey()
    expect(a.record(0.5).ok).toBe(true)
    expect(seen).toEqual(['release', 'record'])
    expect(a.measurements[0]!.lineId).toBeNull()
    a.removeMeasurement(0)
    expect(a.measurements).toHaveLength(0)
  })

  it('settles on a plateau and emits settled', () => {
    const a = new Apparatus({ mode: 'explore' })
    let n = 0
    a.on('settled', () => n++)
    a.setLamp(true)
    a.setSpeed(20)
    a.setArm(a.linePosition('yellow'))
    a.pressKey()
    a.tick(1)
    a.releaseKey()
    for (let i = 0; i < 100; i++) a.tick(5)
    expect(a.isSettled()).toBe(true)
    expect(n).toBe(1)
  })

  it('serialize/load round-trips controls; history is bounded', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setLamp(true)
    a.setSpeed(20)
    a.setArm(0.3)
    for (let i = 0; i < 400; i++) a.tick(5)
    expect(a.getHistory().length).toBeLessThanOrEqual(2000)
    const s = a.serialize()
    const b = new Apparatus({ mode: 'explore' })
    b.load(JSON.parse(JSON.stringify(s)))
    expect(b.serialize()).toEqual(s)
    expect(b.getHistory()).toHaveLength(0)
  })
})

describe('measurement and mode events', () => {
  it('fires measurements on record, remove and clear', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setRange(3)
    let n = 0
    a.on('measurements', () => n++)
    a.record()
    a.record()
    expect(n).toBe(2)
    a.removeMeasurement(0)
    expect(n).toBe(3)
    a.removeMeasurement(9)
    expect(n).toBe(3)
    a.clearMeasurements()
    expect(a.measurements).toHaveLength(0)
    expect(n).toBe(4)
    a.clearMeasurements()
    expect(n).toBe(4)
  })

  it('hasReleased is true after a release and false after reset', () => {
    const a = new Apparatus()
    expect(a.hasReleased).toBe(false)
    a.pressKey()
    expect(a.hasReleased).toBe(false)
    a.releaseKey()
    expect(a.hasReleased).toBe(true)
    a.reset()
    expect(a.hasReleased).toBe(false)
  })

  it('fires mode on setMode and resets measurements', () => {
    const a = new Apparatus()
    const seen: string[] = []
    a.on('mode', (m) => seen.push(m))
    a.setRange(3)
    a.record()
    a.setMode('lab')
    expect(seen).toEqual(['lab'])
    expect(a.measurements).toHaveLength(0)
  })
})

describe('measurement context fields', () => {
  it('records beamIntensity, dirty and stray flags at record time', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setLamp(true)
    a.setArm(a.linePosition('green'))
    a.setBeamIntensity(0.3)
    a.setOverrides({ dirty: true, stray_fraction: 0.02 })
    a.record()
    a.setBeamIntensity(1)
    a.setOverrides({ dirty: false, stray_fraction: null })
    a.record()
    const [m1, m2] = a.measurements
    expect(m1).toMatchObject({ beamIntensity: 0.3, dirty: true, stray: true })
    expect(m2).toMatchObject({ beamIntensity: 1, dirty: false, stray: false })
  })
})

describe('settled detector (projected remaining rise, not a fixed rate)', () => {
  const plateau = (mode: 'explore' | 'lab', id: HgLineId) =>
    steadyState_V({ ...(mode === 'lab' ? LAB.params : IDEAL.params), line: id })
  /** Release from discharged and tick 1 s of simulated time until settled; returns release-relative time and U. */
  function untilSettled(a: Apparatus, id: HgLineId, max_s: number): { t_s: number; U_V: number } | null {
    a.setLamp(true)
    if (a.mode === 'lab') a.setRange(3)
    run(a, 70)
    a.setArm(a.linePosition(id))
    a.pressKey()
    a.tick(2)
    a.releaseKey()
    const t0 = a.clock_s
    while (a.clock_s - t0 < max_s) {
      a.tick(1)
      if (a.isSettled()) return { t_s: a.clock_s - t0, U_V: a.serialize().U_V }
    }
    return null
  }
  it('explore UV is not flagged until within ~5 mV of its plateau', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setSpeed(20)
    const r = untilSettled(a, 'uv', 20000)!
    expect(r).not.toBeNull()
    expect(plateau('explore', 'uv') - r.U_V).toBeLessThan(0.005)
  })
  it('explore yellow is flagged only within 5 mV of its plateau', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setSpeed(20)
    const r = untilSettled(a, 'yellow', 20000)!
    expect(r).not.toBeNull()
    expect(plateau('explore', 'yellow') - r.U_V).toBeLessThan(0.005)
  })
  it('lab yellow is flagged only within 5 mV of its plateau', () => {
    const a = new Apparatus({ mode: 'lab' })
    a.setSpeed(5)
    const r = untilSettled(a, 'yellow', 2000)!
    expect(r).not.toBeNull()
    expect(Math.abs(plateau('lab', 'yellow') - r.U_V)).toBeLessThan(0.005)
  })
  it('lab: the leaflet 30-60 s workflow reaches "settled" for all four lines by ~60 s', () => {
    for (const id of VISIBLE) {
      const a = new Apparatus({ mode: 'lab' })
      a.setSpeed(5)
      const r = untilSettled(a, id, 120)
      expect(r, id).not.toBeNull()
      expect(r!.t_s, id).toBeLessThanOrEqual(65)
    }
  })
})

describe('room lights by mode', () => {
  it('default: explore lights on, lab darkened; reset follows the mode', () => {
    expect(new Apparatus({ mode: 'explore' }).roomLights).toBe(true)
    expect(new Apparatus({ mode: 'lab' }).roomLights).toBe(false)
    const a = new Apparatus({ mode: 'lab' })
    a.setMode('explore'); expect(a.roomLights).toBe(true)
    a.setMode('lab'); expect(a.roomLights).toBe(false)
  })
  it('explore: setRoomLights toggles the flag but never changes the readout or U0', () => {
    const run1 = (room: boolean): number => {
      const a = new Apparatus({ mode: 'explore' })
      a.setRoomLights(room)
      expect(a.roomLights).toBe(room)
      a.setLamp(true); a.setSpeed(5)
      for (let i = 0; i < 700; i++) a.tick(0.1)
      a.setArm(a.linePosition('yellow'))
      a.pressKey(); a.tick(2); a.releaseKey()
      for (let i = 0; i < 1200; i++) a.tick(0.1)
      return a.serialize().U_V
    }
    expect(run1(true)).toBe(run1(false))
  })
})

describe('window cover (12) and room light', () => {
  function reading(opts: { room: boolean; cover: number; id?: HgLineId; lamp?: boolean }): number {
    const a = new Apparatus({ mode: 'lab' })
    a.setRoomLights(opts.room)
    a.setWindowCover(opts.cover)
    a.setRange(3)
    a.setLamp(opts.lamp ?? true)
    a.setSpeed(5)
    run(a, 70)
    a.setArm(a.linePosition(opts.id ?? 'yellow'))
    a.pressKey(); a.tick(2); a.releaseKey()
    run(a, 120)
    return a.serialize().U_V
  }
  it('room lights with the window uncovered raise the reading; covering the window removes the effect', () => {
    const dark = reading({ room: false, cover: 0 })
    const lit = reading({ room: true, cover: 0 })
    const covered = reading({ room: true, cover: 1 })
    expect(lit - dark).toBeGreaterThan(0.01)
    expect(Math.abs(covered - dark)).toBeLessThan(1e-4)
  })
  it('with room lights off the window cover has no effect on the reading', () => {
    expect(Math.abs(reading({ room: false, cover: 1 }) - reading({ room: false, cover: 0 }))).toBeLessThan(1e-9)
  })
  it('the cover does not attenuate the beam: no cover effect on the charging curve in the dark room', () => {
    const a = new Apparatus({ mode: 'explore' })
    const b = new Apparatus({ mode: 'explore' })
    b.setWindowCover(1)
    for (const x of [a, b]) { x.setLamp(true); x.setSpeed(20); x.setArm(x.linePosition('blue')); run(x, 90) }
    expect(b.readout().U_V).toBeCloseTo(a.readout().U_V!, 9)
  })
  it('the beam-intensity filter is explore-only and slows charging', () => {
    const lab = new Apparatus({ mode: 'lab' })
    lab.setBeamIntensity(0.2)
    expect(lab.beamIntensity).toBe(1)
    const a = new Apparatus({ mode: 'explore' })
    a.setBeamIntensity(0.01)
    expect(a.beamIntensity).toBe(0.1)
  })
})

describe('explore error toggles', () => {
  const H = 6.62607015e-34
  function exploreFit(set: (a: Apparatus) => void): { h: number; U: number[] } {
    const a = new Apparatus({ mode: 'explore', seed: 5 })
    set(a)
    a.setLamp(true)
    a.setSpeed(20)
    run(a, 70)
    const U: number[] = []
    for (const id of VISIBLE) {
      a.setArm(a.linePosition(id))
      a.pressKey(); a.tick(2); a.releaseKey()
      for (let i = 0; i < 300 && !a.isSettled(); i++) run(a, 20)
      U.push(a.serialize().U_V)
      a.record()
    }
    return { h: a.fitResult()!.h_Js, U }
  }
  it('stray preset lowers the fitted h by about 10 % (9-30 %), keeps plateaus strictly increasing and raises low-nu lines most', () => {
    const clean = exploreFit(() => {})
    const stray = exploreFit((a) => a.setOverrides({ stray_fraction: STRAY_PRESET_FRACTION }))
    const drop = 1 - stray.h / H
    expect(drop).toBeGreaterThan(0.09) // -9.5 % at the preset: yellow and green merge for larger fractions (PARAMETERS.md)
    expect(drop).toBeLessThan(0.3)
    for (let k = 1; k < 4; k++) expect(stray.U[k]!).toBeGreaterThan(stray.U[k - 1]! + 0.005)
    const raise = stray.U.map((u, k) => u - clean.U[k]!)
    expect(raise[0]!).toBeGreaterThan(raise[1]!)
    expect(raise[1]!).toBeGreaterThan(raise[3]! - 1e-3)
    expect(raise[0]!).toBeGreaterThan(0.05)
  })
  it('dirty cell (R_CELL_DIRTY) lowers h; both toggles keep the error-sources answer "lower"', () => {
    const clean = exploreFit(() => {})
    const dirty = exploreFit((a) => a.setOverrides({ dirty: true }))
    const stray = exploreFit((a) => a.setOverrides({ stray_fraction: STRAY_PRESET_FRACTION }))
    expect(dirty.h).toBeLessThan(clean.h)
    expect(stray.h).toBeLessThan(clean.h)
    expect(dirty.U[3]!).toBeLessThan(clean.U[3]! - 0.02)
  })
})

describe('explore settled flag', () => {
  it('means the remaining approach is below the 1 mV digital reading sigma, for every visible line', () => {
    for (const id of VISIBLE) {
      const a = new Apparatus({ mode: 'explore', seed: 3 })
      a.setLamp(true); a.setSpeed(1); run(a, 70)
      a.setArm(a.linePosition(id))
      a.pressKey(); a.tick(2); a.releaseKey()
      for (let i = 0; i < 400 && !a.isSettled(); i++) a.tick(1)
      expect(a.isSettled()).toBe(true)
      const plateau = steadyState_V({ ...IDEAL.params, line: id })
      expect(plateau - a.serialize().U_V).toBeLessThan(2e-3) // projected remaining < 1 mV, plus the linearisation slack
    }
  })
})

describe('dischargedSinceAlign', () => {
  const lab = (): Apparatus => {
    const a = new Apparatus({ mode: 'lab', seed: 3 })
    a.setLamp(true); a.setRange(3); a.setSpeed(5)
    run(a, 70)
    return a
  }
  it('is true after align, hold until ~0, release', () => {
    const a = lab()
    a.setArm(a.linePosition('violet'))
    a.pressKey(); run(a, 5); a.releaseKey(); run(a, 30)
    expect(a.record(1.4).ok && a.measurements[0]!.dischargedSinceAlign).toBe(true)
  })
  it('is false when the line changes and the key is not used again', () => {
    const a = lab()
    a.setArm(a.linePosition('violet'))
    a.pressKey(); run(a, 5); a.releaseKey(); run(a, 60)
    a.setArm(a.linePosition('yellow'))
    run(a, 30)
    a.record(1.5)
    expect(a.measurements[0]!.dischargedSinceAlign).toBe(false)
  })
  it('is false when the key is pressed too briefly, or never released', () => {
    const a = lab()
    a.setArm(a.linePosition('violet'))
    a.pressKey(); run(a, 5); a.releaseKey(); run(a, 60)
    a.setArm(a.linePosition('yellow'))
    a.setSpeed(1)
    a.pressKey(); a.tick(0.05); a.releaseKey(); run(a, 20)
    a.record(1.3)
    expect(a.measurements[0]!.dischargedSinceAlign).toBe(false)
    a.setArm(a.linePosition('green'))
    a.pressKey(); run(a, 5) // still held
    a.record(0)
    expect(a.measurements[1]!.dischargedSinceAlign).toBe(false)
  })
  it('a discharge before the alignment does not count', () => {
    const a = lab()
    a.pressKey(); run(a, 5); a.releaseKey()
    a.setArm(a.linePosition('blue'))
    run(a, 20)
    a.record(0.5)
    expect(a.measurements[0]!.dischargedSinceAlign).toBe(false)
  })
})

/** Hold the key until the capacitor is empty, then turn the zero screw until the needle reads 0 (what a student does). */
function zeroNeedle(a: Apparatus): void {
  a.pressKey()
  run(a, 3)
  for (let i = 0; i < 4; i++) {
    const r = a.readout()
    a.setZeroAdjust(a.zeroAdjust + r.needleValue_V! / ((r.meterRange as number) * ZERO_ADJUST_RANGE_FRAC))
    run(a, 3)
  }
  a.releaseKey()
}

describe('multimeter mechanical zero (Lab)', () => {
  const labMeter = (seed: number): Apparatus => {
    const a = new Apparatus({ mode: 'lab', seed })
    a.setRange(3)
    return a
  }
  it('the needle starts a few hundredths of a volt off zero with the capacitor empty, with a seeded size and sign', () => {
    const offs = new Set<number>()
    for (let seed = 1; seed <= 30; seed++) {
      const a = labMeter(seed)
      const e = a.zeroError_V()
      expect(Math.abs(e)).toBeGreaterThanOrEqual(ZERO_OFFSET_MIN_FRAC * 3 - 1e-12)
      expect(Math.abs(e)).toBeLessThanOrEqual(ZERO_OFFSET_MAX_FRAC * 3 + 1e-12)
      offs.add(Math.sign(e))
      a.pressKey(); run(a, 5)
      // key held, capacitor at 0: the needle shows the zero error (+ electrometer offset 2 mV, noise 3 mV)
      expect(Math.abs(a.readout().needleValue_V! - e)).toBeLessThan(0.02)
    }
    expect(offs.size).toBe(2) // both signs occur over the seeds
    expect(labMeter(5).zeroError_V()).toBe(labMeter(5).zeroError_V()) // deterministic per seed
    expect(labMeter(5).zeroError_V()).not.toBe(labMeter(6).zeroError_V())
  })
  it('the zero-adjust screw can cancel any seeded offset, and the needle then reads 0 with the key held', () => {
    for (let seed = 1; seed <= 20; seed++) {
      const a = labMeter(seed)
      zeroNeedle(a)
      expect(Math.abs(a.zeroErrorFrac())).toBeLessThanOrEqual(ZERO_TOL_FRAC)
      a.pressKey(); run(a, 4)
      expect(Math.abs(a.readout().needleValue_V!)).toBeLessThan(0.015)
      expect(Math.abs(a.zeroAdjust)).toBeLessThanOrEqual(1)
    }
  })
  it('shifts a reading by the zero error until it is adjusted (offset added to every reading)', () => {
    const a = labMeter(4)
    a.forceCapacitorVoltage_V(1.0)
    const before = a.readout().needleValue_V!
    a.setZeroAdjust(a.zeroAdjust + a.zeroErrorFrac() / ZERO_ADJUST_RANGE_FRAC)
    const after = a.readout().needleValue_V!
    expect(Math.abs(before - after)).toBeGreaterThan(0.025)
    expect(Math.abs(after - 1.0 * (1 + a.meterGainError()))).toBeLessThan(1e-9)
  })
  it('Explore is the ideal instrument: no zero error, no gain error, and the adjust control does nothing', () => {
    const a = new Apparatus({ mode: 'explore', seed: 9 })
    a.setRange(3)
    expect(a.zeroError_V()).toBe(0)
    expect(a.meterGainError()).toBe(0)
    a.setZeroAdjust(0.5)
    expect(a.zeroAdjust).toBe(0)
  })
  it('records the zero error with each measurement, and reset restores the offset', () => {
    const a = labMeter(3)
    a.record(0.5)
    expect(a.measurements[0]!.zeroErr_V).toBeCloseTo(a.zeroError_V(), 12)
    zeroNeedle(a)
    a.record(0.5)
    expect(Math.abs(a.measurements[1]!.zeroErr_V)).toBeLessThan(ZERO_TOL_FRAC * 3 + 1e-9)
    a.reset()
    expect(a.zeroAdjust).toBe(0)
    expect(Math.abs(a.zeroErrorFrac())).toBeGreaterThanOrEqual(ZERO_OFFSET_MIN_FRAC - 1e-12)
  })
  it('serialize/load keeps the zero-adjust position', () => {
    const a = labMeter(2)
    a.setZeroAdjust(-0.37)
    const b = new Apparatus({ mode: 'lab', seed: 2 })
    b.load(JSON.parse(JSON.stringify(a.serialize())))
    expect(b.zeroAdjust).toBeCloseTo(-0.37, 12)
  })
})

describe('multimeter accuracy class (Lab)', () => {
  it('the seeded gain error stays well inside the class bound, differs between instruments, and scales the reading', () => {
    expect(METER_CLASS_PCT).toBe(2.5)
    const gains = new Set<number>()
    for (let seed = 1; seed <= 40; seed++) {
      const a = new Apparatus({ mode: 'lab', seed })
      a.setRange(3)
      const g = a.meterGainError()
      expect(Math.abs(g)).toBeLessThanOrEqual(METER_GAIN_TYPICAL * (METER_CLASS_PCT / 100) + 1e-12)
      gains.add(g)
      // reading error at 2.9 V (near full scale) is within class % of full scale (3 V), after zeroing
      a.forceCapacitorVoltage_V(2.9)
      a.setZeroAdjust(a.zeroAdjust + a.zeroErrorFrac() / ZERO_ADJUST_RANGE_FRAC)
      expect(Math.abs(a.readout().needleValue_V! - 2.9)).toBeLessThanOrEqual((METER_CLASS_PCT / 100) * 3)
    }
    expect(gains.size).toBeGreaterThan(30)
  })
})

describe('slow lamp brightness drift (Lab)', () => {
  const intensityRatio = (a: Apparatus): number => {
    const l = a.spectrumOnWindow().find((x) => x.id === 'green')!
    return l.intensity / (a.readout().lampBrightness * 0.9 * 1.0 * 1.0) // green: lamp 1.0 x glass 0.9
  }
  it('is bounded by about 1 %, deterministic for the seed, and actually wanders over tens of seconds', () => {
    const trace = (seed: number): number[] => {
      const a = new Apparatus({ mode: 'lab', seed })
      a.setLamp(true)
      a.setSpeed(5)
      run(a, 70)
      const out: number[] = []
      for (let k = 0; k < 40; k++) { run(a, 5); out.push(intensityRatio(a)) }
      return out
    }
    const t1 = trace(7)
    expect(trace(7)).toEqual(t1)
    expect(trace(8)).not.toEqual(t1)
    for (const r of t1) expect(Math.abs(r - 1)).toBeLessThanOrEqual(LAMP_DRIFT_REL + 1e-9)
    expect(Math.max(...t1) - Math.min(...t1)).toBeGreaterThan(0.002)
  })
  it('does not exist in Explore, and does not stop the "settled" badge in Lab', () => {
    const ex = new Apparatus({ mode: 'explore' })
    ex.setLamp(true); run(ex, 70)
    expect(intensityRatio(ex)).toBeCloseTo(1, 12)
    const a = new Apparatus({ mode: 'lab', seed: 7 })
    a.setLamp(true); a.setRange(3); a.setSpeed(5)
    run(a, 70)
    a.setArm(a.linePosition('green'))
    a.pressKey(); a.tick(2); a.releaseKey()
    for (let i = 0; i < 40 && !a.isSettled(); i++) run(a, 5)
    expect(a.isSettled()).toBe(true)
  })
  it('moves the plateau by only a few mV (it is a 1 % wobble of the intensity)', () => {
    const a = new Apparatus({ mode: 'lab', seed: 7 })
    a.setLamp(true); a.setRange(3); a.setSpeed(5)
    run(a, 70)
    a.setArm(a.linePosition('blue'))
    a.pressKey(); a.tick(2); a.releaseKey()
    run(a, 60)
    const us: number[] = []
    for (let k = 0; k < 40; k++) { run(a, 5); us.push(a.serialize().U_V) }
    expect(Math.max(...us) - Math.min(...us)).toBeLessThan(0.01)
  })
})

describe('explore anode-emission toggle (third error source)', () => {
  const H = 6.62607015e-34
  function fit(set: (a: Apparatus) => void): { h: number; U: number[]; flags: boolean[] } {
    const a = new Apparatus({ mode: 'explore', seed: 5 })
    set(a)
    a.setLamp(true); a.setSpeed(20); run(a, 70)
    const U: number[] = []
    for (const id of VISIBLE) {
      a.setArm(a.linePosition(id))
      a.pressKey(); a.tick(2); a.releaseKey()
      for (let i = 0; i < 300 && !a.isSettled(); i++) run(a, 20)
      U.push(a.serialize().U_V)
      a.record()
    }
    return { h: a.fitResult()!.h_Js, U, flags: a.measurements.map((m) => m.anode) }
  }
  it('lowers every plateau and h by a few percent, keeps the plateaus ordered, and is flagged on the measurements', () => {
    const clean = fit(() => {})
    const rev = fit((a) => a.setOverrides({ anode: true }))
    expect(rev.flags.every(Boolean)).toBe(true)
    expect(clean.flags.some(Boolean)).toBe(false)
    rev.U.forEach((u, k) => expect(u).toBeLessThan(clean.U[k]! - 0.005))
    for (let k = 1; k < 4; k++) expect(rev.U[k]!).toBeGreaterThan(rev.U[k - 1]! + 0.05)
    const drop = 1 - rev.h / H
    expect(drop).toBeGreaterThan(0.03) // documented: about -5.8 % vs the ideal fit (PARAMETERS.md)
    expect(drop).toBeLessThan(0.1)
    expect(clean.h / H).toBeGreaterThan(0.99)
  })
  it('is Explore-only and clears on reset', () => {
    const lab = new Apparatus({ mode: 'lab' })
    lab.setOverrides({ anode: true })
    expect(lab.anode).toBe(false)
    const ex = new Apparatus({ mode: 'explore' })
    ex.setOverrides({ anode: true })
    expect(ex.anode).toBe(true)
    ex.reset()
    expect(ex.anode).toBe(false)
  })
})

describe('explore quartz optics option', () => {
  it('replaces glass transmission: the 365 nm line then charges the cell far faster, and is brighter in the spectrum', () => {
    const t90 = (quartz: boolean): number => {
      const a = new Apparatus({ mode: 'explore' })
      a.setOverrides({ quartz })
      a.setLamp(true); a.setSpeed(20); run(a, 70)
      a.setArm(a.linePosition('uv'))
      a.pressKey(); a.tick(2); a.releaseKey()
      const t0 = a.clock_s
      const u0 = limitVoltage_V(nuFromLambda(getLine('uv').lambda_nm))
      a.setSpeed(1) // the bright Explore source charges in seconds: time it at 1 s resolution
      for (let i = 0; i < 4000; i++) {
        run(a, 1)
        if (a.serialize().U_V > 0.9 * u0) return a.clock_s - t0
      }
      return Infinity
    }
    expect(t90(true)).toBeLessThan(t90(false) / 5)
    const g = new Apparatus({ mode: 'explore' })
    const q = new Apparatus({ mode: 'explore' })
    q.setOverrides({ quartz: true })
    for (const a of [g, q]) { a.setLamp(true); run(a, 70) }
    const uv = (a: Apparatus): number => a.spectrumOnWindow().find((l) => l.id === 'uv')!.intensity
    expect(uv(q)).toBeGreaterThan(20 * uv(g))
    expect(uv(g)).toBeLessThan(0.05)
  })
  it('does not count as an error source (no input resistance added) and the ideal U0 values stay true', () => {
    const a = new Apparatus({ mode: 'explore', seed: 2 })
    a.setOverrides({ quartz: true })
    a.setLamp(true); a.setSpeed(20); run(a, 70)
    a.setArm(a.linePosition('green'))
    a.pressKey(); a.tick(2); a.releaseKey()
    for (let i = 0; i < 300 && !a.isSettled(); i++) run(a, 20)
    expect(Math.abs(a.serialize().U_V - steadyState_V({ ...IDEAL.params, optics: 'quartz', line: 'green' }))).toBeLessThan(0.006)
    expect(Math.abs(a.serialize().U_V - limitVoltage_V(nuFromLambda(getLine('green').lambda_nm)))).toBeLessThan(0.006)
  })
  it('Lab ignores the option (glass optics only)', () => {
    const a = new Apparatus({ mode: 'lab' })
    a.setOverrides({ quartz: true })
    a.setLamp(true); run(a, 70)
    expect(a.spectrumOnWindow().find((l) => l.id === 'uv')!.intensity).toBeLessThan(0.05)
  })
})

describe('capacitor dielectric absorption in the Lab bench', () => {
  it('a little voltage creeps back after the key is released in the dark, far below the needle resolution', () => {
    const a = new Apparatus({ mode: 'lab', seed: 1 })
    a.forceCapacitorVoltage_V(1.4)
    a.setRange(3)
    a.pressKey(); a.tick(2); a.releaseKey()
    let peak = 0
    a.setSpeed(5)
    for (let i = 0; i < 60; i++) { run(a, 5); peak = Math.max(peak, a.serialize().U_V) }
    expect(peak).toBeGreaterThan(1e-4)
    expect(peak).toBeLessThan(1e-3)
  })
})

describe('five-point fit with quartz optics (explore)', () => {
  it('a UV point joins the U0 vs nu fit and the ideal instrument still returns the true h within 2 %', () => {
    const a = new Apparatus({ mode: 'explore', seed: 4 })
    a.setOverrides({ quartz: true })
    a.setLamp(true); a.setSpeed(20); run(a, 70)
    for (const id of [...VISIBLE, 'uv'] as HgLineId[]) {
      a.setArm(a.linePosition(id))
      a.pressKey(); a.tick(2); a.releaseKey()
      for (let i = 0; i < 300 && !a.isSettled(); i++) run(a, 20)
      a.record()
    }
    expect(a.measurements.map((m) => m.lineId)).toContain('uv')
    const fit = a.fitResult()!
    expect(fit.n).toBe(5)
    expect(Math.abs(fit.h_Js / 6.62607015e-34 - 1)).toBeLessThan(0.02)
  })
})
