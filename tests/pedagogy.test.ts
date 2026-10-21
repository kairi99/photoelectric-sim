import { describe, expect, it } from 'vitest'
import { Apparatus, ZERO_ADJUST_RANGE_FRAC, ZERO_TOL_FRAC } from '../src/apparatus/index.ts'
import type { Mode } from '../src/apparatus/index.ts'
import { H_Js } from '../src/physics/index.ts'
import type { HgLineId } from '../src/physics/index.ts'
import { TASKS } from '../src/pedagogy/tasks/index.ts'
import { applyInitial, energyVars, expectedFitH_Js, expectedPlateau_V, photonEnergyText, VISIBLE_LINES } from '../src/pedagogy/task.ts'
import type { GuidedTask } from '../src/pedagogy/task.ts'
import { pedagogyStrings } from '../src/pedagogy/strings.ts'
import { checklistState, currentStep } from '../src/pedagogy/checklist.ts'
import { Coach, coachCandidates } from '../src/pedagogy/coach.ts'
import { COVER_MIN } from '../src/pedagogy/checklist.ts'
import { teacherKey } from '../src/pedagogy/teacherKey.ts'

const { en, es } = pedagogyStrings

function keys(o: object, prefix = ''): string[] {
  return Object.entries(o).flatMap(([k, v]) =>
    typeof v === 'object' && v !== null ? keys(v, `${prefix}${k}.`) : [`${prefix}${k}`],
  )
}

// ---- scripted bench actions ----------------------------------------------------------------
function run(a: Apparatus, sim_s: number): void {
  const step = a.speed
  for (let t = 0; t < sim_s - 1e-9; t += step) a.tick(1)
}
/** Lab: turn the zero screw until the needle reads 0 (the capacitor is empty at the start, so the key is not needed here). */
function zeroNeedle(a: Apparatus): void {
  a.setSpeed(5)
  for (let i = 0; i < 4; i++) {
    run(a, 5)
    const r = a.readout()
    if (r.needleValue_V === null) return
    a.setZeroAdjust(a.zeroAdjust + r.needleValue_V / ((r.meterRange as number) * ZERO_ADJUST_RANGE_FRAC))
  }
  run(a, 5)
}
function warmUp(a: Apparatus): void {
  if (!a.lampOn) a.setLamp(true)
  if (a.mode === 'lab' && a.meterRange === 'OFF') a.setRange(3)
  a.setSpeed(a.mode === 'lab' ? 5 : 20)
  if (a.mode === 'lab') zeroNeedle(a)
  run(a, 70)
}
/** Discharge, release, wait for the plateau, record (typed value rounded like a careful needle reading). */
function measure(a: Apparatus, id: HgLineId): void {
  a.setArm(a.linePosition(id))
  a.pressKey()
  run(a, 2)
  a.releaseKey()
  for (let i = 0; i < 400 && !a.isSettled(); i++) run(a, 10)
  expect(a.isSettled()).toBe(true)
  const typed = a.mode === 'lab' ? Math.round(a.readout().needleValue_V! * 50) / 50 : undefined
  expect(a.record(typed).ok).toBe(true)
}

/** Scripted solution for each task. */
const SOLUTIONS: Record<string, (a: Apparatus) => void> = {
  'find-line': (a) => { a.setLamp(true); a.setArm(a.linePosition('violet')); a.setArm(a.linePosition('yellow')) },
  'first-u0': (a) => { warmUp(a); measure(a, 'yellow') },
  'repeat-spread': (a) => { warmUp(a); for (let i = 0; i < 4; i++) measure(a, 'green') },
  intensity: (a) => {
    warmUp(a)
    measure(a, 'green')
    a.setBeamIntensity(0.25)
    measure(a, 'green')
  },
  planck: (a) => { warmUp(a); for (const id of VISIBLE_LINES) measure(a, id) },
  threshold: (a) => {
    a.setOverrides({ cathode: 'Zn' })
    a.setLamp(true)
    a.setSpeed(20)
    run(a, 70)
    a.setArm(a.linePosition('violet'))
    a.pressKey(); run(a, 1); a.releaseKey()
    run(a, 40)
  },
  'error-sources': (a) => {
    a.setOverrides({ dirty: true })
    warmUp(a)
    for (const id of VISIBLE_LINES) measure(a, id)
  },
}

describe('anode emission and the needle zero in the tasks', () => {
  it('error-sources can also be completed with the anode-emission toggle alone', () => {
    const t = TASKS.find((x) => x.id === 'error-sources')!
    const a = new Apparatus({ mode: 'explore' })
    applyInitial(a, t)
    expect(t.hints.find((h) => h.key === 'toggleError')!.when(a)).toBe(true)
    a.setOverrides({ anode: true })
    expect(t.hints.find((h) => h.key === 'toggleError')!.when(a)).toBe(false)
    warmUp(a)
    for (const id of VISIBLE_LINES) measure(a, id)
    expect(a.measurements.every((m) => m.anode)).toBe(true)
    expect(t.success(a)).toBe(true)
    expect(a.fitResult()!.h_Js).toBeLessThan(H_Js)
    expect(t.controls).toContain('anode')
  })
  it('first-u0 hints at the zero adjust until the needle is zeroed', () => {
    const t = TASKS.find((x) => x.id === 'first-u0')!
    const a = new Apparatus({ mode: 'lab', seed: 3 })
    applyInitial(a, t)
    const hint = () => t.hints.find((h) => h.key === 'zeroNeedle')!.when(a)
    expect(hint()).toBe(false) // meter still off
    a.setRange(3)
    expect(hint()).toBe(true)
    zeroNeedle(a)
    expect(hint()).toBe(false)
    expect(en.hints.zeroNeedle).toMatch(/zero/i)
    expect(es.hints.zeroNeedle).toMatch(/cero/i)
  })
})

describe('pedagogy i18n', () => {
  it('en and es have identical keys, including every task field', () => {
    expect(keys(es).sort()).toEqual(keys(en).sort())
  })
  it('every task has all strings in both languages', () => {
    for (const lang of ['en', 'es'] as const) {
      for (const t of TASKS) {
        const x = pedagogyStrings[lang].task[t.id as keyof typeof en.task]
        expect(x, `${lang}/${t.id}`).toBeTruthy()
        for (const f of ['title', 'concept', 'predict', 'act', 'observe', 'explain', 'teacher'] as const) {
          expect(x[f].length, `${lang}/${t.id}/${f}`).toBeGreaterThan(10)
        }
        expect(Array.isArray(x.options)).toBe(true)
      }
    }
  })
  it('every hint key used by a task exists in the dictionary', () => {
    for (const t of TASKS) for (const h of t.hints) expect(en.hints, t.id).toHaveProperty(h.key)
  })
  it('Spanish differs from English (no untranslated copies)', () => {
    for (const t of TASKS) {
      const id = t.id as keyof typeof en.task
      expect(es.task[id].explain).not.toBe(en.task[id].explain)
    }
  })
})

describe('guided tasks', () => {
  it('ids are unique and every task has a solution script', () => {
    expect(new Set(TASKS.map((t) => t.id)).size).toBe(TASKS.length)
    expect(TASKS.length).toBe(7)
    for (const t of TASKS) expect(SOLUTIONS[t.id], t.id).toBeTypeOf('function')
  })
  it('choice answers index into the options of both languages', () => {
    for (const t of TASKS) {
      if (t.predict.kind !== 'choice') continue
      for (const d of [en, es]) {
        const opts = d.task[t.id as keyof typeof en.task].options
        expect(t.predict.answer, t.id).toBeGreaterThanOrEqual(0)
        expect(t.predict.answer, t.id).toBeLessThan(opts.length)
      }
    }
  })
  it('number predictions carry a unit and no choice task has an empty option list', () => {
    for (const t of TASKS) {
      const opts = en.task[t.id as keyof typeof en.task].options
      if (t.predict.kind === 'number') expect(t.predict.unit.length).toBeGreaterThan(0)
      else expect(opts.length).toBeGreaterThanOrEqual(2)
    }
  })
  it('success is false at the initial state', () => {
    for (const t of TASKS) {
      const a = new Apparatus({ mode: t.mode })
      applyInitial(a, t)
      expect(t.success(a), t.id).toBe(false)
      expect(a.mode).toBe(t.mode)
    }
  })
  it('applyInitial switches mode and resets measurements', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setLamp(true)
    a.record(0.3)
    const t = TASKS.find((x) => x.id === 'first-u0')!
    applyInitial(a, t)
    expect(a.mode).toBe('lab')
    expect(a.measurements).toHaveLength(0)
    expect(a.lampOn).toBe(false)
  })
  for (const id of ['find-line', 'first-u0', 'repeat-spread', 'intensity', 'planck', 'threshold', 'error-sources']) {
    it(`a scripted sequence completes ${id}`, () => {
      const t = TASKS.find((x) => x.id === id) as GuidedTask
      const a = new Apparatus({ mode: t.mode })
      applyInitial(a, t)
      expect(t.success(a)).toBe(false)
      SOLUTIONS[id]!(a)
      expect(t.success(a)).toBe(true)
    })
  }
  it('first-u0 rejects a wrong value, an unsettled reading and a different line', () => {
    const t = TASKS.find((x) => x.id === 'first-u0')!
    const a = new Apparatus({ mode: 'lab' })
    applyInitial(a, t)
    warmUp(a)
    a.setArm(a.linePosition('yellow'))
    a.pressKey(); run(a, 2); a.releaseKey()
    a.record(0.2) // unsettled and wrong
    expect(t.success(a)).toBe(false)
    for (let i = 0; i < 100 && !a.isSettled(); i++) run(a, 10)
    a.record(2.1) // settled, but the classic wrong value
    expect(t.success(a)).toBe(false)
    a.record(expectedPlateau_V('lab', 'yellow') + 0.04)
    expect(t.success(a)).toBe(true)
  })
  it('first-u0 tolerance follows the physics model of each mode', () => {
    expect(expectedPlateau_V('explore', 'yellow')).toBeGreaterThan(0.5)
    expect(expectedPlateau_V('lab', 'yellow')).toBeLessThan(expectedPlateau_V('explore', 'yellow'))
  })
  it('intensity needs two settled measurements of the same line at bright and dim settings', () => {
    const t = TASKS.find((x) => x.id === 'intensity')!
    const a = new Apparatus({ mode: 'explore' })
    applyInitial(a, t)
    warmUp(a)
    measure(a, 'green')
    measure(a, 'blue') // other line, still bright
    a.setBeamIntensity(0.2)
    measure(a, 'violet')
    expect(t.success(a)).toBe(false)
    measure(a, 'green')
    expect(t.success(a)).toBe(true)
  })
  it('intensity: U0 is the same bright and dim (the prediction answer)', () => {
    const a = new Apparatus({ mode: 'explore' })
    warmUp(a)
    measure(a, 'blue')
    a.setBeamIntensity(0.25)
    measure(a, 'blue')
    const [hi, lo] = a.measurements
    expect(Math.abs(hi!.U0_V - lo!.U0_V)).toBeLessThan(0.03)
    expect(lo!.t_wait_s).toBeGreaterThan(hi!.t_wait_s)
  })
  it('threshold: Zn stays discharged with violet light, K photocell does not', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setLamp(true)
    a.setSpeed(20)
    run(a, 70)
    a.setArm(a.linePosition('violet'))
    a.pressKey(); run(a, 1); a.releaseKey(); run(a, 40)
    expect(a.readout().U_V!).toBeGreaterThan(0.5)
    a.setOverrides({ cathode: 'Zn' })
    a.pressKey(); run(a, 1); a.releaseKey(); run(a, 40)
    expect(a.readout().U_V!).toBeLessThan(0.01)
  })
})

describe('error sources (directional claims checked against the model)', () => {
  function fittedH(setup: (a: Apparatus) => void): number {
    const a = new Apparatus({ mode: 'explore' })
    setup(a)
    warmUp(a)
    for (const id of VISIBLE_LINES) measure(a, id)
    return a.fitResult()!.h_Js
  }
  const clean = (): number => fittedH(() => {})
  it('clean explore h is close to the true value', () => {
    expect(Math.abs(clean() - H_Js) / H_Js).toBeLessThan(0.05)
  })
  it('dirty photocell gives a lower h', () => {
    expect(fittedH((a) => a.setOverrides({ dirty: true }))).toBeLessThan(clean())
  })
  it('stray light gives a lower h', () => {
    expect(fittedH((a) => a.setOverrides({ stray_fraction: 0.02 }))).toBeLessThan(clean())
  })
  it('the task answer is "lower" and the error-sources options order is higher/same/lower', () => {
    const t = TASKS.find((x) => x.id === 'error-sources')!
    expect(t.predict).toEqual({ kind: 'choice', answer: 2 })
    expect(en.task['error-sources'].options[2]).toBe('Lower')
    expect(es.task['error-sources'].options[2]).toBe('Menor')
  })
  it('stray light raises the low-frequency line most (relative)', () => {
    const rel = (id: HgLineId, stray: boolean): number => {
      const a = new Apparatus({ mode: 'explore' })
      if (stray) a.setOverrides({ stray_fraction: 0.02 })
      warmUp(a); measure(a, id)
      return a.measurements[0]!.U0_V
    }
    const dY = rel('yellow', true) / rel('yellow', false)
    const dV = rel('violet', true) / rel('violet', false)
    expect(dY).toBeGreaterThan(dV)
  })
})

describe('procedure checklist', () => {
  const done = (a: Apparatus): string[] => checklistState(a).filter((i) => i.done).map((i) => i.id)
  it('starts empty in lab mode', () => {
    const a = new Apparatus({ mode: 'lab' })
    expect(done(a)).toEqual(['cover']) // room lights are off by default
    expect(currentStep(checklistState(a))).toBe(0)
  })
  it('ticks along a scripted procedure', () => {
    const a = new Apparatus({ mode: 'lab' })
    a.setLamp(true)
    expect(done(a)).toEqual(['cover'])
    run(a, 70)
    expect(done(a)).toEqual(['lamp', 'cover'])
    a.setRange(3)
    expect(done(a)).toEqual(['lamp', 'meter', 'cover'])
    a.setArm(a.linePosition('yellow'))
    expect(done(a)).toEqual(['lamp', 'meter', 'cover', 'line'])
    a.pressKey(); run(a, 3)
    expect(done(a)).toContain('discharge')
    expect(done(a)).not.toContain('release')
    a.releaseKey()
    expect(done(a)).toContain('release')
    for (let i = 0; i < 100 && !a.isSettled(); i++) run(a, 10)
    expect(done(a)).toContain('wait')
    expect(done(a)).not.toContain('record')
    a.record(0.58)
    expect(done(a)).toContain('record')
    expect(done(a)).not.toContain('lines')
    // a new discharge starts a new cycle
    a.pressKey(); run(a, 3)
    expect(done(a)).not.toContain('record')
    expect(done(a)).not.toContain('release')
  })
  it('a new line resets discharge, release, wait and record', () => {
    const a = new Apparatus({ mode: 'lab' })
    warmUp(a)
    measure(a, 'yellow')
    expect(done(a)).toEqual(expect.arrayContaining(['discharge', 'release', 'wait', 'record']))
    a.setArm(a.linePosition('green'))
    for (const id of ['discharge', 'release', 'wait', 'record']) expect(done(a), id).not.toContain(id)
    expect(done(a)).toContain('line')
    expect(currentStep(checklistState(a))).toBe(checklistState(a).findIndex((i) => i.id === 'discharge'))
  })
  it('the zero step ticks only once the needle is zeroed (Lab), and is always ticked in explore', () => {
    const a = new Apparatus({ mode: 'lab' })
    expect(done(a)).not.toContain('zero')
    a.setRange(3)
    expect(done(a)).not.toContain('zero')
    expect(checklistState(a).map((i) => i.id).indexOf('zero')).toBe(checklistState(a).map((i) => i.id).indexOf('meter') + 1)
    zeroNeedle(a)
    expect(Math.abs(a.zeroErrorFrac())).toBeLessThanOrEqual(ZERO_TOL_FRAC)
    expect(done(a)).toContain('zero')
    a.setZeroAdjust(a.zeroAdjust + 0.5)
    expect(done(a)).not.toContain('zero')
    expect(done(new Apparatus({ mode: 'explore' }))).toContain('zero')
  })
  it('the cover step ticks with room lights off or the window cover closed', () => {
    const a = new Apparatus({ mode: 'lab' })
    expect(done(a)).toContain('cover')
    a.load({ roomLights: true })
    expect(done(a)).not.toContain('cover')
    a.setWindowCover(COVER_MIN - 0.05)
    expect(done(a)).not.toContain('cover')
    a.setWindowCover(COVER_MIN)
    expect(done(a)).toContain('cover')
    a.setWindowCover(0)
    a.load({ roomLights: false })
    expect(done(a)).toContain('cover')
  })
  it('the cover step is always ticked in explore, where room light is only visual', () => {
    const a = new Apparatus({ mode: 'explore' })
    expect(a.roomLights).toBe(true)
    expect(done(a)).toContain('cover')
    a.setRoomLights(true)
    expect(done(a)).toContain('cover')
  })
  it('ticks lines and fit after four lines', () => {
    const a = new Apparatus({ mode: 'lab' })
    warmUp(a)
    for (const id of VISIBLE_LINES.slice(0, 3)) measure(a, id)
    expect(checklistState(a).find((i) => i.id === 'lines')).toMatchObject({ done: false, detail: '3/4' })
    measure(a, 'violet')
    const items = checklistState(a)
    expect(items.every((i) => i.done)).toBe(true)
    expect(currentStep(items)).toBe(-1)
  })
})

describe('contextual coach', () => {
  it('flags release with the meter OFF, lamp warming and no line, once per session', () => {
    const a = new Apparatus({ mode: 'lab' })
    a.setLamp(true)
    a.tick(1)
    a.pressKey(); a.releaseKey()
    expect(coachCandidates(a, { type: 'release' })).toEqual(['releasedMeterOff', 'lampWarming', 'armBetween'])
    const c = new Coach()
    expect(c.pick(a, { type: 'release' })).toBe('releasedMeterOff')
    expect(c.pick(a, { type: 'release' })).toBe('lampWarming')
    expect(c.pick(a, { type: 'release' })).toBe('armBetween')
    expect(c.pick(a, { type: 'release' })).toBeNull()
  })
  it('flags over-range on tick', () => {
    const a = new Apparatus({ mode: 'explore' })
    a.setRange(0.1)
    a.forceCapacitorVoltage_V(0.5)
    expect(coachCandidates(a, { type: 'tick' })).toEqual(['overRange'])
  })
  it('flags unsettled records and a typed value far from the needle', () => {
    const a = new Apparatus({ mode: 'lab' })
    warmUp(a)
    a.setArm(a.linePosition('yellow'))
    a.pressKey(); run(a, 2); a.releaseKey(); run(a, 3)
    const r = a.record(1.5)
    if (!r.ok) throw new Error('record failed')
    expect(coachCandidates(a, { type: 'record', typed: 1.5, measurement: r.measurement })).toEqual(['recordUnsettled', 'typedFar'])
  })
  it('nudges when a measurement was recorded with the needle zero still off, but not after zeroing', () => {
    const a = new Apparatus({ mode: 'lab', seed: 2 })
    a.setLamp(true); a.setRange(3); a.setSpeed(5); run(a, 70)
    a.setArm(a.linePosition('yellow'))
    a.pressKey(); run(a, 2); a.releaseKey(); run(a, 60)
    const r1 = a.record(0.55)
    if (!r1.ok) throw new Error('record failed')
    expect(coachCandidates(a, { type: 'record', typed: 0.55, measurement: r1.measurement })).toContain('zeroOff')
    a.pressKey(); run(a, 3) // capacitor empty again, as the procedure says
    zeroNeedle(a)
    a.releaseKey()
    const r2 = a.record(0.59)
    if (!r2.ok) throw new Error('record failed')
    expect(coachCandidates(a, { type: 'record', typed: 0.59, measurement: r2.measurement })).not.toContain('zeroOff')
    expect(en.coach.zeroOff).toMatch(/zero/i)
    expect(es.coach.zeroOff).toMatch(/cero/i)
  })
  it('suggests opening the fit after four lines', () => {
    const a = new Apparatus({ mode: 'lab' })
    warmUp(a)
    for (const id of VISIBLE_LINES) measure(a, id)
    const m = a.measurements[3]!
    expect(coachCandidates(a, { type: 'record', typed: m.U0_V, measurement: m })).toEqual(['openFit'])
  })
})

describe('teacher key', () => {
  const md = teacherKey()
  it('lists plateaus, fits, error effects and every task', () => {
    expect(md).toContain('# Teacher key')
    for (const m of ['explore', 'lab'] as Mode[]) expect(md.toLowerCase()).toContain(m)
    for (const t of TASKS) expect(md).toContain(`\`${t.id}\``)
    expect(md).toMatch(/dirty/i)
    expect(md).toMatch(/stray/i)
  })
})

describe('phase 5a pedagogy fixes', () => {
  /** Measure violet, then switch to yellow WITHOUT discharging, wait, record. */
  function leftover(a: Apparatus): void {
    measure(a, 'violet')
    a.setArm(a.linePosition('yellow'))
    run(a, 60)
    a.record(Math.round(a.readout().needleValue_V! * 50) / 50)
  }
  it('coach shows notDischarged every time, not once per session', () => {
    const a = new Apparatus({ mode: 'lab' })
    warmUp(a)
    leftover(a)
    const m = a.measurements[1]!
    expect(m.dischargedSinceAlign).toBe(false)
    const ev = { type: 'record', typed: m.U0_V, measurement: m } as const
    expect(coachCandidates(a, ev)).toContain('notDischarged')
    const c = new Coach()
    expect(c.pick(a, ev)).toBe('notDischarged')
    expect(c.pick(a, ev)).toBe('notDischarged')
    expect(en.coach.notDischarged).toMatch(/without discharging/)
    expect(es.coach.notDischarged).toMatch(/sin descargar/)
  })
  it('a correct record never triggers notDischarged', () => {
    const a = new Apparatus({ mode: 'lab' })
    warmUp(a)
    measure(a, 'violet')
    const m = a.measurements[0]!
    expect(coachCandidates(a, { type: 'record', typed: m.U0_V, measurement: m })).not.toContain('notDischarged')
  })
  it('first-u0 does not accept a yellow reading taken without discharging', () => {
    const t = TASKS.find((x) => x.id === 'first-u0')!
    const a = new Apparatus({ mode: 'lab' })
    applyInitial(a, t)
    warmUp(a)
    measure(a, 'violet')
    a.setArm(a.linePosition('yellow'))
    // the capacitor sits at the violet plateau; typed value equals what the needle shows, whatever it is
    a.record(expectedPlateau_V('lab', 'yellow'))
    expect(a.measurements[1]!.dischargedSinceAlign).toBe(false)
    expect(t.success(a)).toBe(false)
    measure(a, 'yellow')
    expect(t.success(a)).toBe(true)
  })
  it('planck counts only discharged measurements', () => {
    const t = TASKS.find((x) => x.id === 'planck')!
    const a = new Apparatus({ mode: 'lab' })
    applyInitial(a, t)
    warmUp(a)
    for (const id of VISIBLE_LINES.slice(0, 3)) measure(a, id)
    a.setArm(a.linePosition('violet'))
    run(a, 60)
    a.record(1.4)
    expect(t.success(a)).toBe(false)
  })
  it('planck success is relative to the model of the mode, not the true h', () => {
    const t = TASKS.find((x) => x.id === 'planck')!
    const exp = expectedFitH_Js('lab')
    expect(exp).toBeLessThan(H_Js * 0.95) // the clean lab bench reads low
    const a = new Apparatus({ mode: 'lab' })
    applyInitial(a, t)
    warmUp(a)
    for (const id of VISIBLE_LINES) measure(a, id)
    const h = a.fitResult()!.h_Js
    expect(Math.abs(h - exp) / exp).toBeLessThan(0.1)
    expect(Math.abs(h - H_Js) / H_Js).toBeGreaterThan(0.05)
    expect(t.success(a)).toBe(true)
  })
  it('planck fails and hints "fitOff" when one point is far off', () => {
    const t = TASKS.find((x) => x.id === 'planck')!
    const a = new Apparatus({ mode: 'lab' })
    applyInitial(a, t)
    warmUp(a)
    for (const id of VISIBLE_LINES.slice(0, 3)) measure(a, id)
    // violet recorded far too low (settled and discharged, but a bad value)
    a.setArm(a.linePosition('violet'))
    a.pressKey(); run(a, 3); a.releaseKey()
    for (let i = 0; i < 400 && !a.isSettled(); i++) run(a, 10)
    a.record(0.7)
    expect(t.success(a)).toBe(false)
    expect(t.hints.find((h) => h.when(a))!.key).toBe('fitOff')
    expect(en.hints.fitOff).toBe('Your h is far off. Re-measure the point furthest from the line.')
  })
  it('planck and first-u0 hint at the speed control', () => {
    for (const id of ['planck', 'first-u0']) {
      const t = TASKS.find((x) => x.id === id)!
      expect(t.hints.some((h) => h.key === 'speedUp'), id).toBe(true)
    }
    expect(en.task['first-u0'].act).toMatch(/speed/)
  })
  it('find-line needs violet on the cell first, then yellow', () => {
    const t = TASKS.find((x) => x.id === 'find-line')!
    const a = new Apparatus({ mode: 'explore' })
    applyInitial(a, t)
    a.setLamp(true)
    a.setArm(a.linePosition('yellow'))
    expect(t.success(a)).toBe(false) // yellow without violet
    a.setArm(a.linePosition('violet'))
    expect(t.success(a)).toBe(false) // violet but not yet yellow
    a.setArm(a.linePosition('yellow'))
    expect(t.success(a)).toBe(true)
  })
  it('find-line ignores violet seen while the lamp was off', () => {
    const t = TASKS.find((x) => x.id === 'find-line')!
    const a = new Apparatus({ mode: 'explore' })
    applyInitial(a, t)
    a.setArm(a.linePosition('violet'))
    a.setLamp(true)
    a.setArm(a.linePosition('yellow'))
    expect(t.success(a)).toBe(false)
  })
  it('threshold requires the violet line, not blue or yellow', () => {
    const t = TASKS.find((x) => x.id === 'threshold')!
    for (const id of ['yellow', 'blue'] as const) {
      const a = new Apparatus({ mode: 'explore' })
      applyInitial(a, t)
      a.setOverrides({ cathode: 'Zn' })
      a.setLamp(true); a.setSpeed(20); run(a, 70)
      a.setArm(a.linePosition(id))
      a.pressKey(); run(a, 1); a.releaseKey(); run(a, 40)
      expect(t.success(a), id).toBe(false)
    }
    expect(en.task.threshold.title).toBe('Bright but below threshold')
    expect(es.task.threshold.title).toBe('Mucha luz, pero bajo el umbral')
  })
  it('planck prediction is a choice with answer h/e (index 1)', () => {
    const t = TASKS.find((x) => x.id === 'planck')!
    expect(t.predict).toEqual({ kind: 'choice', answer: 1 })
    for (const d of [en, es]) expect(d.task.planck.options[1]).toBe('h/e')
  })
  it('every choice answer index points at an option in both languages', () => {
    for (const t of TASKS) {
      if (t.predict.kind !== 'choice') continue
      for (const d of [en, es]) expect(d.task[t.id as keyof typeof en.task].options[t.predict.answer], t.id).toBeTruthy()
    }
  })
  it('hν text comes from one formatter and has no hard-coded energies in the strings', () => {
    expect(photonEnergyText('yellow', 'en')).toBe('2.15')
    expect(photonEnergyText('yellow', 'es')).toBe('2,15')
    expect(energyVars('en').Ev).toBe('3.06')
    for (const d of [en, es]) for (const t of Object.values(d.task)) expect(`${t.explain}${t.teacher}`).not.toMatch(/2[.,]14|3[.,]4 eV/)
    expect(teacherKey()).toContain('| yellow 578 nm | 519 | 2.15 |')
  })
  it('Spanish uses línea / pulsador / multímetro consistently', () => {
    const all = JSON.stringify(es)
    expect(all).not.toMatch(/\b[Rr]ayas?\b|medidor|Medidor|tecla\b|trabajo de extracción/)
  })
  it('new strings exist in both languages', () => {
    expect(en.checklist.steps.cover).toBe('Room dim or window cover closed')
    expect(es.checklist.steps.cover).toBe('Sala en penumbra o tapa de la ventana cerrada')
    expect(en.checklist.steps.wait).toBe('Wait for the plateau without touching anything')
    expect(es.ui.verdictRight).toBe('¡Acertaste!')
    expect(en.ui.verdictWrong).toBe('Not this time.')
  })
})

describe('repeat-spread task', () => {
  const t = TASKS.find((x) => x.id === 'repeat-spread')!
  it('sits after first-u0 and before planck, in Lab mode', () => {
    const ids = TASKS.map((x) => x.id)
    expect(ids.indexOf('repeat-spread')).toBe(ids.indexOf('first-u0') + 1)
    expect(ids.indexOf('repeat-spread')).toBeLessThan(ids.indexOf('planck'))
    expect(t.mode).toBe('lab')
  })
  it('three readings are not enough, the fourth completes it', () => {
    const a = new Apparatus({ mode: 'lab' })
    applyInitial(a, t)
    warmUp(a)
    for (let i = 0; i < 3; i++) measure(a, 'blue')
    expect(t.success(a)).toBe(false)
    measure(a, 'blue')
    expect(t.success(a)).toBe(true)
  })
  it('four readings spread over different lines do not count', () => {
    const a = new Apparatus({ mode: 'lab' })
    applyInitial(a, t)
    warmUp(a)
    for (const id of VISIBLE_LINES) measure(a, id)
    expect(t.success(a)).toBe(false)
  })
  it('pressing Record four times on one plateau (no new discharge) does not count', () => {
    const a = new Apparatus({ mode: 'lab' })
    applyInitial(a, t)
    warmUp(a)
    measure(a, 'green')
    for (let i = 0; i < 3; i++) a.record(Math.round(a.readout().needleValue_V! * 50) / 50)
    expect(a.measurements).toHaveLength(4)
    expect(t.success(a)).toBe(false)
  })
  it('has the new hint keys and the strings in both languages', () => {
    for (const d of [en, es]) {
      expect(d.hints.measureAgain.length).toBeGreaterThan(10)
      expect(d.hints.seeSpread.length).toBeGreaterThan(10)
      expect(d.task['repeat-spread'].options).toHaveLength(3)
    }
    expect(t.predict).toEqual({ kind: 'choice', answer: 1 })
  })
})
