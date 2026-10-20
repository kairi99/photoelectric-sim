import { describe, expect, it } from 'vitest'
import { Apparatus, MAX_REAL_DT_s, STRAY_PRESET_FRACTION } from '../src/apparatus/index.ts'
import { IDEAL, LAB, steadyState_V } from '../src/physics/index.ts'
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
  it('stray preset lowers the fitted h by 10-30 %, keeps plateaus strictly increasing and raises low-nu lines most', () => {
    const clean = exploreFit(() => {})
    const stray = exploreFit((a) => a.setOverrides({ stray_fraction: STRAY_PRESET_FRACTION }))
    const drop = 1 - stray.h / H
    expect(drop).toBeGreaterThan(0.095)
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
