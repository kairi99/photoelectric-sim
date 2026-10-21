import type { GuidedTask } from '../task.ts'
import { REPEAT_MIN_READINGS, mostRepeated } from '../task.ts'

export const task: GuidedTask = {
  id: 'repeat-spread',
  mode: 'lab',
  level: 2,
  controls: ['lamp', 'arm', 'range', 'key', 'record', 'speed'],
  initial: {},
  predict: { kind: 'choice', answer: 1 }, // options: identical, close but not identical, completely different
  // Four valid readings of the same line, each after discharging again (see freshReadings).
  success: (a) => mostRepeated(a) >= REPEAT_MIN_READINGS,
  hints: [
    { when: (a) => !a.lampOn, key: 'lampOff' },
    { when: (a) => a.meterRange === 'OFF', key: 'meterOff' },
    { when: (a) => a.lampOn && a.lineOnCell() === null, key: 'moveArm' },
    { when: (a) => a.hasReleased && !a.isSettled() && a.speed === 1, key: 'speedUp' },
    { when: (a) => a.isSettled() && a.measurements.length === 0, key: 'typeValue' },
    { when: (a) => a.measurements.length > 0 && mostRepeated(a) < REPEAT_MIN_READINGS && !a.keyPressed, key: 'measureAgain' },
    { when: (a) => mostRepeated(a) >= REPEAT_MIN_READINGS, key: 'seeSpread' },
  ],
}
