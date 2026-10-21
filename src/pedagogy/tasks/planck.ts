import type { GuidedTask } from '../task.ts'
import { ZERO_TOL_FRAC } from '../../apparatus/index.ts'
import { expectedFitH_Js, settledLines } from '../task.ts'

/** The student's h must be within this fraction of the h the bench model itself gives for the mode. */
export const PLANCK_REL_TOL = 0.1

export const task: GuidedTask = {
  id: 'planck',
  mode: 'lab',
  level: 2,
  controls: ['lamp', 'arm', 'range', 'key', 'record', 'fit', 'speed'],
  initial: {},
  predict: { kind: 'choice', answer: 1 }, // options: h, h/e, W/e, e/h
  success: (a) => {
    const fit = a.fitResult()
    const expected = expectedFitH_Js(a.mode)
    return settledLines(a).size >= 4 && fit !== null && Math.abs(fit.h_Js - expected) / expected <= PLANCK_REL_TOL
  },
  hints: [
    { when: (a) => !a.lampOn, key: 'lampOff' },
    { when: (a) => a.meterRange === 'OFF', key: 'meterOff' },
    { when: (a) => a.mode === 'lab' && a.meterRange !== 'OFF' && Math.abs(a.zeroErrorFrac()) > ZERO_TOL_FRAC && a.measurements.length === 0, key: 'zeroNeedle' },
    { when: (a) => a.hasReleased && !a.isSettled() && a.speed === 1, key: 'speedUp' },
    { when: (a) => settledLines(a).size < 4 && a.measurements.length > 0, key: 'moreLines' },
    {
      when: (a) => {
        const f = a.fitResult()
        const e = expectedFitH_Js(a.mode)
        return settledLines(a).size >= 4 && f !== null && Math.abs(f.h_Js - e) / e > PLANCK_REL_TOL
      },
      key: 'fitOff',
    },
    { when: (a) => settledLines(a).size >= 4, key: 'openFit' },
  ],
}
