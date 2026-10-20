import { describe, expect, it } from 'vitest'
import { Apparatus } from '../src/apparatus/index.ts'
import type { Mode } from '../src/apparatus/index.ts'
import { H_Js } from '../src/physics/index.ts'
import type { HgLineId } from '../src/physics/index.ts'
import { TASKS } from '../src/pedagogy/tasks/index.ts'
import { applyInitial, expectedPlateau_V, VISIBLE_LINES } from '../src/pedagogy/task.ts'
import type { GuidedTask } from '../src/pedagogy/task.ts'
import { pedagogyStrings } from '../src/pedagogy/strings.ts'
import { checklistState, currentStep } from '../src/pedagogy/checklist.ts'
import { Coach, coachCandidates } from '../src/pedagogy/coach.ts'
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
function warmUp(a: Apparatus): void {
  if (!a.lampOn) a.setLamp(true)
  if (a.mode === 'lab' && a.meterRange === 'OFF') a.setRange(3)
  a.setSpeed(a.mode === 'lab' ? 5 : 20)
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
  'find-line': (a) => { a.setLamp(true); a.setArm(a.linePosition('yellow')) },
  'first-u0': (a) => { warmUp(a); measure(a, 'yellow') },
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
    expect(TASKS.length).toBe(6)
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
  for (const id of ['find-line', 'first-u0', 'intensity', 'planck', 'threshold', 'error-sources']) {
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
    expect(done(a)).toEqual([])
    expect(currentStep(checklistState(a))).toBe(0)
  })
  it('ticks along a scripted procedure', () => {
    const a = new Apparatus({ mode: 'lab' })
    a.setLamp(true)
    expect(done(a)).toEqual([])
    run(a, 70)
    expect(done(a)).toEqual(['lamp'])
    a.setRange(3)
    expect(done(a)).toEqual(['lamp', 'meter'])
    a.setArm(a.linePosition('yellow'))
    expect(done(a)).toEqual(['lamp', 'meter', 'line'])
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
    a.setArm(a.linePosition('green'))
    a.pressKey(); run(a, 3)
    expect(done(a)).not.toContain('record')
    expect(done(a)).not.toContain('release')
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
