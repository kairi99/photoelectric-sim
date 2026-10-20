// Device logic for the LD compact arrangement (558 79): lamp, swivelling arm, key switch, capacitor,
// electrometer and multimeter. DOM-free; physics comes only from ../physics/index.ts.
import {
  C_TOTAL_F,
  CATHODES,
  HG_LINES,
  IDEAL,
  KEY_TAU_s,
  LAB,
  R_CELL_DIRTY_Ohm,
  getLine,
  linearFit,
  maxContributingU0_V,
  mulberry32,
  nuFromLambda,
  photocurrentSlope_AperV,
  photocurrent_A,
  planckFromFit,
  totalLeakage_Ohm,
  withReadingNoise,
} from '../physics/index.ts'
import type { CathodeId, HgLineId, PhotoOptions, Scenario } from '../physics/index.ts'

export type Mode = 'explore' | 'lab'
export type MeterRange = 'OFF' | 0.1 | 0.3 | 1 | 3 | 10 | 30
export const METER_RANGES_V: readonly number[] = [0.1, 0.3, 1, 3, 10, 30]
export type Speed = 1 | 5 | 20

// Device constants (apparatus, not physics calibration).
export const LAMP_WARMUP_s = 60
export const NEEDLE_TAU_s = 0.3
export const MAX_REAL_DT_s = 5
export const CHUNK_s = 0.25
export const MAX_HISTORY = 2000
export const SETTLE_RATE_VperS = 1e-3
export const SETTLE_TIME_s = 5
export const LINE_SIGMA = 0.025 // line image width on the arm scale (1 sigma, arm fraction)
export const ALIGNED_OVERLAP = 0.9
/** Stray-light fraction the "stray light" switch applies (explore). */
export const STRAY_PRESET_FRACTION = 0.02
const NOISE = { explore: { sigma_V: 0.0005, offset_V: 0 }, lab: { sigma_V: 0.003, offset_V: 0.002 } } as const
const AMBIENT_REL = 0.01 // room-light contribution relative to a fully open window
const WAITED_s = 30

/** Fixed positions of the lines along the arm (0..1). UV is off the window in lab. */
const LINE_POS: Record<Mode, Record<HgLineId, number>> = {
  explore: { uv: 0.04, violet: 0.2, blue: 0.42, green: 0.68, yellow: 0.86 },
  lab: { uv: -0.3, violet: 0.2, blue: 0.42, green: 0.68, yellow: 0.86 },
}

export interface SpectrumLine {
  id: HgLineId
  lambda_nm: number
  position: number
  reachable: boolean
  overlap: number
  /** Relative line intensity on the window (relPower x lamp brightness x dimming). */
  intensity: number
}

export type ActionType =
  | 'lampOn' | 'lampOff' | 'meterOn' | 'range' | 'lineAligned' | 'discharged' | 'released' | 'waited' | 'recorded'
export interface LogEntry {
  t_s: number
  action: ActionType
  detail?: string | number
}

export interface Measurement {
  lineId: HgLineId | null
  lambda_nm: number | null
  nu_Hz: number | null
  U0_V: number
  t_wait_s: number
  settled: boolean
  /** Dimming slider when recorded (0..1). */
  dimming: number
  /** Explore override "dirty photocell" active when recorded. */
  dirty: boolean
  /** Explore override "stray light" active when recorded. */
  stray: boolean
}
export type RecordResult = { ok: true; measurement: Measurement } | { ok: false; error: 'invalid-value' | 'value-required' | 'meter-off' }

export interface FitSummary {
  slope_VperHz: number
  intercept_V: number
  h_Js: number
  sigma_h_Js: number
  r2: number
  n: number
}

export interface HistoryPoint {
  t_s: number
  U_V: number
}

export interface Readout {
  mode: Mode
  clock_s: number
  /** True capacitor voltage; null in lab mode (not observable). */
  U_V: number | null
  /** Instantaneous (noisy) meter value, null if the meter is off. */
  meterValue_V: number | null
  /** Smoothed value shown by the needle (V). */
  needleValue_V: number | null
  needleFraction: number
  overRange: boolean
  meterRange: MeterRange
  elapsedSinceRelease_s: number
  lineOnCell: HgLineId | null
  lampOn: boolean
  lampBrightness: number
  keyPressed: boolean
  armPosition: number
  settled: boolean
}

export interface Controls {
  mode: Mode
  lampOn: boolean
  lampWarm_s: number
  armPosition: number
  dimming: number
  keyPressed: boolean
  meterRange: MeterRange
  speed: Speed
  cathode: CathodeId
  stray_fraction: number | null
  dirty: boolean
  roomLights: boolean
  seed: number
  U_V: number
}

export interface ApparatusEvents {
  change: undefined
  release: { t_s: number }
  record: Measurement
  settled: { t_s: number; U_V: number }
  /** Fired after a measurement is recorded, removed, or the list is cleared (also by reset). */
  measurements: undefined
  mode: Mode
}
type Listener<K extends keyof ApparatusEvents> = (p: ApparatusEvents[K]) => void

export interface ApparatusOptions {
  mode?: Mode
  seed?: number
}

const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

export class Apparatus {
  mode: Mode
  lampOn = false
  armPosition = 0.5
  dimming = 1
  keyPressed = false
  meterRange: MeterRange = 3
  speed: Speed = 1
  cathode: CathodeId = 'photocell'
  stray_fraction: number | null = null // explore override; null = scenario default
  dirty = false
  roomLights = false
  readonly seed: number

  /** Simulated clock (s). */
  clock_s = 0
  releaseTime_s = 0
  measurements: Measurement[] = []
  procedureLog: LogEntry[] = []
  /** True once the key has been released at least once since the last reset. */
  hasReleased = false

  private lampWarm_s = 0
  private brightness = 0
  private U_V = 0
  private meterValue_V = 0
  private needle_V = 0
  private settleTime_s = 0
  private settledNow = false
  private settledEmitted = false
  private waitedLogged = false
  private dischargedLogged = false
  private lastAligned: HgLineId | null = null
  private rng: () => number
  private history: HistoryPoint[] = []
  private histEvery_s = CHUNK_s
  private histNext_s = 0
  private listeners: { [K in keyof ApparatusEvents]: Listener<K>[] } = { change: [], release: [], record: [], settled: [], measurements: [], mode: [] }

  constructor(opts: ApparatusOptions = {}) {
    this.mode = opts.mode ?? 'explore'
    this.seed = opts.seed ?? 1
    this.rng = mulberry32(this.seed)
    this.reset()
  }

  // ---- events -------------------------------------------------------------
  on<K extends keyof ApparatusEvents>(event: K, cb: Listener<K>): () => void {
    this.listeners[event].push(cb)
    return () => {
      const arr = this.listeners[event]
      const i = arr.indexOf(cb)
      if (i >= 0) arr.splice(i, 1)
    }
  }
  private emit<K extends keyof ApparatusEvents>(event: K, payload: ApparatusEvents[K]): void {
    for (const cb of [...this.listeners[event]]) cb(payload)
  }
  private changed(): void {
    this.emit('change', undefined)
  }
  private log(action: ActionType, detail?: string | number): void {
    this.procedureLog.push(detail === undefined ? { t_s: this.clock_s, action } : { t_s: this.clock_s, action, detail })
  }

  // ---- lifecycle ----------------------------------------------------------
  /** Back to defaults for the current mode (lab: multimeter OFF, lamp off). Keeps listeners. */
  reset(): void {
    this.lampOn = false
    this.lampWarm_s = 0
    this.brightness = 0
    this.armPosition = 0.5
    this.dimming = 1
    this.keyPressed = false
    this.meterRange = this.mode === 'lab' ? 'OFF' : 3
    this.speed = 1
    this.cathode = 'photocell'
    this.stray_fraction = null
    this.dirty = false
    this.roomLights = false
    this.clock_s = 0
    this.releaseTime_s = 0
    this.U_V = 0
    this.meterValue_V = 0
    this.needle_V = 0
    const hadMeasurements = this.measurements.length > 0
    this.measurements = []
    this.hasReleased = false
    this.procedureLog = []
    this.lastAligned = null
    this.rng = mulberry32(this.seed)
    this.resetRelease()
    if (hadMeasurements) this.emit('measurements', undefined)
    this.changed()
  }

  private resetRelease(): void {
    this.history = []
    this.histEvery_s = CHUNK_s
    this.histNext_s = 0
    this.settleTime_s = 0
    this.settledNow = false
    this.settledEmitted = false
    this.waitedLogged = false
  }

  setMode(mode: Mode): void {
    this.mode = mode
    this.reset()
    this.emit('mode', mode)
  }

  serialize(): Controls {
    return {
      mode: this.mode, lampOn: this.lampOn, lampWarm_s: this.lampWarm_s, armPosition: this.armPosition,
      dimming: this.dimming, keyPressed: this.keyPressed, meterRange: this.meterRange, speed: this.speed,
      cathode: this.cathode, stray_fraction: this.stray_fraction, dirty: this.dirty, roomLights: this.roomLights,
      seed: this.seed, U_V: this.U_V,
    }
  }

  /** Restore controls (not history, log or measurements). Seed of the instance is kept. */
  load(c: Partial<Controls>): void {
    if (c.mode !== undefined) this.mode = c.mode
    if (c.lampOn !== undefined) this.lampOn = c.lampOn
    if (c.lampWarm_s !== undefined) this.lampWarm_s = Math.max(0, c.lampWarm_s)
    if (!this.lampOn) this.lampWarm_s = 0
    this.brightness = this.lampOn ? this.brightnessFromWarm(this.lampWarm_s) : 0
    if (c.armPosition !== undefined) this.armPosition = clamp(c.armPosition, 0, 1)
    if (c.dimming !== undefined) this.dimming = clamp(c.dimming, 0, 1)
    if (c.keyPressed !== undefined) this.keyPressed = c.keyPressed
    if (c.meterRange !== undefined) this.meterRange = c.meterRange
    if (c.speed !== undefined) this.speed = c.speed
    if (c.cathode !== undefined) this.cathode = c.cathode
    if (c.stray_fraction !== undefined) this.stray_fraction = c.stray_fraction
    if (c.dirty !== undefined) this.dirty = c.dirty
    if (c.roomLights !== undefined) this.roomLights = c.roomLights
    if (c.U_V !== undefined) this.U_V = Math.max(0, c.U_V)
    this.needle_V = this.U_V
    this.resetRelease()
    this.changed()
  }

  // ---- controls -----------------------------------------------------------
  setLamp(on: boolean): void {
    if (on === this.lampOn) return
    this.lampOn = on
    this.lampWarm_s = 0
    this.brightness = 0
    this.log(on ? 'lampOn' : 'lampOff')
    this.changed()
  }
  setArm(position: number): void {
    this.armPosition = clamp(position, 0, 1)
    this.checkAligned()
    this.changed()
  }
  setDimming(d: number): void {
    this.dimming = clamp(d, 0, 1)
    this.changed()
  }
  setRange(r: MeterRange): void {
    if (r !== 'OFF' && !METER_RANGES_V.includes(r)) return
    const wasOff = this.meterRange === 'OFF'
    this.meterRange = r
    if (r !== 'OFF') {
      if (wasOff) {
        this.needle_V = this.U_V
        this.log('meterOn')
      }
      this.log('range', r)
    }
    this.changed()
  }
  setSpeed(s: Speed): void {
    if (this.mode === 'lab' && s === 20) return
    if (s !== 1 && s !== 5 && s !== 20) return
    this.speed = s
    this.changed()
  }
  /** Explore-only overrides (ignored in lab). */
  setOverrides(o: { cathode?: CathodeId; stray_fraction?: number | null; dirty?: boolean }): void {
    if (this.mode !== 'explore') return
    if (o.cathode !== undefined && o.cathode in CATHODES) this.cathode = o.cathode
    if (o.stray_fraction !== undefined) this.stray_fraction = o.stray_fraction === null ? null : Math.max(0, o.stray_fraction)
    if (o.dirty !== undefined) this.dirty = o.dirty
    this.changed()
  }
  /** Lab-only realism toggle: room not dark. */
  setRoomLights(on: boolean): void {
    if (this.mode !== 'lab') return
    this.roomLights = on
    this.changed()
  }
  /** Set the capacitor voltage directly (task initial states, tests). */
  forceCapacitorVoltage_V(U_V: number): void {
    this.U_V = Math.max(0, U_V)
    this.needle_V = this.U_V
    this.changed()
  }

  pressKey(): void {
    if (this.keyPressed) return
    this.keyPressed = true
    this.dischargedLogged = false
    this.changed()
  }
  releaseKey(): void {
    if (!this.keyPressed) return
    this.keyPressed = false
    this.releaseTime_s = this.clock_s
    this.hasReleased = true
    this.resetRelease()
    this.log('released')
    this.emit('release', { t_s: this.clock_s })
    this.changed()
  }

  // ---- optics -------------------------------------------------------------
  linePosition(id: HgLineId): number {
    return LINE_POS[this.mode][id]
  }
  private overlap(id: HgLineId): number {
    const d = this.armPosition - this.linePosition(id)
    return Math.exp(-(d * d) / (2 * LINE_SIGMA * LINE_SIGMA))
  }
  private overlaps(): { id: HgLineId; w: number }[] {
    return HG_LINES.map((l) => ({ id: l.id, w: this.overlap(l.id) })).filter((x) => x.w > 1e-4)
  }
  lineOnCell(): HgLineId | null {
    let best: HgLineId | null = null
    let bw = ALIGNED_OVERLAP
    for (const l of HG_LINES) {
      const w = this.overlap(l.id)
      if (w > bw) {
        bw = w
        best = l.id
      }
    }
    return best
  }
  spectrumOnWindow(): SpectrumLine[] {
    return HG_LINES.map((l) => {
      const position = this.linePosition(l.id)
      return {
        id: l.id,
        lambda_nm: l.lambda_nm,
        position,
        reachable: position >= 0 && position <= 1,
        overlap: this.overlap(l.id),
        intensity: l.relPower * this.brightness * this.dimming,
      }
    })
  }
  private checkAligned(): void {
    const a = this.lineOnCell()
    if (a !== this.lastAligned) {
      this.lastAligned = a
      if (a) this.log('lineAligned', a)
    }
  }

  // ---- electrical model ---------------------------------------------------
  private scenario(): Scenario {
    return this.mode === 'lab' ? LAB : IDEAL
  }
  private photoOpts(): PhotoOptions & { R_cell_Ohm?: number; R_input_Ohm?: number } {
    const p = this.scenario().params
    const o: PhotoOptions & { R_cell_Ohm?: number; R_input_Ohm?: number } = { ...p, dimming: this.dimming }
    if (this.mode === 'explore') {
      o.cathode = this.cathode
      if (this.stray_fraction !== null) o.stray_fraction = this.stray_fraction
      if (this.dirty) o.R_cell_Ohm = R_CELL_DIRTY_Ohm
    }
    return o
  }
  private brightnessFromWarm(w: number): number {
    const x = clamp(w / LAMP_WARMUP_s, 0, 1)
    return x * x * (3 - 2 * x)
  }

  /** Weighted multi-line photocurrent (A) and its slope (A/V) at voltage U. */
  private currents(U: number, ov: { id: HgLineId; w: number }[], o: ReturnType<Apparatus['photoOpts']>, ambient: number): { I: number; dI: number } {
    let I = 0
    let dI = 0
    const b = this.brightness
    for (const { id, w } of ov) {
      I += b * w * photocurrent_A(U, id, o)
      dI += b * w * photocurrentSlope_AperV(U, id, o)
    }
    if (ambient > 0) {
      const oa = { ...o, stray_fraction: 1 }
      I += ambient * photocurrent_A(U, 'yellow', oa)
      dI += ambient * photocurrentSlope_AperV(U, 'yellow', oa)
    }
    return { I, dI }
  }

  /** Upper bound for U: largest U0 among all lines that could contribute. */
  maxU0_V(): number {
    const o = this.photoOpts()
    return Math.max(...HG_LINES.map((l) => maxContributingU0_V(l.id, { ...o, stray_fraction: 1 })))
  }

  private integrate(U0: number, dt: number): number {
    if (this.keyPressed) return U0 * Math.exp(-dt / KEY_TAU_s)
    const o = this.photoOpts()
    const ov = this.overlaps()
    const ambient = this.mode === 'lab' && this.roomLights ? AMBIENT_REL * this.dimming : 0
    const C = C_TOTAL_F
    const G = 1 / totalLeakage_Ohm({ ...o, line: 'yellow' })
    const Umax = this.maxU0_V()
    const f = (U: number): number => (this.currents(U, ov, o, ambient).I - U * G) / C
    let U = U0
    let t = 0
    while (t < dt) {
      const rate = (-this.currents(U, ov, o, ambient).dI + G) / C
      let h = Math.min(dt - t, rate > 0 ? 0.1 / rate : dt)
      h = Math.max(h, Math.min(dt - t, 1e-3))
      const k1 = f(U)
      const k2 = f(U + 0.5 * h * k1)
      const k3 = f(U + 0.5 * h * k2)
      const k4 = f(U + h * k3)
      U += (h / 6) * (k1 + 2 * k2 + 2 * k3 + k4)
      U = clamp(Number.isFinite(U) ? U : 0, 0, Umax)
      t += h
    }
    return U
  }

  // ---- clock --------------------------------------------------------------
  /** Advance by a real-time dt; simulated time = dt x speed (dt capped at MAX_REAL_DT_s). */
  tick(realDt_s: number): void {
    if (!(realDt_s > 0)) return
    const dt = Math.min(realDt_s, MAX_REAL_DT_s) * this.speed
    const n = Math.max(1, Math.ceil(dt / CHUNK_s))
    const h = dt / n
    for (let k = 0; k < n; k++) this.advance(h)
    this.changed()
  }

  private advance(h: number): void {
    this.clock_s += h
    if (this.lampOn) {
      this.lampWarm_s += h
      this.brightness = this.brightnessFromWarm(this.lampWarm_s)
    }
    const Uold = this.U_V
    this.U_V = this.integrate(Uold, h)
    const rate = (this.U_V - Uold) / h
    const since = this.clock_s - this.releaseTime_s

    // plateau detector
    const eligible = !this.keyPressed && this.lampOn && this.brightness >= 0.99 && this.U_V > 0.01
    if (eligible && Math.abs(rate) < SETTLE_RATE_VperS) this.settleTime_s += h
    else this.settleTime_s = 0
    this.settledNow = this.settleTime_s > SETTLE_TIME_s
    if (this.settledNow && !this.settledEmitted) {
      this.settledEmitted = true
      this.emit('settled', { t_s: this.clock_s, U_V: this.U_V })
    }

    // meter and needle
    const nz = NOISE[this.mode]
    this.meterValue_V = withReadingNoise(this.U_V, this.rng, nz.sigma_V, nz.offset_V)
    if (this.meterRange !== 'OFF') {
      this.needle_V += (this.meterValue_V - this.needle_V) * (1 - Math.exp(-h / NEEDLE_TAU_s))
    }

    // history
    if (!this.keyPressed && this.meterRange !== 'OFF' && this.clock_s >= this.histNext_s) {
      this.history.push({ t_s: since, U_V: this.meterValue_V })
      this.histNext_s = this.clock_s + this.histEvery_s
      if (this.history.length >= MAX_HISTORY) {
        this.history = this.history.filter((_, i) => i % 2 === 0)
        this.histEvery_s *= 2
      }
    }

    // procedure log
    if (this.keyPressed && !this.dischargedLogged && this.U_V < 0.02) {
      this.dischargedLogged = true
      this.log('discharged')
    }
    if (!this.keyPressed && !this.waitedLogged && since >= WAITED_s) {
      this.waitedLogged = true
      this.log('waited', Math.round(since))
    }
    this.checkAligned()
  }

  // ---- meter --------------------------------------------------------------
  private rangeValue(): number | null {
    return this.meterRange === 'OFF' ? null : this.meterRange
  }
  needleFraction(): number {
    const r = this.rangeValue()
    if (r === null) return 0
    return clamp(this.needle_V / r, 0, 1)
  }
  overRange(): boolean {
    const r = this.rangeValue()
    return r !== null && this.needle_V > r
  }
  isSettled(): boolean {
    return this.settledNow
  }
  readout(): Readout {
    const off = this.meterRange === 'OFF'
    return {
      mode: this.mode,
      clock_s: this.clock_s,
      U_V: this.mode === 'explore' ? this.U_V : null,
      meterValue_V: off ? null : this.meterValue_V,
      needleValue_V: off ? null : this.needle_V,
      needleFraction: this.needleFraction(),
      overRange: this.overRange(),
      meterRange: this.meterRange,
      elapsedSinceRelease_s: this.clock_s - this.releaseTime_s,
      lineOnCell: this.lineOnCell(),
      lampOn: this.lampOn,
      lampBrightness: this.brightness,
      keyPressed: this.keyPressed,
      armPosition: this.armPosition,
      settled: this.settledNow,
    }
  }
  /** Ring buffer of (t since release, noisy meter U) for the live chart (a copy). */
  getHistory(): HistoryPoint[] {
    return this.history.slice()
  }

  // ---- measurements -------------------------------------------------------
  /** Lab: the student types the value read (0..30 V). Explore: omitted value auto-fills with the needle value. */
  record(valueTyped_V?: number): RecordResult {
    let v: number
    if (valueTyped_V === undefined) {
      if (this.mode === 'lab') return { ok: false, error: 'value-required' }
      if (this.meterRange === 'OFF') return { ok: false, error: 'meter-off' }
      v = this.needle_V
    } else {
      v = valueTyped_V
      if (typeof v !== 'number' || !Number.isFinite(v) || v < 0 || v > 30) return { ok: false, error: 'invalid-value' }
    }
    const id = this.lineOnCell()
    const line = id ? getLine(id) : null
    const m: Measurement = {
      lineId: id,
      lambda_nm: line ? line.lambda_nm : null,
      nu_Hz: line ? nuFromLambda(line.lambda_nm) : null,
      U0_V: v,
      t_wait_s: this.clock_s - this.releaseTime_s,
      settled: this.settledNow,
      dimming: this.dimming,
      dirty: this.mode === 'explore' && this.dirty,
      stray: this.mode === 'explore' && (this.stray_fraction ?? 0) > 0,
    }
    this.measurements.push(m)
    this.log('recorded', v)
    this.emit('record', m)
    this.emit('measurements', undefined)
    this.changed()
    return { ok: true, measurement: m }
  }
  removeMeasurement(i: number): void {
    if (i < 0 || i >= this.measurements.length) return
    this.measurements.splice(i, 1)
    this.emit('measurements', undefined)
    this.changed()
  }
  clearMeasurements(): void {
    if (this.measurements.length === 0) return
    this.measurements = []
    this.emit('measurements', undefined)
    this.changed()
  }
  /** U0 vs nu fit over aligned measurements; needs >= 2 distinct lines. */
  fitResult(): FitSummary | null {
    const pts = this.measurements.filter((m): m is Measurement & { nu_Hz: number } => m.nu_Hz !== null)
    if (new Set(pts.map((p) => p.lineId)).size < 2) return null
    const f = linearFit(pts.map((p) => p.nu_Hz), pts.map((p) => p.U0_V))
    return {
      slope_VperHz: f.slope,
      intercept_V: f.intercept,
      h_Js: planckFromFit(f.slope),
      sigma_h_Js: planckFromFit(f.sigma_slope),
      r2: f.r2,
      n: pts.length,
    }
  }
}
