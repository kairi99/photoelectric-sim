import type { GuidedTask } from '../task.ts'
import { expectedPlateau_V } from '../task.ts'

/** Honest needle reading on the 3 V scale is about 0.02 V; allow a little more on top of meter noise. */
export const FIRST_U0_TOL_V = 0.05

export const task: GuidedTask = {
  id: 'first-u0',
  mode: 'lab',
  level: 1,
  controls: ['lamp', 'arm', 'range', 'key', 'record'],
  initial: {},
  predict: { kind: 'choice', answer: 1 }, // 0.1, 0.6, 1.5, 2.1 V
  success: (a) => {
    const plateau = expectedPlateau_V(a.mode, 'yellow')
    return a.measurements.some((m) => m.lineId === 'yellow' && m.settled && Math.abs(m.U0_V - plateau) <= FIRST_U0_TOL_V)
  },
  hints: [
    { when: (a) => !a.lampOn, key: 'lampOff' },
    { when: (a) => a.lampOn && a.readout().lampBrightness < 0.99, key: 'warmUp' },
    { when: (a) => a.meterRange === 'OFF', key: 'meterOff' },
    { when: (a) => a.meterRange !== 'OFF' && a.meterRange !== 3, key: 'meterRange' },
    { when: (a) => a.lineOnCell() !== 'yellow', key: 'moveArm' },
    { when: (a) => !a.keyPressed && !a.hasReleased, key: 'pressKey' },
    { when: (a) => a.keyPressed, key: 'releaseKey' },
    { when: (a) => a.hasReleased && !a.isSettled() && a.measurements.length === 0, key: 'waitMore' },
    { when: (a) => a.isSettled() && a.measurements.length === 0, key: 'typeValue' },
  ],
}
