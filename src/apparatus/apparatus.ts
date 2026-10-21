// Device logic for the LD compact arrangement (558 79): lamp, swivelling arm, key switch, capacitor,
// electrometer and multimeter. DOM-free; physics comes only from ../physics/index.ts.
import {
  ANODE_ILLUM_FRACTION,
  C_TOTAL_F,
  CATHODES,
  HG_LINES,
  IDEAL,
  KEY_TAU_s,
  daKeyHeld_V,
  linePower,
  MAX_STEP_V,
  LAB,
  R_CELL_DIRTY_Ohm,
  R_INPUT_Ohm,
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
import type { CathodeId, HgLineId, OpticsId, PhotoOptions, Scenario } from '../physics/index.ts'

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
/** Settled when the projected remaining rise |dU/dt| x tau_local is below max(SETTLE_REMAIN_V, SETTLE_REMAIN_REL x U)... */
export const SETTLE_REMAIN_V = 1e-3
export const SETTLE_REMAIN_REL = 1e-3
/** ... and stays so for this long (s). */
export const SETTLE_TIME_s = 5
/** Beam-intensity (neutral-density filter) range, explore only. */
export const BEAM_INTENSITY_MIN = 0.1
export const LINE_SIGMA = 0.025 // line image width on the arm scale (1 sigma, arm fraction)
export const ALIGNED_OVERLAP = 0.9
/**
 * Stray-light fraction the "stray light" switch applies (explore), PARAMETERS.md. Small because the explore source is
 * bright (IDEAL.I_ref_A) and the stray current must compete with a leakage of only ~1e-13 A at 1 V; a few 1e-4 is
 * already enough to pull the weak low-frequency plateau up. Chosen (scan, PARAMETERS.md) so the fitted h falls by ~10 %
 * while the four plateaus stay strictly increasing (yellow and green merge for larger fractions).
 */
export const STRAY_PRESET_FRACTION = 2.6e-4
/**
 * Accuracy class of the analog multimeter, in percent of full scale (ASSUMED 2.5, the class of a simple analog
 * multimeter; PARAMETERS.md). The error bound of a reading on range r is METER_CLASS_PCT/100 x r.
 */
export const METER_CLASS_PCT = 2.5
/**
 * A given instrument is typically well inside its class bound: its seeded gain error is drawn uniformly within
 * +-METER_GAIN_TYPICAL x the class, i.e. +-1 % of the reading for class 2.5. ASSUMED.
 */
export const METER_GAIN_TYPICAL = 0.4
/** Seeded mechanical zero offset of the needle (Lab): magnitude between these fractions of full scale (0.03 to 0.06 V on the 3 V range), random sign. ASSUMED. */
export const ZERO_OFFSET_MIN_FRAC = 0.01
export const ZERO_OFFSET_MAX_FRAC = 0.02
/** The zero-adjust screw shifts the needle by +-this fraction of full scale (enough to cancel any seeded offset). */
export const ZERO_ADJUST_RANGE_FRAC = 0.04
/** A needle zero error below this fraction of full scale (0.015 V on 3 V, under one fine division) counts as zeroed. */
export const ZERO_TOL_FRAC = 0.005
/** The analog needle can swing slightly below the zero mark before its stop (fraction of full scale). */
export const NEEDLE_MIN_FRAC = -0.06
/** Slow lamp brightness wander in Lab: largest relative deviation of the line intensities (ASSUMED 1 %). */
export const LAMP_DRIFT_REL = 0.01
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
  /** Relative line intensity on the window (relPower x lamp brightness x beam-intensity filter). */
  intensity: number
}

/** The capacitor counts as discharged below this voltage (V) while the key is held. */
export const DISCHARGED_V = 0.01

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
  /** Explore beam-intensity filter when recorded (0.1..1; always 1 in lab, which has no filter). */
  beamIntensity: number
  /** Explore override "dirty photocell" active when recorded. */
  dirty: boolean
  /** Explore override "stray light" active when recorded. */
  stray: boolean
  /** Explore override "anode emission" (reverse photocurrent) active when recorded. */
  anode: boolean
  /** Needle zero error at record time (V on the range in use, signed); always 0 in Explore. Lab: nonzero until the student zeroes. */
  zeroErr_V: number
  /**
   * True only if, since the line was last aligned on the cell, the key was held until the capacitor read below
   * DISCHARGED_V and then released. False means leftover charge from another line may be in the reading.
   */
  dischargedSinceAlign: boolean
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
  /** Needle zero error in V on the current range (mechanical offset minus the zero-adjust screw); 0 in Explore or with the meter off. */
  zeroError_V: number
}

export interface Controls {
  mode: Mode
  lampOn: boolean
  lampWarm_s: number
  armPosition: number
  windowCover: number
  beamIntensity: number
  keyPressed: boolean
  meterRange: MeterRange
  speed: Speed
  cathode: CathodeId
  stray_fraction: number | null
  dirty: boolean
  anode: boolean
  quartz: boolean
  zeroAdjust: number
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

type CircuitOpts = PhotoOptions & { R_cell_Ohm?: number; R_input_Ohm?: number; C_da_F?: number; R_da_Ohm?: number }
const clamp = (x: number, lo: number, hi: number): number => Math.min(hi, Math.max(lo, x))

export class Apparatus {
  mode: Mode
  lampOn = false
  armPosition = 0.5
  /** Emission-window cover (12), 0 = open, 1 = fully covered. Keeps room light out; does not dim the beam on the cathode. */
  windowCover = 0
  /** Explore-only neutral-density filter in the beam (0.1..1). */
  beamIntensity = 1
  keyPressed = false
  meterRange: MeterRange = 3
  speed: Speed = 1
  cathode: CathodeId = 'photocell'
  stray_fraction: number | null = null // explore override; null = scenario default
  dirty = false
  /** Explore override: reverse photocurrent from the K-contaminated anode (third error toggle). */
  anode = false
  /** Explore option: fused-quartz optics instead of glass (the 365 nm line reaches the cell). */
  quartz = false
  /** Position of the zero-adjust screw, -1..1 (Lab only); the seeded mechanical offset must be cancelled with it. */
  zeroAdjust = 0
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
  /** Voltage on the dielectric-absorption branch capacitor (Lab); equals U_V once the branch has equilibrated. */
  private Uda_V = 0
  private meterValue_V = 0
  private needle_V = 0
  private settleTime_s = 0
  private settledNow = false
  private settledEmitted = false
  private waitedLogged = false
  private dischargedLogged = false
  private lastAligned: HgLineId | null = null
  /** Capacitor was held below DISCHARGED_V since the last alignment (key still down or released). */
  private dischargeReached = false
  /** ...and the key was released afterwards. */
  private dischargedOk = false
  private rng: () => number
  /** Seeded instrument errors (Lab only; all zero in Explore). Drawn from a separate stream so the reading noise is unchanged. */
  private zeroOffsetFrac = 0
  private gainError = 0
  private driftPhase: number[] = [0, 0, 0]
  private driftPeriod_s: number[] = [60, 40, 25]
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
    this.windowCover = 0
    this.beamIntensity = 1
    this.keyPressed = false
    this.meterRange = this.mode === 'lab' ? 'OFF' : 3
    this.speed = 1
    this.cathode = 'photocell'
    this.stray_fraction = null
    this.dirty = false
    this.anode = false
    this.quartz = false
    this.zeroAdjust = 0
    this.roomLights = this.mode === 'explore'
    this.clock_s = 0
    this.releaseTime_s = 0
    this.U_V = 0
    this.Uda_V = 0
    this.seedInstrument()
    this.meterValue_V = 0
    this.needle_V = 0
    const hadMeasurements = this.measurements.length > 0
    this.measurements = []
    this.hasReleased = false
    this.procedureLog = []
    this.lastAligned = null
    this.dischargeReached = false
    this.dischargedOk = false
    this.rng = mulberry32(this.seed)
    this.resetRelease()
    if (hadMeasurements) this.emit('measurements', undefined)
    this.changed()
  }

  /** Draw the Lab instrument errors (meter zero offset and gain, lamp drift) from the seed; Explore is the ideal instrument. */
  private seedInstrument(): void {
    if (this.mode !== 'lab') {
      this.zeroOffsetFrac = 0
      this.gainError = 0
      this.driftPhase = [0, 0, 0]
      return
    }
    const r = mulberry32((this.seed ^ 0x9e3779b9) >>> 0)
    const sign = r() < 0.5 ? -1 : 1
    this.zeroOffsetFrac = sign * (ZERO_OFFSET_MIN_FRAC + (ZERO_OFFSET_MAX_FRAC - ZERO_OFFSET_MIN_FRAC) * r())
    this.gainError = (2 * r() - 1) * METER_GAIN_TYPICAL * (METER_CLASS_PCT / 100)
    this.driftPhase = [r() * 2 * Math.PI, r() * 2 * Math.PI, r() * 2 * Math.PI]
    this.driftPeriod_s = [70, 37, 23].map((p) => p * (0.85 + 0.3 * r()))
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
      windowCover: this.windowCover, beamIntensity: this.beamIntensity, keyPressed: this.keyPressed, meterRange: this.meterRange, speed: this.speed,
      cathode: this.cathode, stray_fraction: this.stray_fraction, dirty: this.dirty, anode: this.anode, quartz: this.quartz,
      zeroAdjust: this.zeroAdjust, roomLights: this.roomLights,
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
    if (c.windowCover !== undefined) this.windowCover = clamp(c.windowCover, 0, 1)
    if (c.beamIntensity !== undefined) this.beamIntensity = clamp(c.beamIntensity, BEAM_INTENSITY_MIN, 1)
    if (c.keyPressed !== undefined) this.keyPressed = c.keyPressed
    if (c.meterRange !== undefined) this.meterRange = c.meterRange
    if (c.speed !== undefined) this.speed = c.speed
    if (c.cathode !== undefined) this.cathode = c.cathode
    if (c.stray_fraction !== undefined) this.stray_fraction = c.stray_fraction
    if (c.dirty !== undefined) this.dirty = c.dirty
    if (c.anode !== undefined) this.anode = c.anode
    if (c.quartz !== undefined) this.quartz = c.quartz
    if (c.zeroAdjust !== undefined) this.zeroAdjust = this.mode === 'lab' ? clamp(c.zeroAdjust, -1, 1) : 0
    if (c.roomLights !== undefined) this.roomLights = c.roomLights
    if (c.U_V !== undefined) this.U_V = Math.max(0, c.U_V)
    this.Uda_V = this.U_V
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
  /** Slider (12): cover the emission window (0 open .. 1 covered) to keep room light out. */
  setWindowCover(c: number): void {
    this.windowCover = clamp(c, 0, 1)
    this.changed()
  }
  /** Explore-only neutral-density filter in the beam (0.1..1); the real bench has none. */
  setBeamIntensity(b: number): void {
    if (this.mode !== 'explore') return
    this.beamIntensity = clamp(b, BEAM_INTENSITY_MIN, 1)
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
  setOverrides(o: { cathode?: CathodeId; stray_fraction?: number | null; dirty?: boolean; anode?: boolean; quartz?: boolean }): void {
    if (this.mode !== 'explore') return
    if (o.cathode !== undefined && o.cathode in CATHODES) this.cathode = o.cathode
    if (o.stray_fraction !== undefined) this.stray_fraction = o.stray_fraction === null ? null : Math.max(0, o.stray_fraction)
    if (o.dirty !== undefined) this.dirty = o.dirty
    if (o.anode !== undefined) this.anode = o.anode
    if (o.quartz !== undefined) this.quartz = o.quartz
    this.changed()
  }
  /**
   * Zero-adjust screw of the multimeter (Lab only), -1..1. The needle starts with a seeded mechanical offset
   * (see zeroError_V); with the key held and the capacitor at 0 the student turns this until the needle reads 0.
   */
  setZeroAdjust(v: number): void {
    if (this.mode !== 'lab' || !Number.isFinite(v)) return
    this.zeroAdjust = clamp(v, -1, 1)
    this.changed()
  }
  /** Seeded relative gain error of the meter (Lab; 0 in Explore): within +-METER_GAIN_TYPICAL x METER_CLASS_PCT/100. */
  meterGainError(): number {
    return this.gainError
  }
  /** Mechanical zero error of the needle as a fraction of full scale (seeded offset minus the screw; 0 in Explore). */
  zeroErrorFrac(): number {
    return this.mode === 'lab' ? this.zeroOffsetFrac - this.zeroAdjust * ZERO_ADJUST_RANGE_FRAC : 0
  }
  /** Value the scale shows for a true meter value: gain error (within the accuracy class) and zero error (Lab). */
  private displayed(v_V: number): number {
    const r = this.rangeValue()
    if (r === null) return v_V
    return v_V * (1 + this.gainError) + this.zeroErrorFrac() * r
  }
  /** Room lit or dark. Lab: adds stray light (see ambientWeight). Explore: purely visual, the ideal instrument ignores it. */
  setRoomLights(on: boolean): void {
    this.roomLights = on
    this.changed()
  }
  /** Set the capacitor voltage directly (task initial states, tests). */
  forceCapacitorVoltage_V(U_V: number): void {
    this.U_V = Math.max(0, U_V)
    this.Uda_V = this.U_V
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
    if (this.dischargeReached) this.dischargedOk = true
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
        intensity: linePower(l.id, this.optics()) * this.brightness * this.driftFactor() * this.effectiveBeam(),
      }
    })
  }
  private checkAligned(): void {
    const a = this.lineOnCell()
    if (a !== this.lastAligned) {
      this.lastAligned = a
      if (a) {
        // a new line starts a new discharge -> release -> wait -> record cycle
        this.dischargeReached = false
        this.dischargedOk = false
        this.log('lineAligned', a)
      }
    }
  }

  // ---- electrical model ---------------------------------------------------
  private scenario(): Scenario {
    return this.mode === 'lab' ? LAB : IDEAL
  }
  /** Optics train in the beam: glass (default and always in Lab) or the Explore quartz option. */
  private optics(): OpticsId {
    return this.mode === 'explore' && this.quartz ? 'quartz' : 'glass'
  }
  /**
   * Slow wander of the lamp output (Lab): 1 + LAMP_DRIFT_REL x a normalised sum of three sinusoids with seeded
   * phases and periods of about 23, 37 and 70 s. Deterministic in the clock, bounded by +-LAMP_DRIFT_REL, 1 in Explore.
   * Lives here (device), not in the physics, which only knows the nominal intensity.
   */
  private driftFactor(): number {
    if (this.mode !== 'lab') return 1
    const w = [0.5, 0.3, 0.2]
    let x = 0
    for (let k = 0; k < 3; k++) x += w[k]! * Math.sin((2 * Math.PI * this.clock_s) / this.driftPeriod_s[k]! + this.driftPhase[k]!)
    return 1 + LAMP_DRIFT_REL * x
  }
  /** Beam attenuation actually applied (the lab has no filter). */
  private effectiveBeam(): number {
    return this.mode === 'explore' ? this.beamIntensity : 1
  }
  private errorToggleOn(): boolean {
    return this.mode === 'explore' && (this.dirty || this.anode || (this.stray_fraction ?? 0) > 0)
  }
  private photoOpts(): CircuitOpts {
    const p = this.scenario().params
    const o: CircuitOpts = { ...p, beamIntensity: this.effectiveBeam(), optics: this.optics() }
    if (this.mode === 'explore') {
      o.cathode = this.cathode
      if (this.anode) o.anode_fraction = ANODE_ILLUM_FRACTION
      if (this.stray_fraction !== null) o.stray_fraction = this.stray_fraction
      if (this.dirty) o.R_cell_Ohm = R_CELL_DIRTY_Ohm
      // A real bench always has the electrometer input resistance; the ideal 1e21 Ohm would let any stray current
      // charge every line up to the UV U0 (flat line, h ~ 0).
      if (this.errorToggleOn()) o.R_input_Ohm = R_INPUT_Ohm
    }
    return o
  }
  /** Room-light weight relative to a fully open window; 0 unless room lights are on (lab only). */
  private ambientWeight(): number {
    return this.mode === 'lab' && this.roomLights ? AMBIENT_REL * (1 - this.windowCover) : 0
  }
  private brightnessFromWarm(w: number): number {
    const x = clamp(w / LAMP_WARMUP_s, 0, 1)
    return x * x * (3 - 2 * x)
  }

  /** Weighted multi-line photocurrent (A) and its slope (A/V) at voltage U. */
  private currents(U: number, ov: { id: HgLineId; w: number }[], o: CircuitOpts, ambient: number, drift: number): { I: number; dI: number } {
    let I = 0
    let dI = 0
    const b = this.brightness * drift
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

  /** Advance the capacitor (and its dielectric-absorption branch) by dt; returns the new U and stores Uda_V. */
  private integrate(U0: number, dt: number): number {
    const o = this.photoOpts()
    if (this.keyPressed) {
      this.Uda_V = daKeyHeld_V(U0, this.Uda_V, dt, o)
      return U0 * Math.exp(-dt / KEY_TAU_s)
    }
    const ov = this.overlaps()
    const ambient = this.ambientWeight()
    const drift = this.driftFactor()
    const C = C_TOTAL_F
    const G = 1 / totalLeakage_Ohm({ ...o, line: 'yellow' })
    const Rda = o.R_da_Ohm && o.C_da_F ? o.R_da_Ohm : 0
    const Cda = o.C_da_F ?? 0
    const Umax = this.maxU0_V()
    const fU = (U: number, Ud: number): number => (this.currents(U, ov, o, ambient, drift).I - U * G - (Rda ? (U - Ud) / Rda : 0)) / C
    const fD = (U: number, Ud: number): number => (Rda ? (U - Ud) / (Rda * Cda) : 0)
    let U = U0
    let Ud = this.Uda_V
    let t = 0
    while (t < dt) {
      const rate = (-this.currents(U, ov, o, ambient, drift).dI + G) / C
      let h = Math.min(dt - t, rate > 0 ? 0.1 / rate : dt)
      const a1 = fU(U, Ud), b1 = fD(U, Ud)
      h = Math.min(h, MAX_STEP_V / Math.max(Math.abs(a1), 1e-12)) // do not jump over the kink of the saturated F(U)
      h = Math.max(h, Math.min(dt - t, 1e-3))
      const a2 = fU(U + 0.5 * h * a1, Ud + 0.5 * h * b1), b2 = fD(U + 0.5 * h * a1, Ud + 0.5 * h * b1)
      const a3 = fU(U + 0.5 * h * a2, Ud + 0.5 * h * b2), b3 = fD(U + 0.5 * h * a2, Ud + 0.5 * h * b2)
      const a4 = fU(U + h * a3, Ud + h * b3), b4 = fD(U + h * a3, Ud + h * b3)
      U += (h / 6) * (a1 + 2 * a2 + 2 * a3 + a4)
      Ud += (h / 6) * (b1 + 2 * b2 + 2 * b3 + b4)
      U = clamp(Number.isFinite(U) ? U : 0, 0, Umax)
      t += h
    }
    this.Uda_V = Number.isFinite(Ud) ? Ud : U
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
    this.U_V = this.integrate(this.U_V, h)
    const since = this.clock_s - this.releaseTime_s

    // plateau detector: projected remaining rise = |dU/dt| x local time constant (linearised C / (G - dI/dU))
    const eligible = !this.keyPressed && this.lampOn && this.brightness >= 0.99 && this.U_V > 0.01
    let remaining_V = Infinity
    if (eligible) {
      const o = this.photoOpts()
      const G = 1 / totalLeakage_Ohm({ ...o, line: 'yellow' })
      const ov = this.overlaps()
      const amb = this.ambientWeight()
      // Charging rate of the NOMINAL lamp (no slow brightness wander): "settled" is about the charging reaching its
      // plateau, not about the lamp's ~1 % drift moving the plateau.
      const cur = this.currents(this.U_V, ov, o, amb, 1)
      const rate = (cur.I - this.U_V * G) / C_TOTAL_F
      remaining_V = Math.abs(rate) * (C_TOTAL_F / Math.max(G - cur.dI, 1e-30))
    }
    if (eligible && remaining_V < Math.max(SETTLE_REMAIN_V, SETTLE_REMAIN_REL * this.U_V)) this.settleTime_s += h
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
    const shown = this.displayed(this.meterValue_V)

    // history
    if (!this.keyPressed && this.meterRange !== 'OFF' && this.clock_s >= this.histNext_s) {
      this.history.push({ t_s: since, U_V: shown })
      this.histNext_s = this.clock_s + this.histEvery_s
      if (this.history.length >= MAX_HISTORY) {
        this.history = this.history.filter((_, i) => i % 2 === 0)
        this.histEvery_s *= 2
      }
    }

    if (this.keyPressed && this.U_V < DISCHARGED_V) this.dischargeReached = true

    // procedure log
    if (this.keyPressed && !this.dischargedLogged && this.U_V < DISCHARGED_V) {
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
    return clamp(this.displayed(this.needle_V) / r, NEEDLE_MIN_FRAC, 1)
  }
  overRange(): boolean {
    const r = this.rangeValue()
    return r !== null && this.displayed(this.needle_V) > r
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
      meterValue_V: off ? null : this.displayed(this.meterValue_V),
      needleValue_V: off ? null : this.displayed(this.needle_V),
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
      zeroError_V: this.zeroError_V(),
    }
  }
  /** Needle zero error in V on the current range (0 with the meter off or in Explore). */
  zeroError_V(): number {
    const r = this.rangeValue()
    return r === null ? 0 : this.zeroErrorFrac() * r
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
      v = this.displayed(this.needle_V)
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
      beamIntensity: this.effectiveBeam(),
      dirty: this.mode === 'explore' && this.dirty,
      stray: this.mode === 'explore' && (this.stray_fraction ?? 0) > 0,
      anode: this.mode === 'explore' && this.anode,
      zeroErr_V: this.zeroError_V(),
      dischargedSinceAlign: this.dischargedOk,
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
