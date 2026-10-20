import type { GuidedTask } from '../task.ts'
import { alignedLampOn } from '../task.ts'

export const task: GuidedTask = {
  id: 'find-line',
  mode: 'explore',
  level: 1,
  controls: ['lamp', 'arm'],
  initial: {},
  predict: { kind: 'choice', answer: 3 }, // options: yellow, green, blue, violet
  // violet on the cell with the lamp on at some point during the act step, then yellow
  success: (a) => a.lampOn && a.lineOnCell() === 'yellow' && alignedLampOn(a).includes('violet'),
  hints: [
    { when: (a) => !a.lampOn, key: 'lampOff' },
    { when: (a) => a.lampOn && a.lineOnCell() === null, key: 'moveArm' },
    { when: (a) => a.lampOn && !alignedLampOn(a).includes('violet'), key: 'findViolet' },
    { when: (a) => a.lampOn && a.lineOnCell() !== 'yellow', key: 'otherLine' },
  ],
}
