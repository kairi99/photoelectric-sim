import { H_Js } from '../../physics/index.ts'
import type { GuidedTask } from '../task.ts'
import { settledLines } from '../task.ts'

export const PLANCK_REL_TOL = 0.15

export const task: GuidedTask = {
  id: 'planck',
  mode: 'lab',
  level: 2,
  controls: ['lamp', 'arm', 'range', 'key', 'record', 'fit'],
  initial: {},
  predict: { kind: 'number', unit: '×10⁻³⁴ J·s' },
  success: (a) => {
    const fit = a.fitResult()
    return settledLines(a).size >= 4 && fit !== null && Math.abs(fit.h_Js - H_Js) / H_Js <= PLANCK_REL_TOL
  },
  hints: [
    { when: (a) => !a.lampOn, key: 'lampOff' },
    { when: (a) => a.meterRange === 'OFF', key: 'meterOff' },
    { when: (a) => settledLines(a).size < 4 && a.measurements.length > 0, key: 'moreLines' },
    { when: (a) => settledLines(a).size >= 4, key: 'openFit' },
  ],
}
