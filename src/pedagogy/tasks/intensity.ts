import type { GuidedTask } from '../task.ts'

export const BRIGHT_MIN = 0.9
export const DIM_MAX = 0.3

export const task: GuidedTask = {
  id: 'intensity',
  mode: 'explore',
  level: 2,
  controls: ['lamp', 'arm', 'dimming', 'key', 'speed', 'record'],
  initial: {},
  predict: { kind: 'choice', answer: 1 }, // higher, same, lower
  success: (a) => {
    const settled = a.measurements.filter((m) => m.settled && m.lineId && m.lineId !== 'uv')
    return settled.some((hi) => hi.dimming >= BRIGHT_MIN && settled.some((lo) => lo.lineId === hi.lineId && lo.dimming <= DIM_MAX))
  },
  hints: [
    { when: (a) => !a.lampOn, key: 'lampOff' },
    { when: (a) => a.lampOn && a.lineOnCell() === null, key: 'moveArm' },
    { when: (a) => a.measurements.length === 0 && a.dimming < 0.9, key: 'dimUp' },
    { when: (a) => a.measurements.length >= 1 && a.dimming > 0.3, key: 'dimDown' },
    { when: (a) => a.hasReleased && !a.isSettled() && a.speed === 1, key: 'speedUp' },
    { when: (a) => a.isSettled(), key: 'typeValue' },
  ],
}
